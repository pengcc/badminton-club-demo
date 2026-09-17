import mongoose, { Types, type ClientSession } from 'mongoose';
import {
  AccountKind,
  AuditEventType,
  Capability,
  EntityType,
  MembershipStatus,
} from '@club/shared-types/core/enums';
import {
  MembershipInactivePlayerOutcome,
  MembershipLifecycleOperation,
  type MembershipLifecycleActor,
} from '@club/shared-types/domain/membershipLifecycle';
import { MemberBankingProfile } from '../models/MemberBankingProfile';
import { MembershipTermination } from '../models/MembershipTermination';
import { Player } from '../models/Player';
import { User } from '../models/User';
import { AppError } from '../utils/errors';
import { AuditService } from './auditService';
import { AuthSessionService } from './authSessionService';
import { IdentityDependencyClaimService } from './identityDependencyClaimService';
import { membershipLifecycleService } from './membershipLifecycleService';
import { PlayerCleanupService } from './playerCleanupService';

interface AccountDeletionCommand {
  userId: string;
  reason: string;
  actor: MembershipLifecycleActor;
  evaluatedAt?: Date;
}

async function withTransaction<T>(
  operation: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    let completed = false;
    await session.withTransaction(async () => {
      completed = false;
      result = await operation(session);
      completed = true;
    });
    if (!completed) {
      throw AppError.internal(
        'Account deletion transaction produced no result'
      );
    }
    return result as T;
  } finally {
    await session.endSession();
  }
}

export class AccountDeletionService {
  static async deleteAccount(command: AccountDeletionCommand): Promise<void> {
    if (!Types.ObjectId.isValid(command.userId)) {
      throw AppError.validation('User identifier is invalid');
    }
    if (!Types.ObjectId.isValid(command.actor.id)) {
      throw AppError.validation('Account deletion actor is invalid');
    }
    if (!command.actor.capabilities.includes(Capability.ADMINISTRATION)) {
      throw AppError.forbidden(
        'Administrator capability is required for permanent account deletion'
      );
    }
    const reason = command.reason.trim();
    if (!reason) {
      throw AppError.validation('Account deletion reason is required');
    }
    if (reason.length > 500) {
      throw AppError.validation(
        'Account deletion reason cannot exceed 500 characters'
      );
    }
    const evaluatedAt = command.evaluatedAt ?? new Date();

    await withTransaction(async (session) => {
      const originalUser = await User.findById(command.userId).session(session);
      if (!originalUser) throw AppError.notFound('User not found');
      if (originalUser.accountKind === AccountKind.SUPER_ADMIN) {
        throw AppError.conflict('Super Admin cannot be deleted');
      }
      const originalMembershipStatus = originalUser.membershipStatus;
      await IdentityDependencyClaimService.claimUser(
        {
          userId: originalUser._id,
          expectedVersion: originalUser.get('__v') ?? 0,
          accountKind: originalUser.accountKind,
          membershipStatus: originalMembershipStatus,
        },
        session
      );

      const originalPlayer = await Player.findOne({
        userId: originalUser._id,
      }).session(session);
      if (originalPlayer) {
        await IdentityDependencyClaimService.claimPlayer(
          {
            playerId: originalPlayer._id,
            expectedVersion: originalPlayer.get('__v') ?? 0,
          },
          session
        );
      }

      if (
        await MembershipTermination.exists({
          userId: originalUser._id,
          isOpen: true,
        }).session(session)
      ) {
        throw AppError.conflict(
          'Permanent account deletion is blocked by an open Membership termination'
        );
      }

      if (
        originalMembershipStatus === MembershipStatus.ACTIVE ||
        originalMembershipStatus === MembershipStatus.PASSIVE
      ) {
        await membershipLifecycleService.executeInSession(
          {
            operation: MembershipLifecycleOperation.TRANSITION_MEMBERSHIP,
            userId: originalUser._id.toString(),
            expectedMembershipStatus: originalMembershipStatus,
            targetMembershipStatus: MembershipStatus.INACTIVE,
            inactivePlayerOutcome:
              MembershipInactivePlayerOutcome.END_PARTICIPATION,
            actor: command.actor,
            reason,
            idempotencyKey: `account-deletion:${originalUser._id.toString()}`,
            occurredAt: evaluatedAt,
          },
          session
        );
      }

      const user = await User.findById(originalUser._id).session(session);
      if (!user) {
        throw AppError.conflict(
          'User state changed before permanent deletion could be applied'
        );
      }
      const player = await Player.findOne({ userId: user._id }).session(
        session
      );

      if (player) {
        await PlayerCleanupService.cleanupLoadedPlayerInSession({
          player,
          user,
          reason,
          actor: command.actor,
          evaluatedAt,
          session,
          retainUser: false,
        });
      }

      await AuthSessionService.deleteAllForUser(user._id.toString(), session);
      await MemberBankingProfile.deleteOne({ userId: user._id }).session(
        session
      );

      const userVersion = user.get('__v') ?? 0;
      const userWrite = await User.deleteOne({
        _id: user._id,
        __v: userVersion,
        membershipStatus: MembershipStatus.INACTIVE,
      }).session(session);
      if (userWrite.deletedCount !== 1) {
        throw AppError.conflict(
          'User state changed before permanent deletion could be applied'
        );
      }

      await AuditService.writeRequired(
        {
          eventType: AuditEventType.USER_DELETED,
          entityType: EntityType.USER,
          entityId: user._id,
          actor: {
            id: new Types.ObjectId(command.actor.id),
            accountKind: command.actor.accountKind,
          },
          reason,
          changes: [
            {
              field: 'membershipStatus',
              oldValue: originalMembershipStatus,
            },
            { field: 'physicalCleanup', newValue: true },
          ],
        },
        session
      );
    });
  }
}
