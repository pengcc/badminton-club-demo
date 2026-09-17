import {
  AccountOnboardingStatus,
  AccountKind,
  MembershipStatus,
  PlayerType,
} from '@club/shared-types/core/enums';
import type { AccountSetupSummary } from '@club/shared-types/api/accountOnboarding';
import {
  AccountOnboardingOperation,
  AccountOnboardingOperationStatus,
} from '../models/AccountOnboardingOperation';
import {
  RegistrationApprovalEvent,
  RegistrationApprovalStatus,
} from '../models/RegistrationApprovalEvent';
import { Player } from '../models/Player';
import { User } from '../models/User';
import { AppError } from '../utils/errors';
import { Types, type ClientSession } from 'mongoose';
import EmailService from './emailService';
import { ACCOUNT_ONBOARDING_EMAIL_TEMPLATES } from './emailContracts/accountOnboarding';
import { classifyEmailDeliveryError } from './emailDeliveryError';
import {
  PASSWORD_SETUP_TTL_MS,
  PasswordSetupService,
} from './passwordSetupService';

export type PublicSetupDeliveryStatus = 'sent' | 'failed' | 'uncertain';
export const PASSWORD_SETUP_DELIVERY_STALE_MS = 10 * 60 * 1000;

interface SetupProjectionUser {
  _id: Types.ObjectId;
  accountKind: AccountKind;
  membershipStatus?: MembershipStatus;
  accountOnboardingStatus: AccountOnboardingStatus;
  passwordSetupExpiresAt?: Date;
  passwordSetupGeneration: number;
  passwordSetupLocale?: 'de' | 'en' | 'zh';
  passwordSetupDeliveryGeneration?: number;
  passwordSetupDeliveryStatus?: string;
  passwordSetupDeliveryClaimedAt?: Date;
}

interface SetupProjectionPlayer {
  userId: Types.ObjectId;
  type: PlayerType;
  isActivePlayer: boolean;
}

export function toPublicSetupDeliveryStatus(
  status?: string
): PublicSetupDeliveryStatus {
  return status === 'sent' || status === 'failed' ? status : 'uncertain';
}

interface SetupDeliveryRecoveryPolicy {
  deliveryStatus: AccountSetupSummary['deliveryStatus'];
  reissueBlocked: boolean;
}

type SetupDeliveryState = Pick<
  SetupProjectionUser,
  | '_id'
  | 'passwordSetupExpiresAt'
  | 'passwordSetupGeneration'
  | 'passwordSetupDeliveryGeneration'
  | 'passwordSetupDeliveryStatus'
  | 'passwordSetupDeliveryClaimedAt'
>;

function setupDeliveryRecoveryPolicy(
  user: SetupDeliveryState,
  now: Date
): SetupDeliveryRecoveryPolicy {
  const internalStatus = user.passwordSetupDeliveryStatus;
  const isCurrentDeliveryGeneration =
    user.passwordSetupDeliveryGeneration === user.passwordSetupGeneration;

  if (
    isCurrentDeliveryGeneration &&
    (internalStatus === 'sent' ||
      internalStatus === 'failed' ||
      internalStatus === 'uncertain')
  ) {
    return { deliveryStatus: internalStatus, reissueBlocked: false };
  }

  if (internalStatus === 'pending') {
    const issuedAt = user.passwordSetupExpiresAt
      ? user.passwordSetupExpiresAt.getTime() - PASSWORD_SETUP_TTL_MS
      : undefined;
    if (issuedAt === undefined) {
      return { deliveryStatus: 'not_attempted', reissueBlocked: true };
    }
    const isStale =
      issuedAt + PASSWORD_SETUP_DELIVERY_STALE_MS <= now.getTime();
    return isStale
      ? { deliveryStatus: 'uncertain', reissueBlocked: false }
      : { deliveryStatus: 'not_attempted', reissueBlocked: true };
  }

  if (internalStatus === 'claimed') {
    if (!isCurrentDeliveryGeneration || !user.passwordSetupDeliveryClaimedAt) {
      return { deliveryStatus: 'not_attempted', reissueBlocked: true };
    }
    const isStale =
      user.passwordSetupDeliveryClaimedAt.getTime() +
        PASSWORD_SETUP_DELIVERY_STALE_MS <=
      now.getTime();
    return isStale
      ? { deliveryStatus: 'uncertain', reissueBlocked: false }
      : { deliveryStatus: 'not_attempted', reissueBlocked: true };
  }

  return { deliveryStatus: 'not_attempted', reissueBlocked: false };
}

function hasSupportedAccountState(
  user: Pick<SetupProjectionUser, 'accountKind' | 'membershipStatus'>,
  player?: Pick<SetupProjectionPlayer, 'type' | 'isActivePlayer'>
): boolean {
  const isCurrentMembership =
    user.membershipStatus === MembershipStatus.ACTIVE ||
    user.membershipStatus === MembershipStatus.PASSIVE;
  const isSupportedMember =
    user.accountKind === AccountKind.PERSON &&
    isCurrentMembership &&
    (!player || player.type === PlayerType.MEMBER);
  const isExternalPlayer =
    user.accountKind === AccountKind.PERSON &&
    user.membershipStatus === MembershipStatus.INACTIVE &&
    player?.type === PlayerType.EXTERNAL &&
    player.isActivePlayer;

  return isSupportedMember || isExternalPlayer;
}

export function projectAccountSetupSummary(
  user: SetupProjectionUser,
  reissueAvailable: boolean,
  now = new Date()
): AccountSetupSummary {
  const accountOnboardingStatus =
    user.accountOnboardingStatus ===
      AccountOnboardingStatus.PASSWORD_SETUP_PENDING &&
    user.passwordSetupExpiresAt &&
    user.passwordSetupExpiresAt.getTime() <= now.getTime()
      ? AccountOnboardingStatus.PASSWORD_SETUP_EXPIRED
      : user.accountOnboardingStatus;

  if (accountOnboardingStatus === AccountOnboardingStatus.READY) {
    return {
      userId: user._id.toString(),
      accountOnboardingStatus,
      deliveryStatus: 'none',
      reissueAvailable: false,
    };
  }

  const deliveryPolicy = setupDeliveryRecoveryPolicy(user, now);

  return {
    userId: user._id.toString(),
    accountOnboardingStatus,
    deliveryStatus: deliveryPolicy.deliveryStatus,
    reissueAvailable: reissueAvailable && !deliveryPolicy.reissueBlocked,
  };
}

export class PasswordSetupDeliveryService {
  private static async issueFromRecoverableState(
    user: SetupDeliveryState,
    locale: 'de' | 'en' | 'zh' | undefined,
    session?: ClientSession
  ) {
    const deliveryPolicy = setupDeliveryRecoveryPolicy(user, new Date());
    if (deliveryPolicy.reissueBlocked) {
      throw AppError.conflict('Password setup delivery is still in progress');
    }
    return PasswordSetupService.issue(user._id.toString(), session, {
      locale,
      expectedGeneration: user.passwordSetupGeneration,
      expectedDeliveryState: {
        status: user.passwordSetupDeliveryStatus,
        generation: user.passwordSetupDeliveryGeneration,
        claimedAt: user.passwordSetupDeliveryClaimedAt,
        expiresAt: user.passwordSetupExpiresAt,
      },
    });
  }

  static async issueForDirectOnboardingInSession(
    userId: string,
    locale: 'de' | 'en' | 'zh',
    session: ClientSession
  ) {
    const user = await User.findById(userId)
      .select(
        'passwordSetupGeneration passwordSetupExpiresAt passwordSetupDeliveryStatus passwordSetupDeliveryGeneration passwordSetupDeliveryClaimedAt'
      )
      .session(session)
      .lean<SetupDeliveryState>();
    if (!user) throw AppError.notFound('User not found');
    return this.issueFromRecoverableState(user, locale, session);
  }

  private static async assertReissueEligibility(user: {
    _id: Types.ObjectId;
    accountKind: AccountKind;
    membershipStatus: MembershipStatus;
  }): Promise<void> {
    const userId = user._id.toString();
    const [directOperation, registrationApproval, player] = await Promise.all([
      AccountOnboardingOperation.exists({
        status: AccountOnboardingOperationStatus.COMPLETED,
        'result.userId': userId,
      }),
      RegistrationApprovalEvent.exists({
        status: RegistrationApprovalStatus.COMPLETED,
        'result.userId': userId,
      }),
      Player.findOne({ userId: user._id }).select('type isActivePlayer').lean(),
    ]);

    if (!directOperation && !registrationApproval) {
      throw AppError.notFound('Password setup is unavailable');
    }

    if (!hasSupportedAccountState(user, player ?? undefined)) {
      throw AppError.conflict(
        'Password setup is unavailable for current account state'
      );
    }
  }

  static async setupSummariesForUsers(
    users: SetupProjectionUser[],
    knownPlayers?: SetupProjectionPlayer[]
  ): Promise<Map<string, AccountSetupSummary>> {
    if (users.length === 0) return new Map();

    const userObjectIds = users.map((user) => user._id);
    const userIds = userObjectIds.map((id) => id.toString());
    const [directOperations, registrationApprovals, players] =
      await Promise.all([
        AccountOnboardingOperation.find({
          status: AccountOnboardingOperationStatus.COMPLETED,
          'result.userId': { $in: userIds },
        })
          .select('result.userId')
          .lean(),
        RegistrationApprovalEvent.find({
          status: RegistrationApprovalStatus.COMPLETED,
          'result.userId': { $in: userIds },
        })
          .select('result.userId')
          .lean(),
        knownPlayers === undefined
          ? Player.find({ userId: { $in: userObjectIds } })
              .select('userId type isActivePlayer')
              .lean()
          : Promise.resolve(knownPlayers),
      ]);

    const directUserIds = new Set(
      directOperations.flatMap((operation) => {
        const userId = (operation.result as { userId?: string } | undefined)
          ?.userId;
        return userId ? [userId] : [];
      })
    );
    const approvedUserIds = new Set(
      registrationApprovals.flatMap((approval) => {
        const userId = (approval.result as { userId?: string } | undefined)
          ?.userId;
        return userId ? [userId] : [];
      })
    );
    const playersByUserId = new Map(
      players.map((player) => [player.userId.toString(), player])
    );

    return new Map(
      users.map((user) => {
        const userId = user._id.toString();
        const hasSupportedSource =
          directUserIds.has(userId) || approvedUserIds.has(userId);
        const reissueAvailable =
          user.accountOnboardingStatus !== AccountOnboardingStatus.READY &&
          hasSupportedSource &&
          hasSupportedAccountState(user, playersByUserId.get(userId));
        return [userId, projectAccountSetupSummary(user, reissueAvailable)];
      })
    );
  }

  static async statusForGeneration(
    userId: string,
    generation: number
  ): Promise<PublicSetupDeliveryStatus> {
    const user = await User.findById(userId)
      .select(
        'passwordSetupGeneration passwordSetupDeliveryGeneration passwordSetupDeliveryStatus'
      )
      .lean();
    if (
      !user ||
      user.passwordSetupGeneration !== generation ||
      user.passwordSetupDeliveryGeneration !== generation
    ) {
      return 'uncertain';
    }
    return toPublicSetupDeliveryStatus(user.passwordSetupDeliveryStatus);
  }

  static async deliver(
    userId: string,
    generation: number,
    token: string
  ): Promise<PublicSetupDeliveryStatus> {
    const claimedAt = new Date();
    const user = await User.findOneAndUpdate(
      {
        _id: userId,
        accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
        passwordSetupGeneration: generation,
        passwordSetupDeliveryStatus: 'pending',
      },
      {
        $set: {
          passwordSetupDeliveryStatus: 'claimed',
          passwordSetupDeliveryGeneration: generation,
          passwordSetupDeliveryClaimedAt: claimedAt,
        },
      },
      { new: true }
    );
    if (!user) {
      return this.statusForGeneration(userId, generation);
    }

    let status: PublicSetupDeliveryStatus = 'sent';
    try {
      const origin = process.env.FRONTEND_URL;
      if (!origin) throw AppError.internal('FRONTEND_URL is not configured');
      const locale = user.passwordSetupLocale ?? 'de';
      const resetLink = `${origin.replace(/\/$/, '')}/${locale}/set-password?token=${encodeURIComponent(token)}`;
      await EmailService.sendFromTemplate(
        ACCOUNT_ONBOARDING_EMAIL_TEMPLATES.PASSWORD_SETUP,
        user.email,
        locale,
        {
          firstName:
            user.accountKind === AccountKind.SUPER_ADMIN
              ? 'Super'
              : user.firstName,
          lastName:
            user.accountKind === AccountKind.SUPER_ADMIN
              ? 'Admin'
              : user.lastName,
          email: user.email,
          resetLink,
          expiresIn:
            locale === 'zh' ? '7 天' : locale === 'en' ? '7 days' : '7 Tage',
        }
      );
    } catch (error) {
      status = classifyEmailDeliveryError(error);
    }

    try {
      const updated = await User.updateOne(
        {
          _id: userId,
          passwordSetupGeneration: generation,
          passwordSetupDeliveryGeneration: generation,
          passwordSetupDeliveryStatus: 'claimed',
        },
        {
          $set: {
            passwordSetupDeliveryStatus: status,
            passwordSetupDeliveryAttemptedAt: new Date(),
          },
        }
      );
      return updated.matchedCount === 1 ? status : 'uncertain';
    } catch {
      return 'uncertain';
    }
  }

  static async reissueForUser(userId: string): Promise<{
    generation: number;
    deliveryStatus: PublicSetupDeliveryStatus;
  }> {
    if (!Types.ObjectId.isValid(userId))
      throw AppError.badRequest('Invalid User');
    const user = await User.findById(userId).lean();
    if (!user) throw AppError.notFound('Password setup is unavailable');
    if (user.accountOnboardingStatus === AccountOnboardingStatus.READY) {
      throw AppError.conflict('Password setup is already complete');
    }
    if (user.accountKind !== AccountKind.PERSON) {
      throw AppError.conflict(
        'Super Admin setup recovery uses the operator workflow'
      );
    }
    await this.assertReissueEligibility(user);
    const setup = await this.issueFromRecoverableState(user, undefined);
    const deliveryStatus = await this.deliver(
      user._id.toString(),
      setup.generation,
      setup.token
    );
    return { generation: setup.generation, deliveryStatus };
  }

  static async reissueForApplication(applicationId: string): Promise<{
    generation: number;
    deliveryStatus: PublicSetupDeliveryStatus;
  }> {
    if (!Types.ObjectId.isValid(applicationId))
      throw AppError.badRequest('Invalid application');
    const approval = await RegistrationApprovalEvent.findOne({
      applicationId,
      status: RegistrationApprovalStatus.COMPLETED,
      'result.userId': { $exists: true },
    }).lean();
    if (!approval?.result?.userId)
      throw AppError.notFound('Approved application setup is unavailable');
    return this.reissueForUser(approval.result.userId);
  }
}
