import { Types } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';
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
  type MembershipLifecycleResult,
  type MembershipLifecycleState,
} from '@club/shared-types/domain/membershipLifecycle';
import {
  MembershipLifecycleService,
  membershipLifecycleCommandFingerprint,
  type MembershipLifecycleRepository,
} from '../../services/membershipLifecycleService';

const actor = {
  id: '507f1f77bcf86cd799439011',
  email: 'admin@example.test',
  accountKind: AccountKind.PERSON,
  displayName: 'Administrator',
  capabilities: [Capability.ADMINISTRATION],
};

const command: MembershipLifecycleCommand = {
  operation: MembershipLifecycleOperation.SET_PLAYER_ELIGIBILITY,
  userId: '507f1f77bcf86cd799439012',
  eligible: true,
  playerTypeForCreation: PlayerType.MEMBER,
  expectedMembershipStatus: MembershipStatus.ACTIVE,
  actor,
  reason: 'Enable member Player',
  idempotencyKey: 'enable-member-player-1',
  occurredAt: new Date('2026-07-13T12:00:00.000Z'),
};

const initialState: MembershipLifecycleState = {
  userId: command.userId,
  membershipStatus: MembershipStatus.ACTIVE,
};

function repository(overrides: Record<string, unknown> = {}) {
  const loaded = {
    state: initialState,
    user: {
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      displayName: 'Member',
      capabilities: [Capability.AUTHENTICATED_ACCOUNT],
    },
    player: null,
    userVersion: 0,
  };
  const fake = {
    claim: vi.fn().mockResolvedValue({}),
    load: vi.fn().mockResolvedValue(loaded),
    apply: vi.fn().mockResolvedValue(undefined),
    audit: vi.fn().mockResolvedValue(new Types.ObjectId()),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
    withTransaction: vi
      .fn()
      .mockImplementation(async (operation: (session: never) => unknown) =>
        operation({} as never)
      ),
    ...overrides,
  };
  return {
    fake,
    service: new MembershipLifecycleService(
      fake as unknown as MembershipLifecycleRepository
    ),
  };
}

describe('MembershipLifecycleService consistency boundary', () => {
  it('fingerprints command intent while allowing retry timestamps to differ', () => {
    const retry = { ...command, occurredAt: new Date('2026-07-13T12:01:00Z') };
    const retryAfterStateChanged = {
      ...retry,
      expectedMembershipStatus: MembershipStatus.PASSIVE,
    };
    const differentIntent = { ...command, eligible: false };

    expect(membershipLifecycleCommandFingerprint(retry)).toBe(
      membershipLifecycleCommandFingerprint(command)
    );
    expect(membershipLifecycleCommandFingerprint(retryAfterStateChanged)).toBe(
      membershipLifecycleCommandFingerprint(command)
    );
    expect(membershipLifecycleCommandFingerprint(differentIntent)).not.toBe(
      membershipLifecycleCommandFingerprint(command)
    );
  });

  it('normalizes the ordinary inactive outcome while distinguishing continuation', () => {
    const inactive = {
      operation: MembershipLifecycleOperation.TRANSITION_MEMBERSHIP,
      userId: command.userId,
      expectedMembershipStatus: MembershipStatus.ACTIVE,
      targetMembershipStatus: MembershipStatus.INACTIVE,
      actor,
      reason: 'End membership',
      idempotencyKey: 'inactive-member-player-1',
      occurredAt: command.occurredAt,
    } as const;
    expect(membershipLifecycleCommandFingerprint(inactive)).toBe(
      membershipLifecycleCommandFingerprint({
        ...inactive,
        inactivePlayerOutcome:
          MembershipInactivePlayerOutcome.END_PARTICIPATION,
      })
    );
    expect(membershipLifecycleCommandFingerprint(inactive)).not.toBe(
      membershipLifecycleCommandFingerprint({
        ...inactive,
        inactivePlayerOutcome:
          MembershipInactivePlayerOutcome.CONTINUE_AS_EXTERNAL,
      })
    );
  });

  it('applies, audits, and completes one claimed command', async () => {
    const { fake, service } = repository();

    const result = await service.execute(command);

    expect(result.player).toEqual({
      type: PlayerType.MEMBER,
      isActivePlayer: true,
      teamIds: [],
    });
    expect(fake.apply).toHaveBeenCalledOnce();
    expect(fake.audit).toHaveBeenCalledOnce();
    expect(fake.complete).toHaveBeenCalledOnce();
    expect(fake.withTransaction).toHaveBeenCalledOnce();
  });

  it('returns a completed idempotent replay without repeating writes or audit', async () => {
    const replay: MembershipLifecycleResult = {
      ...initialState,
      operation: command.operation,
      idempotencyKey: command.idempotencyKey,
      changedFields: ['player'],
      player: {
        type: PlayerType.MEMBER,
        isActivePlayer: true,
        teamIds: [],
      },
      replayed: true,
    };
    const { fake, service } = repository({
      claim: vi.fn().mockResolvedValue({ replay }),
    });

    await expect(service.execute(command)).resolves.toEqual(replay);
    expect(fake.load).not.toHaveBeenCalled();
    expect(fake.apply).not.toHaveBeenCalled();
    expect(fake.audit).not.toHaveBeenCalled();
  });

  it('records a retryable failure when the transaction fails', async () => {
    const failure = new Error('audit unavailable');
    const { fake, service } = repository({
      audit: vi.fn().mockRejectedValue(failure),
    });

    await expect(service.execute(command)).rejects.toThrow('audit unavailable');
    expect(fake.fail).toHaveBeenCalledWith(command, failure);
    expect(fake.complete).not.toHaveBeenCalled();
  });

  it('always uses the transaction boundary', async () => {
    const { fake, service } = repository();

    await expect(service.execute(command)).resolves.toEqual(
      expect.objectContaining({ changedFields: ['player'] })
    );
    expect(fake.withTransaction).toHaveBeenCalledOnce();
  });

  it('uses a caller-owned session without opening a nested transaction', async () => {
    const { fake, service } = repository();
    const session = { id: 'caller-session' } as never;

    await expect(service.executeInSession(command, session)).resolves.toEqual(
      expect.objectContaining({ changedFields: ['player'] })
    );

    expect(fake.claim).toHaveBeenCalledWith(expect.anything(), session);
    expect(fake.load).toHaveBeenCalledWith(command.userId, session);
    expect(fake.apply).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      session
    );
    expect(fake.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      session
    );
    expect(fake.complete).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      session
    );
    expect(fake.withTransaction).not.toHaveBeenCalled();
    expect(fake.fail).not.toHaveBeenCalled();
  });
});
