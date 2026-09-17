import type { Request, Response, NextFunction } from 'express';
import type { FilterQuery } from 'mongoose';
import { User } from '../models/User';
import { Player } from '../models/Player';
import { Team } from '../models/Team';
import type { IUser } from '../models/User';
import type { AuthenticatedRequest } from '../middleware/auth';
import {
  AccountKind,
  MembershipStatus,
  MemberListFilter,
  Gender,
  AuditEventType,
  EntityType,
  PlayerType,
  Capability,
} from '@club/shared-types/core/enums';
import { MembershipLifecycleOperation } from '@club/shared-types/domain/membershipLifecycle';
import { AppError } from '../utils/errors';
import { ResponseHelper } from '../utils/controllerHelpers';
import { UserService } from '../services/userService';
import { AuditService } from '../services/auditService';
import { membershipLifecycleService } from '../services/membershipLifecycleService';
import { PasswordSetupDeliveryService } from '../services/passwordSetupDeliveryService';
import { accountOnboardingService } from '../services/accountOnboardingService';
import { AccountOnboardingTargetKind } from '@club/shared-types/domain/accountOnboarding';
import type { Api } from '@club/shared-types/api/user';
import type { AccountEstablishmentRequest } from '@club/shared-types/api/accountOnboarding';
import {
  UserPersistenceTransformer,
  UserApiTransformer,
} from '../transformers/user';
import { EMAIL_CHANGE_EMAIL_TEMPLATES } from '../services/emailContracts/emailChange';
import { AccountDeletionService } from '../services/accountDeletionService';
import { AccountAccessService } from '../services/accountAccessService';
import { PasswordRecoveryService } from '../services/passwordRecoveryService';
import { DemoRuntimePolicyService } from '../services/demoRuntimePolicyService';

// Controller-specific types
interface MemberStatisticsAggregation {
  summary: Array<{
    male: number;
    female: number;
    other: number;
    missing: number;
    missingBirthDate: number;
  }>;
  birthYears: Array<{
    _id: number;
    male: number;
    female: number;
    other: number;
    missing: number;
  }>;
}

function lifecycleActor(req: AuthenticatedRequest) {
  return {
    id: req.user.id,
    email: req.user.email,
    accountKind: req.user.accountKind,
    displayName: req.user.displayName,
    capabilities: req.user.capabilities,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };
}

function lifecycleIdempotencyKey(
  req: AuthenticatedRequest,
  operation: string,
  subjectId: string
): string {
  const supplied = req.get('idempotency-key');
  if (!supplied?.trim()) {
    throw AppError.validation(
      'Idempotency-Key header is required for membership lifecycle changes'
    );
  }
  return `${supplied.trim()}:${operation}:${subjectId}`;
}

const MEMBER_FILTER_STATUS: Partial<
  Record<MemberListFilter, MembershipStatus>
> = {
  [MemberListFilter.ACTIVE]: MembershipStatus.ACTIVE,
  [MemberListFilter.PASSIVE]: MembershipStatus.PASSIVE,
  [MemberListFilter.INACTIVE]: MembershipStatus.INACTIVE,
};

const SUPPORTED_MEMBERSHIP_STATUSES = [
  MembershipStatus.ACTIVE,
  MembershipStatus.PASSIVE,
  MembershipStatus.INACTIVE,
];

const GENERIC_MEMBERSHIP_STATUSES = new Set<MembershipStatus>([
  MembershipStatus.ACTIVE,
  MembershipStatus.PASSIVE,
]);

function escapeSearchPattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function withGenderFilter(
  filter: FilterQuery<IUser>,
  gender?: Api.MemberGenderFilter
): FilterQuery<IUser> {
  if (!gender) return filter;
  return {
    ...filter,
    gender: gender === 'missing' ? { $in: [null, ''] } : gender,
  };
}

export function buildMemberListFilter(
  appliedFilter: MemberListFilter,
  search?: string,
  activeExternalPlayerUserIds: readonly string[] = [],
  administratorOnly = false
): FilterQuery<IUser> {
  const filter: FilterQuery<IUser> = {
    accountKind: AccountKind.PERSON,
  };
  if (activeExternalPlayerUserIds.length > 0) {
    filter._id = { $nin: activeExternalPlayerUserIds };
  }
  if (administratorOnly) {
    filter.administratorDesignation = true;
  }

  if (appliedFilter === MemberListFilter.CURRENT) {
    filter.membershipStatus = {
      $in: [MembershipStatus.ACTIVE, MembershipStatus.PASSIVE],
    };
  } else if (appliedFilter === MemberListFilter.ALL) {
    filter.membershipStatus = { $in: SUPPORTED_MEMBERSHIP_STATUSES };
  } else {
    filter.membershipStatus = MEMBER_FILTER_STATUS[appliedFilter];
  }

  if (search) {
    const pattern = new RegExp(escapeSearchPattern(search), 'i');
    filter.$or = [
      { firstName: pattern },
      { lastName: pattern },
      { email: pattern },
    ];
  }

  return filter;
}

async function getMemberListStatistics(
  filter: FilterQuery<IUser>,
  total: number
): Promise<Api.MemberListStatistics> {
  const [result] = await User.aggregate<MemberStatisticsAggregation>([
    { $match: filter },
    {
      $facet: {
        summary: [
          {
            $group: {
              _id: null,
              male: {
                $sum: { $cond: [{ $eq: ['$gender', Gender.MALE] }, 1, 0] },
              },
              female: {
                $sum: { $cond: [{ $eq: ['$gender', Gender.FEMALE] }, 1, 0] },
              },
              other: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ['$gender', null] },
                        { $ne: ['$gender', ''] },
                        {
                          $not: [
                            { $in: ['$gender', [Gender.MALE, Gender.FEMALE]] },
                          ],
                        },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              missing: {
                $sum: { $cond: [{ $in: ['$gender', [null, '']] }, 1, 0] },
              },
              missingBirthDate: {
                $sum: { $cond: [{ $in: ['$dateOfBirth', [null, '']] }, 1, 0] },
              },
            },
          },
        ],
        birthYears: [
          { $match: { dateOfBirth: { $type: 'string', $regex: /^\d{4}-/ } } },
          {
            $group: {
              _id: { $toInt: { $substrBytes: ['$dateOfBirth', 0, 4] } },
              male: {
                $sum: { $cond: [{ $eq: ['$gender', Gender.MALE] }, 1, 0] },
              },
              female: {
                $sum: { $cond: [{ $eq: ['$gender', Gender.FEMALE] }, 1, 0] },
              },
              other: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ['$gender', null] },
                        { $ne: ['$gender', ''] },
                        {
                          $not: [
                            { $in: ['$gender', [Gender.MALE, Gender.FEMALE]] },
                          ],
                        },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              missing: {
                $sum: { $cond: [{ $in: ['$gender', [null, '']] }, 1, 0] },
              },
            },
          },
          { $sort: { _id: 1 } },
        ],
      },
    },
  ]);

  const summary = result?.summary[0];
  return {
    total,
    gender: {
      male: summary?.male ?? 0,
      female: summary?.female ?? 0,
      other: summary?.other ?? 0,
      missing: summary?.missing ?? 0,
    },
    birthYears: (result?.birthYears ?? []).map(
      ({ _id, male, female, other, missing }) => ({
        year: _id,
        male,
        female,
        other,
        missing,
      })
    ),
    missingBirthDate: summary?.missingBirthDate ?? 0,
  };
}

export class UserController {
  /**
   * Create new user (admin only)
   */
  static async createUser(
    req: AuthenticatedRequest<AccountEstablishmentRequest>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const idempotencyKey = req.get('Idempotency-Key');
      if (!idempotencyKey) {
        throw AppError.badRequest('Idempotency-Key header is required');
      }
      const intent =
        req.body.targetKind === AccountOnboardingTargetKind.MEMBER
          ? {
              targetKind: AccountOnboardingTargetKind.MEMBER,
              establishPlayer: req.body.establishPlayer,
              initialMembershipStatus: req.body.initialMembershipStatus,
              membershipType: req.body.membershipType,
              sendPasswordSetupEmailNow: req.body.sendPasswordSetupEmailNow,
            }
          : {
              targetKind: AccountOnboardingTargetKind.EXTERNAL_PLAYER,
              establishPlayer: true as const,
            };
      const result = await accountOnboardingService.establish({
        identity: {
          email: req.body.email,
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          phone: req.body.phone,
          gender: req.body.gender,
          dateOfBirth: req.body.dateOfBirth,
          address: req.body.address,
        },
        ...intent,
        actor: lifecycleActor(req),
        source: { kind: 'administrator' },
        idempotencyKey,
        setupLocale: req.body.setupLocale,
      });

      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all users with filtering and pagination
   */
  static async getAllUsers(
    req: AuthenticatedRequest,
    res: Response,
    _next: NextFunction
  ): Promise<void> {
    const {
      page = 1,
      limit = 10,
      sort = 'lastName',
      order = 'asc',
      search,
      membershipStatus,
      isPlayer,
    } = req.query as any;

    // Build filter query
    const filter: Record<string, any> = { accountKind: AccountKind.PERSON };
    if (search) {
      filter.$or = [
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
      ];
    }
    if (membershipStatus) filter.membershipStatus = membershipStatus;
    const parseBoolean = (value: unknown): boolean | undefined => {
      if (value === 'true') return true;
      if (value === 'false') return false;
      if (typeof value === 'boolean') return value;
      return undefined;
    };
    const parsedIsPlayer = parseBoolean(isPlayer);
    if (parsedIsPlayer !== undefined) {
      filter.isPlayer = parsedIsPlayer;
    }

    // Execute paginated query
    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find(filter)
        .sort({ [sort]: order })
        .skip(skip)
        .limit(Number(limit))
        .exec(),
      User.countDocuments(filter),
    ]);

    // Transform to API responses
    const apiUsers = users.map((user) => {
      const domainUser = UserPersistenceTransformer.toDomain(user as any);
      return UserApiTransformer.toApi(domainUser);
    });

    ResponseHelper.success(res, {
      data: apiUsers,
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit)),
    });
  }

  /**
   * Get single user by ID
   */
  static async getUserById(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    const user = await User.findById(req.params.id);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Check if user has permission to view
    if (
      !req.user.capabilities.includes(Capability.ADMINISTRATION) &&
      req.user.id !== user.id
    ) {
      throw new AppError('Not authorized to view this user', 403);
    }

    const domainUser = UserPersistenceTransformer.toDomain(user as any);
    const apiResponse = UserApiTransformer.toApi(domainUser);
    ResponseHelper.success(res, apiResponse);
  }

  /**
   * Update user information
   */
  static async updateUser(
    req: AuthenticatedRequest<Api.UpdateUserRequest>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const profileUpdates = req.body;
      const user = await UserService.updatePersonProfile(
        req.params.id as string,
        profileUpdates
      );

      if (Object.keys(profileUpdates).length > 0) {
        AuditService.writeBestEffort({
          eventType: AuditEventType.USER_UPDATED,
          entityType: EntityType.USER,
          entityId: (user._id as any).toString(),
          actor: {
            id: req.user.id,
            accountKind: req.user.accountKind,
          },
          changes: Object.keys(profileUpdates).map((field) => ({ field })),
        });
      }

      const domainUser = UserPersistenceTransformer.toDomain(user as any);
      const apiResponse = UserApiTransformer.toApi(domainUser);
      ResponseHelper.success(res, apiResponse);
    } catch (error) {
      next(error);
    }
  }

  static async setAdministratorDesignation(
    req: AuthenticatedRequest<{ designated: boolean }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const current = await User.findById(req.params.id);
      if (!current) throw AppError.notFound('User not found');
      if (current.accountKind !== AccountKind.PERSON) {
        throw AppError.conflict(
          'Super Admin is not an ordinary administrator designation target'
        );
      }
      if (
        req.body.designated &&
        ![MembershipStatus.ACTIVE, MembershipStatus.PASSIVE].includes(
          current.membershipStatus!
        )
      ) {
        throw AppError.conflict(
          'Administrator designation requires a current Membership'
        );
      }

      const updated = await User.findOneAndUpdate(
        {
          _id: current._id,
          accountKind: AccountKind.PERSON,
          membershipStatus: current.membershipStatus,
          administratorDesignation: current.administratorDesignation,
        },
        {
          $set: { administratorDesignation: req.body.designated },
          $inc: { __v: 1 },
        },
        { new: true, runValidators: true }
      );
      if (!updated)
        throw AppError.conflict(
          'Account state changed before designation could be updated'
        );

      AuditService.writeBestEffort({
        eventType: AuditEventType.USER_UPDATED,
        entityType: EntityType.USER,
        entityId: updated._id.toString(),
        actor: { id: req.user.id, accountKind: req.user.accountKind },
        changes: [
          {
            field: 'administratorDesignation',
            oldValue: current.administratorDesignation,
            newValue: updated.administratorDesignation,
          },
        ],
      });
      ResponseHelper.success(
        res,
        UserApiTransformer.toApi(
          UserPersistenceTransformer.toDomain(updated as any)
        )
      );
    } catch (error) {
      next(error);
    }
  }

  static async suspendAccount(
    req: AuthenticatedRequest<{ reason: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const updated = await AccountAccessService.suspend({
        userId: req.params.id,
        actor: {
          id: req.user.id,
          accountKind: req.user.accountKind,
        },
        reason: req.body.reason,
        occurredAt: new Date(),
      });
      ResponseHelper.success(
        res,
        UserApiTransformer.toApi(
          UserPersistenceTransformer.toDomain(updated as any)
        ),
        'Account suspended successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  static async transitionMembershipActivity(
    req: AuthenticatedRequest<{
      targetStatus: MembershipStatus.ACTIVE | MembershipStatus.PASSIVE;
      reason: string;
    }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await User.findById(req.params.id);
      if (!user) throw AppError.notFound('User not found');
      if (user.accountKind !== AccountKind.PERSON) {
        throw AppError.validation('Super Admin has no Membership lifecycle');
      }
      if (!GENERIC_MEMBERSHIP_STATUSES.has(user.membershipStatus)) {
        throw AppError.validation(
          'Only active or passive membership can change activity classification'
        );
      }

      const expectedStatus =
        user.membershipStatus === req.body.targetStatus
          ? req.body.targetStatus === MembershipStatus.ACTIVE
            ? MembershipStatus.PASSIVE
            : MembershipStatus.ACTIVE
          : user.membershipStatus;

      await membershipLifecycleService.execute({
        operation: MembershipLifecycleOperation.TRANSITION_MEMBERSHIP,
        userId: user._id.toString(),
        expectedMembershipStatus: expectedStatus,
        targetMembershipStatus: req.body.targetStatus,
        actor: lifecycleActor(req),
        reason: req.body.reason,
        idempotencyKey: lifecycleIdempotencyKey(
          req,
          'membership-activity',
          user._id.toString()
        ),
        occurredAt: new Date(),
      });

      const updated = await User.findById(user._id);
      if (!updated) throw AppError.notFound('User not found');
      ResponseHelper.success(
        res,
        UserApiTransformer.toApi(
          UserPersistenceTransformer.toDomain(updated as any)
        ),
        'Membership activity classification updated successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  static async unsuspendAccount(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const updated = await AccountAccessService.unsuspend({
        userId: req.params.id,
        actor: {
          id: req.user.id,
          accountKind: req.user.accountKind,
        },
      });
      ResponseHelper.success(
        res,
        UserApiTransformer.toApi(
          UserPersistenceTransformer.toDomain(updated as any)
        ),
        'Account unsuspended successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete user
   */
  static async deleteUser(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await AccountDeletionService.deleteAccount({
        userId: req.params.id,
        reason: req.body.reason,
        actor: lifecycleActor(req),
      });

      ResponseHelper.success(res, null, 'Account permanently deleted');
    } catch (error) {
      next(error);
    }
  }

  /** Reissue the canonical password-setup link (admin only). */
  static async sendInvitation(
    req: Request<{ id: string }>,
    res: Response
  ): Promise<void> {
    const result = await PasswordSetupDeliveryService.reissueForUser(
      req.params.id
    );
    ResponseHelper.success(res, result, 'Password setup reissued');
  }

  /**
   * Get users with filters (admin only)
   * @route GET /api/users/filter
   * @access Private/Admin
   */
  static async getMemberList(req: Request, res: Response): Promise<void> {
    const demoPortfolio = DemoRuntimePolicyService.isDemoAdmin(
      (req as AuthenticatedRequest).user
    );
    const query = (res.locals.validatedQuery ?? req.query) as Required<
      Pick<Api.MemberListQuery, 'filter' | 'page' | 'pageSize'>
    > &
      Pick<Api.MemberListQuery, 'search' | 'gender' | 'administratorOnly'>;
    const {
      filter: appliedFilter = MemberListFilter.CURRENT,
      search,
      gender,
      administratorOnly,
      page = 1,
      pageSize = 20,
    } = query;
    const activeExternalPlayerUserIds = await Player.distinct('userId', {
      type: PlayerType.EXTERNAL,
      isActivePlayer: true,
    });
    const memberBaseFilter = buildMemberListFilter(
      appliedFilter,
      search,
      activeExternalPlayerUserIds.map(String),
      administratorOnly
    );
    const memberFilter = withGenderFilter(memberBaseFilter, gender);
    const skip = (page - 1) * pageSize;

    const users = await User.find(memberFilter)
      .select('-password')
      .skip(skip)
      .limit(pageSize)
      .sort({ lastName: 1, firstName: 1, _id: 1 });

    const [total, genderFilterTotal] = await Promise.all([
      User.countDocuments(memberFilter),
      User.countDocuments(memberBaseFilter),
    ]);
    const [statistics, genderFilterStatistics] = await Promise.all([
      getMemberListStatistics(memberFilter, total),
      getMemberListStatistics(memberBaseFilter, genderFilterTotal),
    ]);
    const [setupSummaries, recoveryAvailability] = demoPortfolio
      ? [new Map<string, never>(), new Map<string, never>()]
      : await Promise.all([
          PasswordSetupDeliveryService.setupSummariesForUsers(users as any),
          PasswordRecoveryService.availabilityForUsers(users as any),
        ]);

    // Transform users to API format
    const apiUsers = users.map((user) => {
      const domainUser = UserPersistenceTransformer.toDomain(user as any);
      if (domainUser.accountKind !== AccountKind.PERSON) {
        throw AppError.internal('Member list contained a non-person account');
      }
      if (demoPortfolio) {
        return UserApiTransformer.toApi(
          domainUser
        ) as Api.AdministratorUserResponse;
      }
      const accountSetup = setupSummaries.get(user._id.toString());
      if (!accountSetup) {
        throw AppError.internal('Account setup projection is unavailable');
      }
      return {
        ...UserApiTransformer.toApi(domainUser),
        accountSetup,
        passwordRecoveryAvailable:
          recoveryAvailability.get(user._id.toString()) ?? false,
      } as Api.AdministratorUserResponse;
    });

    res.status(200).json({
      success: true,
      appliedFilter,
      items: apiUsers,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        returned: apiUsers.length,
      },
      statistics,
      genderFilterCounts: genderFilterStatistics.gender,
    } satisfies Api.MemberListResponse);
  }

  /** Bounded Member-only rich CSV source projection. */
  static async getRichMemberExport(
    _req: Request,
    res: Response
  ): Promise<void> {
    const { cohort } = res.locals.validatedQuery as Api.MemberExportQuery;
    const membershipStatuses =
      cohort === 'current'
        ? [MembershipStatus.ACTIVE, MembershipStatus.PASSIVE]
        : [
            MembershipStatus.ACTIVE,
            MembershipStatus.PASSIVE,
            MembershipStatus.INACTIVE,
          ];
    const filter = {
      accountKind: AccountKind.PERSON,
      membershipStatus: { $in: membershipStatuses },
    };
    const users = await User.find(filter).select('-password').sort({
      lastName: 1,
      firstName: 1,
      _id: 1,
    });
    const players = await Player.find({
      userId: { $in: users.map((user) => user._id) },
    });
    const teamIds = [
      ...new Set(players.flatMap((player) => player.teamIds.map(String))),
    ];
    const teams = await Team.find({ _id: { $in: teamIds } }).select(
      'shortName'
    );
    const teamNames = new Map(
      teams.map((team) => [team._id.toString(), team.shortName])
    );
    const playersByUser = new Map(
      players.map((player) => [player.userId.toString(), player])
    );

    res.status(200).json({
      success: true,
      items: users.map((user) => {
        const player = playersByUser.get(user._id.toString());
        return {
          userId: user._id.toString(),
          fullName: `${user.lastName}, ${user.firstName}`,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          gender: user.gender,
          dateOfBirth: user.dateOfBirth,
          address: user.address,
          membershipStatus: user.membershipStatus!,
          membershipType: user.membershipType,
          administratorDesignation: user.administratorDesignation,
          player: player
            ? {
                id: player._id.toString(),
                type: player.type,
                isActivePlayer: player.isActivePlayer,
                singlesRanking: player.singlesRanking,
                doublesRanking: player.doublesRanking,
                teamNames: player.teamIds
                  .map((teamId) => teamNames.get(teamId.toString()))
                  .filter((name): name is string => Boolean(name)),
              }
            : undefined,
        };
      }),
    } satisfies Api.RichMemberExportResponse);
  }

  /**
   * PATCH /users/:id/player-status
   * Toggle user's player status and manage Player entity lifecycle
   * Admin only
   */
  static async togglePlayerStatus(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { isPlayer } = req.body;

      if (typeof isPlayer !== 'boolean') {
        res.status(400).json({
          success: false,
          message: 'isPlayer field is required and must be boolean',
        });
        return;
      }

      const user = await User.findById(id);
      if (!user) throw AppError.notFound('User not found');
      const playerType =
        user.membershipStatus === MembershipStatus.INACTIVE
          ? PlayerType.EXTERNAL
          : PlayerType.MEMBER;
      await membershipLifecycleService.execute({
        operation: MembershipLifecycleOperation.SET_PLAYER_ELIGIBILITY,
        userId: id,
        expectedMembershipStatus: user.membershipStatus,
        eligible: isPlayer,
        playerTypeForCreation: playerType,
        actor: lifecycleActor(req),
        reason: isPlayer
          ? 'Administrative Player eligibility enablement'
          : 'Administrative Player participation deactivation',
        idempotencyKey: lifecycleIdempotencyKey(req, 'player-eligibility', id),
        occurredAt: new Date(),
      });
      const updatedUser = await User.findById(id);
      if (!updatedUser) throw AppError.notFound('User not found');

      // Transform to API response
      const domainUser = UserPersistenceTransformer.toDomain(
        updatedUser as any
      );
      const apiResponse = UserApiTransformer.toApi(domainUser);

      res.status(200).json({
        success: true,
        data: apiResponse,
        message: isPlayer
          ? 'Player eligibility enabled successfully'
          : 'Player participation deactivated successfully',
      });
    } catch (error: any) {
      console.error('Player status update failed', {
        operation: 'update_player_status',
        reasonCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
      });
      throw error;
    }
  }

  /**
   * POST /users/request-email-change
   * Request email change - sends verification email to new address
   * Authenticated users only (can only change their own email)
   */
  static async requestEmailChange(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { newEmail, locale } = req.body;
      const userId = req.user.id;

      if (!newEmail) {
        res.status(400).json({
          success: false,
          message: 'New email address is required',
        });
        return;
      }

      // Generate verification token
      const token = await UserService.requestEmailChange(
        userId,
        newEmail,
        locale
      );

      // Send verification email
      const user = await User.findById(userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      const EmailService = (await import('../services/emailService.js'))
        .default;

      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3002'}/${locale}/verify-email-change/${token}`;

      await EmailService.sendFromTemplate(
        EMAIL_CHANGE_EMAIL_TEMPLATES.VERIFICATION,
        newEmail,
        locale,
        {
          name: `${user.firstName} ${user.lastName}`,
          verificationUrl,
          expiresIn:
            locale === 'zh'
              ? '1 小时'
              : locale === 'en'
                ? '1 hour'
                : '1 Stunde',
        }
      );

      res.status(200).json({
        success: true,
        message: 'Verification email sent to new address',
        data: {
          pendingEmail: newEmail,
        },
      });
    } catch (error: any) {
      console.error('Email change request failed');

      res.status(error.message.includes('not found') ? 404 : 400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * GET /users/verify-email-change/:token
   * Verify email change token and update email
   * Public endpoint (token-based authentication)
   */
  static async verifyEmailChange(
    req: Request<{ token: string }>,
    res: Response
  ): Promise<void> {
    try {
      const { token } = req.params;

      if (!token) {
        res.status(400).json({
          success: false,
          message: 'Verification token is required',
        });
        return;
      }

      // Verify token and update email
      const result = await UserService.verifyEmailChange(token);

      const user = await User.findById(result.userId);
      // Audit log: Email changed
      AuditService.writeBestEffort({
        eventType: AuditEventType.USER_EMAIL_CHANGED,
        entityType: EntityType.USER,
        entityId: result.userId,
        actor: {
          id: result.userId,
          accountKind: user?.accountKind ?? AccountKind.PERSON,
        },
      });

      if (user) {
        const EmailService = (await import('../services/emailService.js'))
          .default;
        try {
          await EmailService.sendFromTemplate(
            EMAIL_CHANGE_EMAIL_TEMPLATES.CONFIRMED,
            result.newEmail,
            result.locale,
            {
              name: `${user.firstName} ${user.lastName}`,
              oldEmail: result.oldEmail,
              newEmail: result.newEmail,
            }
          );
        } catch {
          console.warn('Email change confirmation delivery failed');
        }
      }

      res.status(200).json({
        success: true,
        message: 'Email address successfully updated',
        data: {
          email: result.newEmail,
        },
      });
    } catch (error) {
      console.error('Email change verification failed');

      if (
        error instanceof AppError &&
        (error.statusCode === 400 || error.statusCode === 409)
      ) {
        res.status(error.statusCode).json({
          success: false,
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
      });
    }
  }

  /**
   * POST /users/cancel-email-change
   * Cancel pending email change
   * Authenticated users only
   */
  static async cancelEmailChange(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user.id;

      await UserService.cancelEmailChange(userId);

      res.status(200).json({
        success: true,
        message: 'Email change request cancelled',
      });
    } catch (error: any) {
      console.error('Email change cancellation failed');

      res.status(error.message.includes('not found') ? 404 : 500).json({
        success: false,
        message: error.message,
      });
    }
  }
}
