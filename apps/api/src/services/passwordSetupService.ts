import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { ClientSession } from 'mongoose';
import { AccountOnboardingStatus } from '@club/shared-types/core/enums';
import { User } from '../models/User';
import { AppError } from '../utils/errors';

export const PASSWORD_SETUP_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ISSUE_ATTEMPTS = 3;

interface PasswordSetupIssueOptions {
  locale?: 'de' | 'en' | 'zh';
  expectedGeneration?: number;
  expectedDeliveryState?: {
    status?: string;
    generation?: number;
    claimedAt?: Date;
    expiresAt?: Date;
  };
}

function exactOptional(value: unknown): unknown {
  return value === undefined ? { $exists: false } : value;
}

export class PasswordSetupService {
  static digest(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  static async issue(
    userId: string,
    session?: ClientSession,
    options: PasswordSetupIssueOptions = {}
  ): Promise<{ token: string; generation: number; expiresAt: Date }> {
    const maxAttempts =
      options.expectedGeneration === undefined ? MAX_ISSUE_ATTEMPTS : 1;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const currentQuery = User.findById(userId).select(
        'passwordSetupGeneration passwordSetupLocale accountOnboardingStatus'
      );
      if (session) currentQuery.session(session);
      const current = await currentQuery;
      if (!current) throw AppError.notFound('User not found');
      if (current.accountOnboardingStatus === AccountOnboardingStatus.READY) {
        throw AppError.conflict('Password setup is already complete');
      }
      if (
        options.expectedGeneration !== undefined &&
        current.passwordSetupGeneration !== options.expectedGeneration
      ) {
        throw AppError.conflict('Password setup state changed');
      }

      const generation = (current.passwordSetupGeneration ?? 0) + 1;
      const token = `${generation}.${randomBytes(32).toString('base64url')}`;
      const expiresAt = new Date(Date.now() + PASSWORD_SETUP_TTL_MS);
      const updateFilter: Record<string, unknown> = {
        _id: userId,
        passwordSetupGeneration: current.passwordSetupGeneration ?? 0,
        accountOnboardingStatus: current.accountOnboardingStatus,
      };
      if (options.expectedDeliveryState) {
        updateFilter.passwordSetupDeliveryStatus = exactOptional(
          options.expectedDeliveryState.status
        );
        updateFilter.passwordSetupDeliveryGeneration = exactOptional(
          options.expectedDeliveryState.generation
        );
        updateFilter.passwordSetupDeliveryClaimedAt = exactOptional(
          options.expectedDeliveryState.claimedAt
        );
        updateFilter.passwordSetupExpiresAt = exactOptional(
          options.expectedDeliveryState.expiresAt
        );
      }
      const user = await User.findOneAndUpdate(
        updateFilter,
        {
          $set: {
            accountOnboardingStatus:
              AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
            passwordSetupTokenDigest: this.digest(token),
            passwordSetupExpiresAt: expiresAt,
            passwordSetupGeneration: generation,
            passwordSetupLocale:
              options.locale ?? current.passwordSetupLocale ?? 'de',
            passwordSetupDeliveryStatus: 'pending',
          },
          $unset: {
            passwordSetupConsumedAt: 1,
            passwordSetupDeliveryGeneration: 1,
            passwordSetupDeliveryClaimedAt: 1,
            passwordSetupDeliveryAttemptedAt: 1,
          },
        },
        { new: true, session }
      );
      if (user) return { token, generation, expiresAt };
    }
    if (options.expectedGeneration !== undefined) {
      throw AppError.conflict('Password setup state changed');
    }
    throw AppError.conflict('Password setup could not be issued');
  }

  static async retainLocaleForFutureIssue(
    userId: string,
    locale: 'de' | 'en' | 'zh',
    session: ClientSession
  ): Promise<number> {
    const user = await User.findById(userId)
      .select(
        'accountOnboardingStatus passwordSetupGeneration +passwordSetupTokenDigest passwordSetupExpiresAt passwordSetupDeliveryStatus passwordSetupDeliveryGeneration passwordSetupDeliveryClaimedAt passwordSetupDeliveryAttemptedAt'
      )
      .session(session);
    if (!user) throw AppError.notFound('User not found');
    if (user.accountOnboardingStatus === AccountOnboardingStatus.READY) {
      throw AppError.conflict('Password setup is already complete');
    }

    const generation = user.passwordSetupGeneration ?? 0;
    if (generation > 0) return generation;
    if (
      user.passwordSetupTokenDigest ||
      user.passwordSetupExpiresAt ||
      user.passwordSetupDeliveryStatus ||
      user.passwordSetupDeliveryGeneration !== undefined ||
      user.passwordSetupDeliveryClaimedAt ||
      user.passwordSetupDeliveryAttemptedAt
    ) {
      throw AppError.conflict('Password setup state is inconsistent');
    }

    const update = await User.updateOne(
      {
        _id: userId,
        accountOnboardingStatus: user.accountOnboardingStatus,
        passwordSetupGeneration: 0,
        passwordSetupTokenDigest: { $exists: false },
        passwordSetupExpiresAt: { $exists: false },
        passwordSetupDeliveryStatus: { $exists: false },
        passwordSetupDeliveryGeneration: { $exists: false },
        passwordSetupDeliveryClaimedAt: { $exists: false },
        passwordSetupDeliveryAttemptedAt: { $exists: false },
      },
      { $set: { passwordSetupLocale: locale } },
      { session }
    );
    if (update.matchedCount !== 1) {
      throw AppError.conflict('Password setup state changed');
    }
    return generation;
  }

  static async consume(token: string, password: string): Promise<void> {
    if (!token || password.length < 8)
      throw AppError.badRequest('Invalid password setup request');
    const generation = Number(token.split('.', 1)[0]);
    if (!Number.isSafeInteger(generation) || generation < 1) {
      throw AppError.badRequest('Password setup link is invalid or expired');
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.findOneAndUpdate(
      {
        passwordSetupTokenDigest: this.digest(token),
        passwordSetupGeneration: generation,
        accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
        passwordSetupExpiresAt: { $gt: new Date() },
      },
      {
        $set: {
          password: passwordHash,
          accountOnboardingStatus: AccountOnboardingStatus.READY,
          passwordSetupConsumedAt: new Date(),
        },
        $unset: { passwordSetupTokenDigest: 1, passwordSetupExpiresAt: 1 },
      },
      { new: true }
    );
    if (!user)
      throw AppError.badRequest('Password setup link is invalid or expired');
  }

  static async status(token: string): Promise<boolean> {
    if (!token) return false;
    const generation = Number(token.split('.', 1)[0]);
    if (!Number.isSafeInteger(generation) || generation < 1) return false;
    return Boolean(
      await User.exists({
        passwordSetupTokenDigest: this.digest(token),
        passwordSetupGeneration: generation,
        accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
        passwordSetupExpiresAt: { $gt: new Date() },
      })
    );
  }
}
