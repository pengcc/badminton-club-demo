import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AccountKind,
  MembershipStatus,
  PlayerType,
} from '@club/shared-types/core/enums';

const mocks = vi.hoisted(() => ({
  playerFindById: vi.fn(),
  playerUpdateOne: vi.fn(),
  userFindById: vi.fn(),
}));

vi.mock('../../models/Player', () => ({
  Player: {
    findById: mocks.playerFindById,
    updateOne: mocks.playerUpdateOne,
  },
}));
vi.mock('../../models/User', () => ({
  User: { findById: mocks.userFindById },
}));

import {
  assertPlayerEligibleForTeam,
  claimPlayerEligibleForMatch,
} from '../../services/membershipEligibilityService';
import { MatchService } from '../../services/matchService';

const idValue = '507f1f77bcf86cd799439012';
const teamIdValue = '507f191e810c19729de860ea';
const id = { toString: () => idValue };
const teamId = {
  toString: () => teamIdValue,
  equals: (value: { toString(): string }) => value.toString() === teamIdValue,
};
const session = {} as never;

function query<T>(value: T) {
  return { session: vi.fn().mockResolvedValue(value) };
}

describe('membership-owned Team eligibility guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.playerFindById.mockReturnValue(
      query({
        _id: id,
        userId: id,
        type: PlayerType.MEMBER,
        isActivePlayer: true,
        teamIds: [teamId],
        get: vi.fn().mockReturnValue(0),
      })
    );
    mocks.playerUpdateOne.mockResolvedValue({ matchedCount: 1 });
    mocks.userFindById.mockReturnValue(
      query({
        _id: id,
        accountKind: AccountKind.PERSON,
        membershipStatus: MembershipStatus.ACTIVE,
      })
    );
  });

  it('allows an active member Player to join a Team', async () => {
    await expect(
      assertPlayerEligibleForTeam(id.toString(), session)
    ).resolves.toMatchObject({
      playerId: idValue,
      playerType: PlayerType.MEMBER,
      playerVersion: 0,
    });
    expect(mocks.playerUpdateOne).not.toHaveBeenCalled();
  });

  it('rejects an inactive member Player before Team mutation', async () => {
    mocks.userFindById.mockReturnValue(
      query({
        _id: id,
        accountKind: AccountKind.PERSON,
        membershipStatus: MembershipStatus.INACTIVE,
      })
    );

    await expect(
      assertPlayerEligibleForTeam(id.toString(), session)
    ).rejects.toThrow('not eligible for Team participation');
  });

  it('allows an active external Player only with inactive membership', async () => {
    mocks.playerFindById.mockReturnValue(
      query({
        _id: id,
        userId: id,
        type: PlayerType.EXTERNAL,
        isActivePlayer: true,
        teamIds: [teamId],
        get: vi.fn().mockReturnValue(0),
      })
    );
    mocks.userFindById.mockReturnValue(
      query({
        _id: id,
        accountKind: AccountKind.PERSON,
        membershipStatus: MembershipStatus.INACTIVE,
      })
    );

    await expect(
      assertPlayerEligibleForTeam(id.toString(), session)
    ).resolves.toMatchObject({
      playerId: idValue,
      playerType: PlayerType.EXTERNAL,
      playerVersion: 0,
    });
    expect(mocks.playerUpdateOne).not.toHaveBeenCalled();
  });

  it('claims eligible Team assignment so lifecycle races fail closed', async () => {
    await expect(
      claimPlayerEligibleForMatch(idValue, teamIdValue, session)
    ).resolves.toBe(undefined);
    expect(mocks.playerUpdateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: id,
        __v: 0,
        isActivePlayer: true,
      }),
      { $inc: { __v: 1 } },
      { runValidators: true, session }
    );
  });

  it('rejects a Player who is not assigned to the Match Team', async () => {
    mocks.playerFindById.mockReturnValue(
      query({
        _id: id,
        userId: id,
        type: PlayerType.MEMBER,
        isActivePlayer: true,
        teamIds: [],
        get: vi.fn().mockReturnValue(0),
      })
    );
    await expect(
      claimPlayerEligibleForMatch(idValue, teamIdValue, session)
    ).rejects.toThrow('not assigned to the Match Team');
  });

  it('fails closed when eligibility changes before the Match write', async () => {
    mocks.playerUpdateOne.mockResolvedValue({ matchedCount: 0 });
    await expect(
      claimPlayerEligibleForMatch(idValue, teamIdValue, session)
    ).rejects.toThrow('eligibility changed');
  });
});
