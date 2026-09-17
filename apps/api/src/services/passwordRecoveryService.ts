import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose, { Types, type ClientSession } from 'mongoose';
import type { AuthenticationLocale } from '@club/shared-types/api/auth';
import {
  AccountKind,
  AccountOnboardingStatus,
  Capability,
  type MembershipStatus,
  type PlayerType,
} from '@club/shared-types/core/enums';
import { evaluateCapabilityPolicy } from '@club/shared-types/domain/membershipCapability';
import { config } from '../config';
import { Player } from '../models/Player';
import { User } from '../models/User';
import { AppError } from '../utils/errors';
import { AuthSessionService } from './authSessionService';
import { classifyEmailDeliveryError } from './emailDeliveryError';
import { AUTHENTICATION_EMAIL_TEMPLATES } from './emailContracts/authentication';
import EmailService from './emailService';

export const PASSWORD_RECOVERY_TTL_MS = 60 * 60 * 1000;

export type PasswordRecoveryDeliveryStatus = 'sent' | 'failed' | 'uncertain';

interface RecoveryUserState {
  _id: Types.ObjectId;
  email: string;
  accountKind: AccountKind;
  administratorDesignation: boolean;
  membershipStatus?: MembershipStatus;
  accountOnboardingStatus: AccountOnboardingStatus;
  accountSuspension?: unknown;
  authSessionGeneration?: number;
}

interface RecoveryPlayerState {
  userId: Types.ObjectId;
  type: PlayerType;
  isActivePlayer: boolean;
}

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isPasswordRecoveryEligibleState(
  user: RecoveryUserState,
  player?: Pick<RecoveryPlayerState, 'type' | 'isActivePlayer'>
): boolean {
  if (
    user.accountKind !== AccountKind.PERSON ||
    user.accountOnboardingStatus !== AccountOnboardingStatus.READY ||
    user.accountSuspension
  ) {
    return false;
  }

  return evaluateCapabilityPolicy({
    accountKind: user.accountKind,
    administratorDesignation: user.administratorDesignation,
    membershipStatus: user.membershipStatus!,
    accountOnboardingStatus: user.accountOnboardingStatus,
    player,
  }).capabilities.includes(Capability.AUTHENTICATED_ACCOUNT);
}

async function findPlayer(
  userId: Types.ObjectId,
  session?: ClientSession
): Promise<RecoveryPlayerState | null> {
  const query = Player.findOne({ userId })
    .select('userId type isActivePlayer')
    .lean<RecoveryPlayerState>();
  if (session) query.session(session);
  return query;
}

async function isEligible(
  user: RecoveryUserState,
  session?: ClientSession
): Promise<boolean> {
  const player = await findPlayer(user._id, session);
  return isPasswordRecoveryEligibleState(user, player ?? undefined);
}

export class PasswordRecoveryService {
  static digest(token: string): string {
    return digest(token);
  }

  static hashRateLimitEmail(email: unknown): string {
    return digest(
      typeof email === 'string' ? normalizeEmail(email) : 'invalid'
    );
  }

  static async availabilityForUsers(
    users: RecoveryUserState[],
    knownPlayers?: RecoveryPlayerState[]
  ): Promise<Map<string, boolean>> {
    if (users.length === 0) return new Map();
    const players =
      knownPlayers ??
      (await Player.find({ userId: { $in: users.map((user) => user._id) } })
        .select('userId type isActivePlayer')
        .lean<RecoveryPlayerState[]>());
    const playersByUser = new Map(
      players.map((player) => [player.userId.toString(), player])
    );
    return new Map(
      users.map((user) => [
        user._id.toString(),
        isPasswordRecoveryEligibleState(
          user,
          playersByUser.get(user._id.toString())
        ),
      ])
    );
  }

  private static async issueForUser(
    user: RecoveryUserState,
    locale: AuthenticationLocale
  ): Promise<PasswordRecoveryDeliveryStatus> {
    if (!(await isEligible(user))) {
      throw AppError.conflict('Password recovery is unavailable');
    }

    const credential = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + PASSWORD_RECOVERY_TTL_MS);
    const issued = await User.findOneAndUpdate(
      {
        _id: user._id,
        accountKind: AccountKind.PERSON,
        accountOnboardingStatus: AccountOnboardingStatus.READY,
        accountSuspension: { $exists: false },
      },
      {
        $set: {
          passwordRecoveryTokenDigest: digest(credential),
          passwordRecoveryExpiresAt: expiresAt,
        },
      },
      { new: true }
    );
    if (!issued) throw AppError.conflict('Password recovery is unavailable');

    try {
      const resetLink = `${config.frontendUrl.replace(/\/$/, '')}/${locale}/reset-password#token=${encodeURIComponent(credential)}`;
      await EmailService.sendFromTemplate(
        AUTHENTICATION_EMAIL_TEMPLATES.PASSWORD_RECOVERY,
        issued.email,
        locale,
        {
          resetLink,
          expiresIn:
            locale === 'zh'
              ? '1 小时'
              : locale === 'en'
                ? '1 hour'
                : '1 Stunde',
        }
      );
      return 'sent';
    } catch (error) {
      return classifyEmailDeliveryError(error);
    }
  }

  static async requestByEmail(
    email: string,
    locale: AuthenticationLocale
  ): Promise<void> {
    const user = await User.findOne({ email: normalizeEmail(email) })
      .select('+authSessionGeneration')
      .lean<RecoveryUserState>();
    if (!user || !(await isEligible(user))) return;
    await this.issueForUser(user, locale);
  }

  static async requestForUser(
    userId: string,
    locale: AuthenticationLocale
  ): Promise<PasswordRecoveryDeliveryStatus> {
    if (!Types.ObjectId.isValid(userId)) {
      throw AppError.badRequest('Invalid User');
    }
    const user = await User.findById(userId)
      .select('+authSessionGeneration')
      .lean<RecoveryUserState>();
    if (!user) throw AppError.notFound('User not found');
    return this.issueForUser(user, locale);
  }

  static async status(token: string): Promise<boolean> {
    if (!token) return false;
    const user = await User.findOne({
      passwordRecoveryTokenDigest: digest(token),
      passwordRecoveryExpiresAt: { $gt: new Date() },
    })
      .select('+passwordRecoveryTokenDigest +authSessionGeneration')
      .lean<RecoveryUserState>();
    return Boolean(user && (await isEligible(user)));
  }

  static async consume(token: string, password: string): Promise<void> {
    if (!token || password.length < 8) {
      throw AppError.badRequest('Password recovery link is invalid or expired');
    }
    const tokenDigest = digest(token);
    const passwordHash = await bcrypt.hash(password, 12);
    const session = await mongoose.startSession();
    let consumed = false;

    try {
      await session.withTransaction(async () => {
        const now = new Date();
        const user = await User.findOne({
          passwordRecoveryTokenDigest: tokenDigest,
          passwordRecoveryExpiresAt: { $gt: now },
        })
          .select(
            '+passwordRecoveryTokenDigest +authSessionGeneration email accountKind administratorDesignation membershipStatus accountOnboardingStatus accountSuspension'
          )
          .session(session)
          .lean<RecoveryUserState>();
        if (!user || !(await isEligible(user, session))) return;

        const nextGeneration =
          AuthSessionService.generation(user.authSessionGeneration) + 1;
        const updated = await User.findOneAndUpdate(
          {
            _id: user._id,
            passwordRecoveryTokenDigest: tokenDigest,
            passwordRecoveryExpiresAt: { $gt: now },
            authSessionGeneration: AuthSessionService.generation(
              user.authSessionGeneration
            ),
          },
          {
            $set: {
              ['password']: passwordHash,
              authSessionGeneration: nextGeneration,
            },
            $unset: {
              passwordRecoveryTokenDigest: 1,
              passwordRecoveryExpiresAt: 1,
            },
          },
          { session, new: true, runValidators: true }
        );
        if (!updated) return;

        await AuthSessionService.deleteOlderGenerations(
          user._id.toString(),
          nextGeneration,
          session
        );
        consumed = true;
      });
    } finally {
      await session.endSession();
    }

    if (!consumed) {
      throw AppError.badRequest('Password recovery link is invalid or expired');
    }
  }
}
