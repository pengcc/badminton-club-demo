import { createHash } from 'node:crypto';
import mongoose, { Types, type ClientSession } from 'mongoose';
import {
  AccountOnboardingStatus,
  AccountKind,
  Capability,
  MembershipStatus,
  PlayerType,
} from '@club/shared-types/core/enums';
import {
  AccountOnboardingTargetKind,
  type AccountOnboardingPlayerState,
  type AccountOnboardingUserState,
  type EstablishAccountCommand,
  type EstablishAccountResult,
} from '@club/shared-types/domain/accountOnboarding';
import {
  MembershipLifecycleOperation,
  type MembershipLifecycleResult,
} from '@club/shared-types/domain/membershipLifecycle';
import {
  AccountOnboardingOperation,
  AccountOnboardingOperationStatus,
  type AccountOnboardingOperationResultRecord,
} from '../models/AccountOnboardingOperation';
import { Player, type IPlayer } from '../models/Player';
import { User, type IUser } from '../models/User';
import { AppError } from '../utils/errors';
import { planAccountEstablishment } from './accountOnboardingPolicy';
import { membershipLifecycleService } from './membershipLifecycleService';
import { PasswordSetupDeliveryService } from './passwordSetupDeliveryService';
import { PasswordSetupService } from './passwordSetupService';

export interface AccountEstablishmentCoreResult
  extends AccountOnboardingOperationResultRecord {
  identityMode:
    | 'create'
    | 'reuse_member'
    | 'reuse_applicant'
    | 'reuse_external_player';
  setupToken?: string;
}

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

function operationFingerprint(command: EstablishAccountCommand): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        identity: {
          ...command.identity,
          email: normalizedEmail(command.identity.email),
        },
        targetKind: command.targetKind,
        establishPlayer: command.establishPlayer,
        initialMembershipStatus:
          command.targetKind === AccountOnboardingTargetKind.MEMBER
            ? command.initialMembershipStatus
            : undefined,
        membershipType:
          command.targetKind === AccountOnboardingTargetKind.MEMBER
            ? command.membershipType
            : undefined,
        setupLocale: command.setupLocale ?? 'de',
        sendPasswordSetupEmailNow:
          command.targetKind === AccountOnboardingTargetKind.MEMBER &&
          command.source.kind === 'administrator'
            ? (command.sendPasswordSetupEmailNow ?? false)
            : undefined,
        actorId: command.actor.id,
        source: command.source,
      })
    )
    .digest('hex');
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}

function normalizeResultRecord(
  result: AccountOnboardingOperationResultRecord
): AccountOnboardingOperationResultRecord {
  return {
    userId: result.userId,
    ...(result.playerId ? { playerId: result.playerId } : {}),
    targetKind: result.targetKind,
    setupRequired: result.setupRequired,
    setupGeneration: result.setupGeneration,
  };
}

function toUserState(user: IUser): AccountOnboardingUserState {
  if (user.accountKind === AccountKind.SUPER_ADMIN) {
    return {
      id: user._id.toString(),
      email: user.email,
      accountKind: AccountKind.SUPER_ADMIN,
      administratorDesignation: false,
      accountOnboardingStatus: user.accountOnboardingStatus,
    };
  }
  if (!user.firstName || !user.lastName || !user.dateOfBirth || !user.gender) {
    throw AppError.internal(
      'Person account is missing required identity facts'
    );
  }

  return {
    id: user._id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    dateOfBirth: user.dateOfBirth,
    gender: user.gender,
    phone: user.phone,
    address: user.address,
    accountKind: AccountKind.PERSON,
    administratorDesignation: user.administratorDesignation,
    membershipStatus: user.membershipStatus!,
    membershipType: user.membershipType,
    accountOnboardingStatus: user.accountOnboardingStatus,
  };
}

function toPlayerState(
  player: IPlayer | null
): AccountOnboardingPlayerState | null {
  return player
    ? {
        id: player._id.toString(),
        type: player.type,
        isActivePlayer: player.isActivePlayer,
      }
    : null;
}

export class AccountEstablishmentCore {
  async executeInSession(
    command: EstablishAccountCommand,
    session: ClientSession
  ): Promise<AccountEstablishmentCoreResult> {
    return this.execute(command, session, 'automatic');
  }

  async executeDirectInSession(
    command: EstablishAccountCommand,
    session: ClientSession
  ): Promise<AccountEstablishmentCoreResult> {
    return this.execute(
      command,
      session,
      command.targetKind === AccountOnboardingTargetKind.EXTERNAL_PLAYER
        ? 'automatic'
        : command.sendPasswordSetupEmailNow
          ? 'issue'
          : 'defer'
    );
  }

  async executeLegacyImportInSession(
    command: EstablishAccountCommand,
    session: ClientSession
  ): Promise<AccountEstablishmentCoreResult> {
    return this.execute(command, session, 'none');
  }

  private async execute(
    command: EstablishAccountCommand,
    session: ClientSession,
    setupMode: 'automatic' | 'issue' | 'defer' | 'none'
  ): Promise<AccountEstablishmentCoreResult> {
    const email = normalizedEmail(command.identity.email);
    let user = await User.findOne({ email }).session(session);
    let player = user
      ? await Player.findOne({ userId: user._id }).session(session)
      : null;
    const decision = planAccountEstablishment(
      command,
      user ? toUserState(user) : null,
      toPlayerState(player)
    );

    if (decision.kind !== 'establish') {
      throw AppError.conflict(
        decision.kind === 'review_required'
          ? 'Account establishment requires administrator review'
          : 'Account establishment is incompatible with current state',
        { outcome: decision.kind }
      );
    }

    if (!user) {
      [user] = await User.create(
        [
          {
            ...command.identity,
            email,
            accountKind: AccountKind.PERSON,
            administratorDesignation: false,
            membershipType:
              command.targetKind === AccountOnboardingTargetKind.MEMBER
                ? command.membershipType
                : undefined,
            membershipStatus: MembershipStatus.INACTIVE,
            accountOnboardingStatus:
              AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
            isPlayer: false,
          },
        ],
        { session }
      );
    } else if (
      command.targetKind === AccountOnboardingTargetKind.MEMBER &&
      user.membershipType !== command.membershipType
    ) {
      const update: Record<string, unknown> = {
        $set: { membershipType: command.membershipType },
        $inc: { __v: 1 },
      };
      const write = await User.updateOne(
        {
          _id: user._id,
          __v: user.get('__v') ?? 0,
          accountKind: AccountKind.PERSON,
          membershipStatus: user.membershipStatus,
        },
        update,
        { runValidators: true, session }
      );
      if (write.matchedCount !== 1) {
        throw AppError.conflict(
          'Account identity changed during establishment'
        );
      }
      user = await User.findById(user._id).session(session);
      if (!user) {
        throw AppError.conflict(
          'Account identity changed during establishment'
        );
      }
    }

    let lifecycleResult: MembershipLifecycleResult | undefined;
    const occurredAt = new Date();
    if (decision.membershipTransition) {
      lifecycleResult = await membershipLifecycleService.executeInSession(
        {
          operation: MembershipLifecycleOperation.TRANSITION_MEMBERSHIP,
          userId: user._id.toString(),
          expectedMembershipStatus: decision.membershipTransition.from,
          targetMembershipStatus: decision.membershipTransition.to,
          convertExternalPlayerToMember:
            decision.membershipTransition.convertExternalPlayerToMember,
          actor: command.actor,
          reason: 'Establish Member account',
          idempotencyKey: `${command.idempotencyKey}:membership`,
          occurredAt,
        },
        session
      );
    }
    if (decision.playerEligibility) {
      lifecycleResult = await membershipLifecycleService.executeInSession(
        {
          operation: MembershipLifecycleOperation.SET_PLAYER_ELIGIBILITY,
          userId: user._id.toString(),
          expectedMembershipStatus:
            lifecycleResult?.membershipStatus ?? user.membershipStatus,
          eligible: true,
          playerTypeForCreation: decision.playerEligibility.type,
          actor: command.actor,
          reason: 'Establish Player eligibility',
          idempotencyKey: `${command.idempotencyKey}:player`,
          occurredAt,
        },
        session
      );
    }

    player = await Player.findOne({ userId: user._id }).session(session);
    if (command.establishPlayer) {
      const expectedType =
        command.targetKind === AccountOnboardingTargetKind.MEMBER
          ? PlayerType.MEMBER
          : PlayerType.EXTERNAL;
      if (!player || player.type !== expectedType || !player.isActivePlayer) {
        throw AppError.internal(
          'Player establishment did not realize the requested outcome'
        );
      }
    }

    const setupIssueRequired =
      decision.setupRequired &&
      (setupMode === 'issue' ||
        (setupMode === 'automatic' &&
          (decision.identityMode === 'create' ||
            decision.identityMode === 'reuse_applicant')));
    const setup = setupIssueRequired
      ? setupMode === 'issue'
        ? await PasswordSetupDeliveryService.issueForDirectOnboardingInSession(
            user._id.toString(),
            command.setupLocale ?? 'de',
            session
          )
        : await PasswordSetupService.issue(user._id.toString(), session, {
            locale: command.setupLocale ?? 'de',
          })
      : setupMode === 'defer' && decision.setupRequired
        ? {
            generation: await PasswordSetupService.retainLocaleForFutureIssue(
              user._id.toString(),
              command.setupLocale ?? 'de',
              session
            ),
            token: undefined,
          }
        : {
            generation: user.passwordSetupGeneration ?? 0,
            token: undefined,
          };

    return {
      userId: user._id.toString(),
      ...(player ? { playerId: player._id.toString() } : {}),
      targetKind: command.targetKind,
      identityMode: decision.identityMode,
      setupRequired: decision.setupRequired,
      setupGeneration: setup.generation,
      setupToken: setup.token,
    };
  }
}

interface SourceOwnedEstablishmentResult {
  committed: AccountOnboardingOperationResultRecord;
  setupToken?: string;
  replayed: boolean;
}

async function executeSourceOwnedEstablishment(
  command: EstablishAccountCommand,
  executeCore: (
    command: EstablishAccountCommand,
    session: ClientSession
  ) => Promise<AccountEstablishmentCoreResult>
): Promise<SourceOwnedEstablishmentResult> {
  const normalizedCommand = {
    ...command,
    identity: {
      ...command.identity,
      email: normalizedEmail(command.identity.email),
    },
    idempotencyKey: command.idempotencyKey.trim(),
  } as EstablishAccountCommand;
  const intentFingerprint = operationFingerprint(normalizedCommand);
  let committed: AccountOnboardingOperationResultRecord | undefined;
  let setupToken: string | undefined;
  let replayed = false;
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const existing = await AccountOnboardingOperation.findOne({
        idempotencyKey: normalizedCommand.idempotencyKey,
      }).session(session);
      if (existing) {
        if (
          existing.intentFingerprint !== intentFingerprint ||
          existing.status !== AccountOnboardingOperationStatus.COMPLETED ||
          !existing.result
        ) {
          throw AppError.conflict(
            'Account Onboarding key conflicts with an existing intent'
          );
        }
        committed = normalizeResultRecord(existing.result);
        replayed = true;
        return;
      }

      await AccountOnboardingOperation.create(
        [
          {
            idempotencyKey: normalizedCommand.idempotencyKey,
            intentFingerprint,
            actorId: new Types.ObjectId(normalizedCommand.actor.id),
            sourceKind: normalizedCommand.source.kind,
            sourceReference: normalizedCommand.source.reference,
            normalizedEmail: normalizedCommand.identity.email,
            targetKind: normalizedCommand.targetKind,
            status: AccountOnboardingOperationStatus.PENDING,
          },
        ],
        { session }
      );

      const coreResult = await executeCore(normalizedCommand, session);
      setupToken = coreResult.setupToken;
      committed = normalizeResultRecord({
        userId: coreResult.userId,
        playerId: coreResult.playerId,
        targetKind: coreResult.targetKind,
        setupRequired: coreResult.setupRequired,
        setupGeneration: coreResult.setupGeneration,
      });
      const completed = await AccountOnboardingOperation.updateOne(
        {
          idempotencyKey: normalizedCommand.idempotencyKey,
          status: AccountOnboardingOperationStatus.PENDING,
        },
        {
          $set: {
            status: AccountOnboardingOperationStatus.COMPLETED,
            result: committed,
          },
        },
        { session }
      );
      if (completed.matchedCount !== 1) {
        throw AppError.conflict('Account Onboarding completion state changed');
      }
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    const existing = await AccountOnboardingOperation.findOne({
      idempotencyKey: normalizedCommand.idempotencyKey,
    }).lean();
    if (
      existing?.status === AccountOnboardingOperationStatus.COMPLETED &&
      existing.intentFingerprint === intentFingerprint &&
      existing.result
    ) {
      committed = normalizeResultRecord(existing.result);
      replayed = true;
    } else {
      throw AppError.conflict(
        'Account Onboarding conflicts with an existing identity or intent'
      );
    }
  } finally {
    await session.endSession();
  }

  if (!committed) {
    throw AppError.internal(
      'Account Onboarding transaction produced no result'
    );
  }

  return { committed, setupToken, replayed };
}

export class AccountOnboardingService {
  constructor(
    private readonly core: AccountEstablishmentCore = new AccountEstablishmentCore()
  ) {}

  async establish(
    command: EstablishAccountCommand
  ): Promise<EstablishAccountResult> {
    if (
      command.source.kind !== 'administrator' ||
      command.idempotencyKey.trim().length < 8 ||
      !Types.ObjectId.isValid(command.actor.id)
    ) {
      throw AppError.badRequest('Invalid direct Account Onboarding command');
    }
    const { committed, setupToken, replayed } =
      await executeSourceOwnedEstablishment(
        command,
        this.core.executeDirectInSession.bind(this.core)
      );

    if (setupToken) {
      await PasswordSetupDeliveryService.deliver(
        committed.userId,
        committed.setupGeneration,
        setupToken
      );
    }
    const deliveryRequested =
      committed.setupRequired &&
      (command.targetKind === AccountOnboardingTargetKind.EXTERNAL_PLAYER ||
        command.sendPasswordSetupEmailNow === true);
    return {
      ...committed,
      ...(deliveryRequested
        ? {
            deliveryStatus:
              await PasswordSetupDeliveryService.statusForGeneration(
                committed.userId,
                committed.setupGeneration
              ),
          }
        : {}),
      replayed,
    };
  }
}

export class LegacyImportOnboardingService {
  constructor(
    private readonly core: AccountEstablishmentCore = new AccountEstablishmentCore()
  ) {}

  async establish(
    command: EstablishAccountCommand
  ): Promise<EstablishAccountResult> {
    if (
      command.source.kind !== 'legacy_import' ||
      command.targetKind !== AccountOnboardingTargetKind.MEMBER ||
      command.initialMembershipStatus !== MembershipStatus.ACTIVE ||
      command.establishPlayer ||
      !command.actor.capabilities.includes(Capability.ADMINISTRATION) ||
      command.idempotencyKey.trim().length < 8 ||
      !Types.ObjectId.isValid(command.actor.id)
    ) {
      throw AppError.badRequest(
        'Invalid legacy import Account Onboarding command'
      );
    }

    const { committed, replayed } = await executeSourceOwnedEstablishment(
      command,
      this.core.executeLegacyImportInSession.bind(this.core)
    );

    return {
      ...committed,
      replayed,
    };
  }
}

export const accountEstablishmentCore = new AccountEstablishmentCore();
export const accountOnboardingService = new AccountOnboardingService(
  accountEstablishmentCore
);
export const legacyImportOnboardingService = new LegacyImportOnboardingService(
  accountEstablishmentCore
);
