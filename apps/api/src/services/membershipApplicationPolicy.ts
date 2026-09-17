import {
  MemberApplicationStatus,
  AccountKind,
  MembershipStatus,
} from '@club/shared-types/core/enums';
import type { ClientSession } from 'mongoose';
import { MembershipApplication } from '../models/MembershipApplication';
import { User } from '../models/User';
import { AppError } from '../utils/errors';

const DAY_MS = 24 * 60 * 60 * 1000;

export const MEMBERSHIP_APPLICATION_POLICY_CODES = {
  EMAIL_UNAVAILABLE: 'MEMBERSHIP_APPLICATION_EMAIL_UNAVAILABLE',
  CURRENT_APPLICATION: 'MEMBERSHIP_APPLICATION_CURRENT_EXISTS',
  RETRY_LATER: 'MEMBERSHIP_APPLICATION_RETRY_LATER',
} as const;

export class MembershipApplicationPolicy {
  static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  static async assertEmailAvailableForApplication(
    email: string,
    options: {
      excludeApplicationId?: string;
      allowExistingCurrent?: boolean;
      skipHistoricalLimits?: boolean;
      session?: ClientSession;
    } = {}
  ): Promise<void> {
    const normalized = this.normalizeEmail(email);
    const [userIdentity, approvedProvenance] = await Promise.all([
      User.findOne({ email: normalized })
        .session(options.session ?? null)
        .select('accountKind administratorDesignation membershipStatus')
        .lean(),
      MembershipApplication.exists({
        verifiedEmail: normalized,
        status: MemberApplicationStatus.APPROVED,
        approvedUserId: { $exists: true },
      }).session(options.session ?? null),
    ]);
    const reusableIdentity =
      userIdentity?.accountKind === AccountKind.PERSON &&
      userIdentity.administratorDesignation !== true &&
      userIdentity.membershipStatus === MembershipStatus.INACTIVE;
    if ((userIdentity && !reusableIdentity) || approvedProvenance) {
      throw new AppError(
        'This email cannot start a membership application',
        409,
        MEMBERSHIP_APPLICATION_POLICY_CODES.EMAIL_UNAVAILABLE
      );
    }

    const currentFilter: Record<string, unknown> = {
      verifiedEmail: normalized,
      status: {
        $in: [MemberApplicationStatus.DRAFT, MemberApplicationStatus.PENDING],
      },
    };
    if (options.excludeApplicationId)
      currentFilter._id = { $ne: options.excludeApplicationId };
    const current = await MembershipApplication.findOne(currentFilter)
      .session(options.session ?? null)
      .select('_id')
      .lean();
    if (current && !options.allowExistingCurrent) {
      throw new AppError(
        'A current membership application already exists',
        409,
        MEMBERSHIP_APPLICATION_POLICY_CODES.CURRENT_APPLICATION
      );
    }

    if (options.skipHistoricalLimits) return;

    const now = Date.now();
    const [invalidTerminal, latestRejected, latestWithdrawn] =
      await Promise.all([
        MembershipApplication.exists({
          verifiedEmail: normalized,
          $or: [
            {
              status: MemberApplicationStatus.REJECTED,
              rejectedAt: { $exists: false },
            },
            { status: MemberApplicationStatus.REJECTED, rejectedAt: null },
            {
              status: MemberApplicationStatus.WITHDRAWN,
              withdrawnAt: { $exists: false },
            },
            { status: MemberApplicationStatus.WITHDRAWN, withdrawnAt: null },
          ],
        }).session(options.session ?? null),
        MembershipApplication.findOne({
          verifiedEmail: normalized,
          status: MemberApplicationStatus.REJECTED,
        })
          .session(options.session ?? null)
          .sort({ rejectedAt: -1 })
          .select('rejectedAt')
          .lean(),
        MembershipApplication.findOne({
          verifiedEmail: normalized,
          status: MemberApplicationStatus.WITHDRAWN,
        })
          .session(options.session ?? null)
          .sort({ withdrawnAt: -1 })
          .select('withdrawnAt')
          .lean(),
      ]);
    if (invalidTerminal) {
      throw AppError.internal(
        'Membership Application terminal timestamp is invalid'
      );
    }
    const latestTerminalAt = [
      latestRejected?.rejectedAt,
      latestWithdrawn?.withdrawnAt,
    ]
      .filter((value): value is Date => value instanceof Date)
      .sort((left, right) => right.getTime() - left.getTime())[0];
    if (latestTerminalAt && latestTerminalAt.getTime() > now - DAY_MS) {
      throw new AppError(
        'A new application cannot be started yet',
        429,
        MEMBERSHIP_APPLICATION_POLICY_CODES.RETRY_LATER
      );
    }

    const recentCount = await MembershipApplication.countDocuments({
      verifiedEmail: normalized,
      createdAt: { $gte: new Date(now - 30 * DAY_MS) },
    }).session(options.session ?? null);
    if (recentCount >= 3) {
      throw new AppError(
        'The application creation limit has been reached',
        429,
        MEMBERSHIP_APPLICATION_POLICY_CODES.RETRY_LATER
      );
    }
  }

  static async findAccessibleApplication(email: string) {
    const normalized = this.normalizeEmail(email);
    const active = await MembershipApplication.findOne({
      verifiedEmail: normalized,
      status: {
        $in: [MemberApplicationStatus.DRAFT, MemberApplicationStatus.PENDING],
      },
    })
      .sort({ createdAt: -1 })
      .lean();
    if (active) return active;
    return MembershipApplication.findOne({
      verifiedEmail: normalized,
      status: {
        $in: [
          MemberApplicationStatus.APPROVED,
          MemberApplicationStatus.REJECTED,
        ],
      },
    })
      .sort({ createdAt: -1 })
      .lean();
  }
}
