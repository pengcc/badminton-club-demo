import mongoose from 'mongoose';
import {
  AccountKind,
  AuditEventType,
  EntityType,
} from '@club/shared-types/core/enums';
import { User, type IUser } from '../models/User';
import { AppError } from '../utils/errors';
import { AuditService, type AuditActor } from './auditService';
import { AuthSessionService } from './authSessionService';

interface AccountAccessCommand {
  userId: string;
  actor: AuditActor;
}

interface SuspendAccountCommand extends AccountAccessCommand {
  reason: string;
  occurredAt?: Date;
}

export class AccountAccessService {
  static async suspend(command: SuspendAccountCommand): Promise<IUser> {
    const reason = command.reason.trim();
    if (!reason)
      throw AppError.validation('Account suspension reason is required');

    return this.withTransaction(async (session) => {
      const user = await User.findById(command.userId)
        .select('+authSessionGeneration')
        .session(session);
      if (!user) throw AppError.notFound('User not found');
      if (user.accountKind !== AccountKind.PERSON) {
        throw AppError.validation('Super Admin cannot be suspended');
      }
      if (user.accountSuspension) {
        throw AppError.conflict('Account is already suspended');
      }

      const nextGeneration =
        AuthSessionService.generation(user.authSessionGeneration) + 1;
      user.accountSuspension = {
        reason,
        suspendedAt: command.occurredAt ?? new Date(),
        suspendedBy: new mongoose.Types.ObjectId(command.actor.id),
      };
      user.authSessionGeneration = nextGeneration;
      await user.save({ session });
      await AuthSessionService.deleteOlderGenerations(
        user._id.toString(),
        nextGeneration,
        session
      );
      await AuditService.writeRequired(
        {
          eventType: AuditEventType.USER_UPDATED,
          entityType: EntityType.USER,
          entityId: user._id,
          actor: command.actor,
          reason,
          changes: [
            { field: 'accountSuspension', oldValue: false, newValue: true },
          ],
        },
        session
      );
      return user;
    });
  }

  static async unsuspend(command: AccountAccessCommand): Promise<IUser> {
    return this.withTransaction(async (session) => {
      const user = await User.findById(command.userId)
        .select('+authSessionGeneration')
        .session(session);
      if (!user) throw AppError.notFound('User not found');
      if (user.accountKind !== AccountKind.PERSON) {
        throw AppError.validation('Super Admin cannot be unsuspended');
      }
      if (!user.accountSuspension) {
        throw AppError.conflict('Account is not suspended');
      }

      user.accountSuspension = undefined;
      await user.save({ session });
      await AuditService.writeRequired(
        {
          eventType: AuditEventType.USER_UPDATED,
          entityType: EntityType.USER,
          entityId: user._id,
          actor: command.actor,
          changes: [
            { field: 'accountSuspension', oldValue: true, newValue: false },
          ],
        },
        session
      );
      return user;
    });
  }

  private static async withTransaction<T>(
    operation: (session: mongoose.ClientSession) => Promise<T>
  ): Promise<T> {
    const session = await mongoose.startSession();
    try {
      let result: T | undefined;
      await session.withTransaction(async () => {
        result = await operation(session);
      });
      if (result === undefined) {
        throw AppError.internal(
          'Account access transaction produced no result'
        );
      }
      return result;
    } finally {
      await session.endSession();
    }
  }
}
