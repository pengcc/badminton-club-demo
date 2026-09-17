import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuditEventType,
  Capability,
  MembershipStatus,
  PlayerType,
  AccountKind,
} from '@club/shared-types/core/enums';
import { MembershipLifecycleOperation } from '@club/shared-types/domain/membershipLifecycle';
import {
  accountDeletionSchema,
  updateUserSchema,
} from '@club/shared-types/schemas';
import { AppError } from '../../utils/errors';

const mocks = vi.hoisted(() => ({
  lifecycleExecute: vi.fn(),
  accountSuspend: vi.fn(),
  accountUnsuspend: vi.fn(),
  userFindById: vi.fn(),
  playerExists: vi.fn(),
  playerGetById: vi.fn(),
  playerGetWithUser: vi.fn(),
  playerUpdateSports: vi.fn(),
  playerBatchUpdate: vi.fn(),
  playerAddTeam: vi.fn(),
  playerRemoveTeam: vi.fn(),
  auditLog: vi.fn(),
  deleteAccount: vi.fn(),
  convertFormerMember: vi.fn(),
}));

vi.mock('../../services/membershipLifecycleService', () => ({
  membershipLifecycleService: { execute: mocks.lifecycleExecute },
}));
vi.mock('../../services/accountAccessService', () => ({
  AccountAccessService: {
    suspend: mocks.accountSuspend,
    unsuspend: mocks.accountUnsuspend,
  },
}));
vi.mock('../../models/User', () => ({
  User: { findById: mocks.userFindById },
}));
vi.mock('../../models/Player', () => ({
  Player: { exists: mocks.playerExists },
}));
vi.mock('../../services/playerService', () => ({
  MAX_PLAYER_BATCH_SIZE: 50,
  PlayerService: {
    getPlayerById: mocks.playerGetById,
    getPlayerByIdWithUserInfo: mocks.playerGetWithUser,
    updatePlayerSportsData: mocks.playerUpdateSports,
    batchUpdatePlayers: mocks.playerBatchUpdate,
    addPlayerToTeam: mocks.playerAddTeam,
    removePlayerFromTeam: mocks.playerRemoveTeam,
  },
}));
vi.mock('../../services/auditService', () => ({
  AuditService: { writeBestEffort: mocks.auditLog },
}));
vi.mock('../../services/accountDeletionService', () => ({
  AccountDeletionService: { deleteAccount: mocks.deleteAccount },
}));
vi.mock('../../services/playerLifecycleAdministrationService', () => ({
  PlayerLifecycleAdministrationService: {
    convertFormerMemberToExternal: mocks.convertFormerMember,
  },
}));

import { PlayerController } from '../../controllers/playerController';
import { UserController } from '../../controllers/userController';

const objectId = '507f1f77bcf86cd799439012';
const actor = {
  id: '507f1f77bcf86cd799439011',
  email: 'admin@example.test',
  accountKind: AccountKind.PERSON,
  displayName: 'Administrator',
  capabilities: [Capability.ADMINISTRATION],
};

function response() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

function request(body: Record<string, unknown> = {}) {
  return {
    body,
    params: { id: objectId },
    user: actor,
    ip: '127.0.0.1',
    get: vi.fn((name: string) =>
      name.toLowerCase() === 'idempotency-key' ? 'request-key' : undefined
    ),
  };
}

function userDocument(status = MembershipStatus.ACTIVE) {
  return {
    _id: { toString: () => objectId },
    id: objectId,
    membershipStatus: status,
    accountKind: AccountKind.PERSON,
    administratorDesignation: false,
    displayName: 'Member',
    capabilities: [Capability.AUTHENTICATED_ACCOUNT],
    isPlayer: false,
    save: vi.fn(),
    deleteOne: vi.fn().mockResolvedValue(undefined),
  };
}

describe('WP5 lifecycle mutation entry points', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.lifecycleExecute.mockResolvedValue({});
    mocks.accountSuspend.mockResolvedValue(userDocument());
    mocks.accountUnsuspend.mockResolvedValue(userDocument());
    mocks.auditLog.mockResolvedValue(undefined);
    mocks.playerExists.mockResolvedValue(false);
    mocks.deleteAccount.mockResolvedValue(undefined);
    mocks.convertFormerMember.mockResolvedValue({ id: objectId });
  });

  it('rejects obsolete membership suspension through the generic profile contract', () => {
    expect(
      updateUserSchema.safeParse({ membershipStatus: 'suspended' }).success
    ).toBe(false);
    expect(mocks.lifecycleExecute).not.toHaveBeenCalled();
  });

  it('routes explicit Account suspension through the Account access owner', async () => {
    const req = request({ reason: 'Unpaid membership dues' });

    await UserController.suspendAccount(
      req as never,
      response() as never,
      vi.fn()
    );

    expect(mocks.accountSuspend).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: objectId,
        reason: 'Unpaid membership dues',
      })
    );
    expect(mocks.lifecycleExecute).not.toHaveBeenCalled();
  });

  it('routes bounded active to passive administration through Membership Lifecycle', async () => {
    mocks.userFindById.mockResolvedValue(userDocument(MembershipStatus.ACTIVE));

    await UserController.transitionMembershipActivity(
      request({
        targetStatus: MembershipStatus.PASSIVE,
        reason: 'Annual activity classification',
      }) as never,
      response() as never,
      vi.fn()
    );

    expect(mocks.lifecycleExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: MembershipLifecycleOperation.TRANSITION_MEMBERSHIP,
        expectedMembershipStatus: MembershipStatus.ACTIVE,
        targetMembershipStatus: MembershipStatus.PASSIVE,
        reason: 'Annual activity classification',
        idempotencyKey: `request-key:membership-activity:${objectId}`,
      })
    );
  });

  it('routes Account unsuspension without a Membership transition', async () => {
    await UserController.unsuspendAccount(
      request() as never,
      response() as never,
      vi.fn()
    );

    expect(mocks.accountUnsuspend).toHaveBeenCalledWith(
      expect.objectContaining({ userId: objectId })
    );
    expect(mocks.lifecycleExecute).not.toHaveBeenCalled();
  });

  it('keeps ordinary profile changes outside the lifecycle idempotency contract', () => {
    expect(updateUserSchema.safeParse({ firstName: 'Ada' }).success).toBe(true);
    expect(
      updateUserSchema.safeParse({ membershipStatus: MembershipStatus.PASSIVE })
        .success
    ).toBe(false);
    expect(mocks.lifecycleExecute).not.toHaveBeenCalled();
  });

  it('reports final account-cleanup failure', async () => {
    const failure = new Error('delete failed');
    mocks.deleteAccount.mockRejectedValue(failure);
    const next = vi.fn();
    const res = response();

    await UserController.deleteUser(
      request({ reason: 'Final cleanup' }) as never,
      res as never,
      next
    );

    expect(next).toHaveBeenCalledWith(failure);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('requires a bounded permanent-deletion reason', () => {
    expect(accountDeletionSchema.safeParse({ reason: '  ' }).success).toBe(
      false
    );
    expect(
      accountDeletionSchema.safeParse({ reason: 'x'.repeat(501) }).success
    ).toBe(false);
    expect(
      accountDeletionSchema.safeParse({ reason: 'Duplicate account' }).success
    ).toBe(true);
  });

  it('routes final account cleanup through the transactional cleanup owner', async () => {
    const res = response();
    await UserController.deleteUser(
      request({ reason: 'Final cleanup' }) as never,
      res as never,
      vi.fn()
    );

    expect(mocks.deleteAccount).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: objectId,
        reason: 'Final cleanup',
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: null,
      message: 'Account permanently deleted',
    });
  });

  it('routes Player active-status changes through the lifecycle owner', async () => {
    mocks.playerGetById.mockResolvedValue({
      id: objectId,
      userId: objectId,
      type: PlayerType.MEMBER,
    });
    mocks.userFindById.mockResolvedValue(userDocument());
    const req = request({ isActivePlayer: false });
    const res = response();

    await PlayerController.updatePlayerStatus(
      req as never,
      res as never,
      vi.fn()
    );

    expect(mocks.lifecycleExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: MembershipLifecycleOperation.SET_PLAYER_ELIGIBILITY,
        eligible: false,
      })
    );
    expect(mocks.playerUpdateSports).not.toHaveBeenCalled();
  });

  it('routes former-Member conversion with the retained key and explicit reason', async () => {
    const req = request({ reason: 'Approved for external participation' });
    const res = response();

    await PlayerController.convertFormerMemberToExternal(
      req as never,
      res as never,
      vi.fn()
    );

    expect(mocks.convertFormerMember).toHaveBeenCalledWith(
      expect.objectContaining({
        playerId: objectId,
        reason: 'Approved for external participation',
        idempotencyKey: 'request-key',
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('turns the legacy Player delete endpoint into persistent deactivation', async () => {
    mocks.playerGetById.mockResolvedValue({
      id: objectId,
      userId: objectId,
      type: PlayerType.MEMBER,
    });
    mocks.userFindById.mockResolvedValue(userDocument());
    const req = request();
    const res = response();

    await PlayerController.deletePlayer(req as never, res as never, vi.fn());

    expect(mocks.lifecycleExecute).toHaveBeenCalledWith(
      expect.objectContaining({ eligible: false })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Player participation ended successfully',
      })
    );
  });

  it('preserves serious lifecycle errors for the global error handler', async () => {
    mocks.userFindById.mockResolvedValue(userDocument());
    mocks.lifecycleExecute.mockRejectedValue(
      AppError.internal('Lifecycle persistence unavailable')
    );
    const res = response();

    await expect(
      UserController.togglePlayerStatus(
        request({ isPlayer: true }) as never,
        res as never
      )
    ).rejects.toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('preserves lifecycle validation errors as HTTP 400 semantics', async () => {
    mocks.userFindById.mockResolvedValue(userDocument());
    mocks.lifecycleExecute.mockRejectedValue(
      AppError.validation('Lifecycle request is invalid')
    );

    await expect(
      UserController.togglePlayerStatus(
        request({ isPlayer: true }) as never,
        response() as never
      )
    ).rejects.toMatchObject({ statusCode: 400, code: 'VALIDATION_ERROR' });
  });

  it('rejects eligibility writes through the generic sporting update path', async () => {
    const next = vi.fn();

    await PlayerController.updatePlayer(
      request({ isActivePlayer: true }) as never,
      response() as never,
      next
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR' })
    );
    expect(mocks.playerUpdateSports).not.toHaveBeenCalled();
  });

  it('rejects Player batches larger than 50 items', async () => {
    const next = vi.fn();

    await PlayerController.batchUpdatePlayers(
      request({
        playerIds: Array.from({ length: 51 }, (_, index) => `player-${index}`),
        updates: { removeFromTeams: [objectId] },
      }) as never,
      response() as never,
      next
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 400, code: 'VALIDATION_ERROR' })
    );
    expect(mocks.playerBatchUpdate).not.toHaveBeenCalled();
  });

  it('returns the shared updatedCount result for Team association batches', async () => {
    mocks.playerBatchUpdate.mockResolvedValue({ updatedCount: 1 });
    const res = response();

    await PlayerController.batchUpdatePlayers(
      request({
        playerIds: [objectId],
        updates: { addToTeams: ['507f1f77bcf86cd799439013'] },
      }) as never,
      res as never,
      vi.fn()
    );

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: { updatedCount: 1 },
      })
    );
  });
});
