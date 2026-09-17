import mongoose from 'mongoose';
import {
  AccountKind,
  AccountOnboardingStatus,
} from '@club/shared-types/core/enums';
import { User } from '../models/User';
import { AppError } from '../utils/errors';
import { PasswordSetupService } from './passwordSetupService';
import {
  PasswordSetupDeliveryService,
  type PublicSetupDeliveryStatus,
} from './passwordSetupDeliveryService';

export interface SuperAdminSetupResult {
  userId: string;
  created: boolean;
  setupGeneration: number;
  deliveryStatus?: PublicSetupDeliveryStatus;
}

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalized)) {
    throw AppError.validation(
      'A valid canonical Super Admin email is required'
    );
  }
  return normalized;
}

export class SuperAdminService {
  private static async ensureSingletonConstraint(): Promise<void> {
    await User.collection.createIndex(
      { accountKind: 1 },
      {
        name: 'one_super_admin',
        unique: true,
        partialFilterExpression: { accountKind: AccountKind.SUPER_ADMIN },
      }
    );
  }

  static async bootstrap(email: string): Promise<SuperAdminSetupResult> {
    const normalizedEmail = normalizeEmail(email);
    await this.ensureSingletonConstraint();
    const existingPrincipal = await User.findOne({
      accountKind: AccountKind.SUPER_ADMIN,
    });
    if (existingPrincipal) {
      if (existingPrincipal.email !== normalizedEmail) {
        throw AppError.conflict('A canonical Super Admin already exists');
      }
      if (
        existingPrincipal.accountOnboardingStatus ===
          AccountOnboardingStatus.PASSWORD_SETUP_PENDING &&
        existingPrincipal.passwordSetupGeneration === 0
      ) {
        return this.issueAndDeliver(existingPrincipal._id.toString(), false);
      }
      return {
        userId: existingPrincipal._id.toString(),
        created: false,
        setupGeneration: existingPrincipal.passwordSetupGeneration ?? 0,
      };
    }
    if (await User.exists({ email: normalizedEmail })) {
      throw AppError.conflict(
        'The canonical email belongs to a person account'
      );
    }

    let userId: string | undefined;
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const [created] = await User.create(
          [
            {
              email: normalizedEmail,
              accountKind: AccountKind.SUPER_ADMIN,
              administratorDesignation: false,
              accountOnboardingStatus:
                AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
              isPlayer: false,
            },
          ],
          { session }
        );
        userId = created._id.toString();
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: number }).code === 11000
      ) {
        throw AppError.conflict(
          'A canonical Super Admin or email already exists'
        );
      }
      throw error;
    } finally {
      await session.endSession();
    }
    if (!userId)
      throw AppError.internal(
        'Super Admin bootstrap did not create an account'
      );
    return this.issueAndDeliver(userId, true);
  }

  static async recover(email: string): Promise<SuperAdminSetupResult> {
    const normalizedEmail = normalizeEmail(email);
    await this.ensureSingletonConstraint();
    const principal = await User.findOne({
      accountKind: AccountKind.SUPER_ADMIN,
      email: normalizedEmail,
    }).select('+authSessionGeneration');
    if (!principal) throw AppError.notFound('Canonical Super Admin not found');

    const updated = await User.findOneAndUpdate(
      {
        _id: principal._id,
        accountKind: AccountKind.SUPER_ADMIN,
        authSessionGeneration: principal.authSessionGeneration ?? 0,
      },
      {
        $set: {
          accountOnboardingStatus:
            AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
        },
        $inc: { authSessionGeneration: 1, __v: 1 },
        $unset: {
          password: 1,
          passwordSetupTokenDigest: 1,
          passwordSetupExpiresAt: 1,
          passwordSetupConsumedAt: 1,
          passwordSetupDeliveryGeneration: 1,
          passwordSetupDeliveryClaimedAt: 1,
          passwordSetupDeliveryAttemptedAt: 1,
        },
      },
      { new: true, runValidators: true }
    );
    if (!updated)
      throw AppError.conflict('Super Admin state changed during recovery');
    return this.issueAndDeliver(updated._id.toString(), false);
  }

  private static async issueAndDeliver(
    userId: string,
    created: boolean
  ): Promise<SuperAdminSetupResult> {
    const setup = await PasswordSetupService.issue(userId, undefined, {
      locale: 'de',
    });
    const deliveryStatus = await PasswordSetupDeliveryService.deliver(
      userId,
      setup.generation,
      setup.token
    );
    return {
      userId,
      created,
      setupGeneration: setup.generation,
      deliveryStatus,
    };
  }
}
