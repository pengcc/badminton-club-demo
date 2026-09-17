import { describe, expect, it } from 'vitest';
import {
  MembershipStatus,
  PlayerType,
  AccountKind,
  Capability,
} from '@club/shared-types/core/enums';
import {
  MembershipInactivePlayerOutcome,
  MembershipLifecycleOperation,
  type MembershipLifecycleCommand,
  type MembershipLifecycleState,
} from '@club/shared-types/domain/membershipLifecycle';
import {
  isPlayerEligibleForTeam,
  planMembershipLifecycleCommand,
} from '../../services/membershipLifecyclePolicy';

const actor = {
  id: '507f1f77bcf86cd799439011',
  email: 'admin@example.test',
  accountKind: AccountKind.PERSON,
  administratorDesignation: true,
  displayName: 'Administrator',
  capabilities: [Capability.ADMINISTRATION],
};

function state(
  membershipStatus: MembershipStatus,
  player?: MembershipLifecycleState['player']
): MembershipLifecycleState {
  return {
    userId: '507f1f77bcf86cd799439012',
    membershipStatus,
    player,
  };
}

function command(
  overrides: Partial<MembershipLifecycleCommand> = {}
): MembershipLifecycleCommand {
  return {
    operation: MembershipLifecycleOperation.TRANSITION_MEMBERSHIP,
    userId: '507f1f77bcf86cd799439012',
    targetMembershipStatus: MembershipStatus.PASSIVE,
    actor,
    reason: 'Membership lifecycle test',
    idempotencyKey: 'lifecycle-test-command',
    occurredAt: new Date('2026-07-13T12:00:00.000Z'),
    ...overrides,
  } as MembershipLifecycleCommand;
}

const allowedTransitions: Array<[MembershipStatus, MembershipStatus]> = [
  [MembershipStatus.ACTIVE, MembershipStatus.ACTIVE],
  [MembershipStatus.ACTIVE, MembershipStatus.PASSIVE],
  [MembershipStatus.ACTIVE, MembershipStatus.INACTIVE],
  [MembershipStatus.PASSIVE, MembershipStatus.ACTIVE],
  [MembershipStatus.PASSIVE, MembershipStatus.PASSIVE],
  [MembershipStatus.PASSIVE, MembershipStatus.INACTIVE],
  [MembershipStatus.INACTIVE, MembershipStatus.ACTIVE],
  [MembershipStatus.INACTIVE, MembershipStatus.PASSIVE],
  [MembershipStatus.INACTIVE, MembershipStatus.INACTIVE],
];

describe('Membership lifecycle policy', () => {
  it.each(
    allowedTransitions
  )('allows membership transition %s -> %s', (source, target) => {
    const result = planMembershipLifecycleCommand(
      state(source),
      command({ targetMembershipStatus: target })
    );

    expect(result.membershipStatus).toBe(target);
  });

  it('ends ordinary inactive Player participation but preserves explicit external continuation', () => {
    const current = state(MembershipStatus.ACTIVE, {
      id: 'player-1',
      type: PlayerType.MEMBER,
      isActivePlayer: true,
      teamIds: ['team-1'],
    });
    const ordinary = planMembershipLifecycleCommand(
      current,
      command({ targetMembershipStatus: MembershipStatus.INACTIVE })
    );
    expect(ordinary.player).toEqual({
      id: 'player-1',
      type: PlayerType.MEMBER,
      isActivePlayer: false,
      teamIds: [],
    });

    const continuation = planMembershipLifecycleCommand(
      current,
      command({
        targetMembershipStatus: MembershipStatus.INACTIVE,
        inactivePlayerOutcome:
          MembershipInactivePlayerOutcome.CONTINUE_AS_EXTERNAL,
      })
    );
    expect(continuation.player).toEqual({
      id: 'player-1',
      type: PlayerType.EXTERNAL,
      isActivePlayer: true,
      teamIds: ['team-1'],
    });
  });

  it('requires expected membership state when supplied', () => {
    expect(() =>
      planMembershipLifecycleCommand(
        state(MembershipStatus.PASSIVE),
        command({ expectedMembershipStatus: MembershipStatus.ACTIVE })
      )
    ).toThrow('changed before lifecycle command');
  });

  it('requires explicit conversion when current membership has an external Player', () => {
    const current = state(MembershipStatus.INACTIVE, {
      id: 'player-1',
      type: PlayerType.EXTERNAL,
      isActivePlayer: true,
      teamIds: ['team-1'],
    });

    expect(() =>
      planMembershipLifecycleCommand(
        current,
        command({ targetMembershipStatus: MembershipStatus.ACTIVE })
      )
    ).toThrow('explicit external-to-member');

    const converted = planMembershipLifecycleCommand(
      current,
      command({
        targetMembershipStatus: MembershipStatus.ACTIVE,
        convertExternalPlayerToMember: true,
      })
    );
    expect(converted.player?.type).toBe(PlayerType.MEMBER);
  });

  it('creates only an explicitly typed eligible Player', () => {
    expect(() =>
      planMembershipLifecycleCommand(
        state(MembershipStatus.ACTIVE),
        command({
          operation: MembershipLifecycleOperation.SET_PLAYER_ELIGIBILITY,
          eligible: true,
        })
      )
    ).toThrow('Player type is required');

    const result = planMembershipLifecycleCommand(
      state(MembershipStatus.ACTIVE),
      command({
        operation: MembershipLifecycleOperation.SET_PLAYER_ELIGIBILITY,
        eligible: true,
        playerTypeForCreation: PlayerType.MEMBER,
      })
    );
    expect(result.player).toEqual({
      type: PlayerType.MEMBER,
      isActivePlayer: true,
      teamIds: [],
    });
  });

  it('rejects contradictory Player eligibility', () => {
    expect(() =>
      planMembershipLifecycleCommand(
        state(MembershipStatus.INACTIVE),
        command({
          operation: MembershipLifecycleOperation.SET_PLAYER_ELIGIBILITY,
          eligible: true,
          playerTypeForCreation: PlayerType.MEMBER,
        })
      )
    ).toThrow('requires active or passive membership');
  });

  it('supports explicit member/external conversion primitives', () => {
    const external = planMembershipLifecycleCommand(
      state(MembershipStatus.INACTIVE, {
        id: 'player-1',
        type: PlayerType.MEMBER,
        isActivePlayer: false,
        teamIds: [],
      }),
      command({
        operation: MembershipLifecycleOperation.CONVERT_PLAYER_TYPE,
        targetPlayerType: PlayerType.EXTERNAL,
        eligible: true,
      })
    );
    expect(external.player?.type).toBe(PlayerType.EXTERNAL);
    expect(external.player?.isActivePlayer).toBe(true);

    expect(() =>
      planMembershipLifecycleCommand(
        state(MembershipStatus.ACTIVE, external.player),
        command({
          operation: MembershipLifecycleOperation.CONVERT_PLAYER_TYPE,
          targetPlayerType: PlayerType.EXTERNAL,
        })
      )
    ).toThrow('requires inactive membership');
  });

  it('enforces Team eligibility without changing state', () => {
    expect(
      isPlayerEligibleForTeam(
        state(MembershipStatus.ACTIVE, {
          type: PlayerType.MEMBER,
          isActivePlayer: true,
          teamIds: [],
        })
      )
    ).toBe(true);
    expect(
      isPlayerEligibleForTeam(
        state(MembershipStatus.INACTIVE, {
          type: PlayerType.MEMBER,
          isActivePlayer: true,
          teamIds: [],
        })
      )
    ).toBe(false);
    expect(
      isPlayerEligibleForTeam(
        state(MembershipStatus.INACTIVE, {
          type: PlayerType.EXTERNAL,
          isActivePlayer: true,
          teamIds: [],
        })
      )
    ).toBe(true);
  });
});
