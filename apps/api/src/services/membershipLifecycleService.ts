import mongoose, { Types, type ClientSession } from 'mongoose';
import { createHash } from 'node:crypto';
import {
  AuditEventType,
  EntityType,
  MembershipStatus,
  PlayerType,
  AccountKind,
} from '@club/shared-types/core/enums';
import {
  MembershipInactivePlayerOutcome,
  MembershipLifecycleOperation,
  membershipLifecycleCommandSchema,
  type MembershipLifecycleCommand,
  type MembershipLifecycleResult,
  type MembershipLifecycleState,
} from '@club/shared-types/domain/membershipLifecycle';
import { AuditService } from './auditService';
import {
  MembershipLifecycleEvent,
  MembershipLifecycleEventStatus,
} from '../models/MembershipLifecycleEvent';
import { Player, type IPlayer } from '../models/Player';
import { User, type IUser } from '../models/User';
import { AppError } from '../utils/errors';
import { planMembershipLifecycleCommand } from './membershipLifecyclePolicy';

export interface LoadedLifecycleState {
  state: MembershipLifecycleState;
  user: IUser;
  player: IPlayer | null;
  userVersion: number;
  playerVersion?: number;
}

export interface LifecycleClaim {
  replay?: MembershipLifecycleResult;
}

export interface MembershipLifecycleRepository {
  claim(
    command: MembershipLifecycleCommand,
    session?: ClientSession
  ): Promise<LifecycleClaim>;
  load(userId: string, session: ClientSession): Promise<LoadedLifecycleState>;
  apply(
    loaded: LoadedLifecycleState,
    result: MembershipLifecycleResult,
    session: ClientSession
  ): Promise<void>;
  audit(
    command: MembershipLifecycleCommand,
    before: MembershipLifecycleState,
    result: MembershipLifecycleResult,
    session: ClientSession
  ): Promise<Types.ObjectId>;
  complete(
    command: MembershipLifecycleCommand,
    result: MembershipLifecycleResult,
    session: ClientSession
  ): Promise<void>;
  fail(command: MembershipLifecycleCommand, error: unknown): Promise<void>;
  withTransaction<T>(
    operation: (session: ClientSession) => Promise<T>
  ): Promise<T>;
}

function serializeResult(
  result: MembershipLifecycleResult
): Record<string, unknown> {
  const serialized: Record<string, unknown> = {
    operation: result.operation,
    idempotencyKey: result.idempotencyKey,
    userId: result.userId,
    membershipStatus: result.membershipStatus,
    player: result.player,
    changedFields: result.changedFields,
    replayed: false,
  };
  if (result.inactivePlayerOutcome) {
    serialized.inactivePlayerOutcome = result.inactivePlayerOutcome;
  }
  return serialized;
}

export function membershipLifecycleCommandFingerprint(
  command: MembershipLifecycleCommand
): string {
  const intent =
    command.operation === MembershipLifecycleOperation.TRANSITION_MEMBERSHIP
      ? {
          targetMembershipStatus: command.targetMembershipStatus,
          convertExternalPlayerToMember:
            command.convertExternalPlayerToMember ?? false,
          inactivePlayerOutcome:
            command.targetMembershipStatus === MembershipStatus.INACTIVE
              ? (command.inactivePlayerOutcome ??
                MembershipInactivePlayerOutcome.END_PARTICIPATION)
              : undefined,
        }
      : command.operation ===
          MembershipLifecycleOperation.SET_PLAYER_ELIGIBILITY
        ? {
            eligible: command.eligible,
            playerTypeForCreation: command.playerTypeForCreation,
          }
        : {
            targetPlayerType: command.targetPlayerType,
            eligible: command.eligible,
          };
  return createHash('sha256')
    .update(
      JSON.stringify({
        operation: command.operation,
        userId: command.userId,
        actorId: command.actor.id,
        reason: command.reason,
        intent,
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

function errorDetails(error: unknown): { code: string; message: string } {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error) {
    return { code: 'LIFECYCLE_EXECUTION_FAILED', message: error.message };
  }
  return {
    code: 'LIFECYCLE_EXECUTION_FAILED',
    message: 'Unknown lifecycle execution failure',
  };
}

export class MongoMembershipLifecycleRepository
  implements MembershipLifecycleRepository
{
  async claim(
    command: MembershipLifecycleCommand,
    session?: ClientSession
  ): Promise<LifecycleClaim> {
    const commandFingerprint = membershipLifecycleCommandFingerprint(command);
    try {
      await MembershipLifecycleEvent.create(
        [
          {
            idempotencyKey: command.idempotencyKey,
            commandFingerprint,
            operation: command.operation,
            userId: new Types.ObjectId(command.userId),
            status: MembershipLifecycleEventStatus.PENDING,
          },
        ],
        session ? { session } : undefined
      );
      return {};
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }

    const existingQuery = MembershipLifecycleEvent.findOne({
      idempotencyKey: command.idempotencyKey,
    });
    if (session) existingQuery.session(session);
    const existing = await existingQuery;
    if (!existing) {
      throw AppError.conflict('Lifecycle command claim could not be resolved');
    }
    if (
      existing.userId.toString() !== command.userId ||
      existing.operation !== command.operation ||
      existing.commandFingerprint !== commandFingerprint
    ) {
      throw AppError.conflict(
        'Idempotency key is already used by another lifecycle command'
      );
    }
    if (
      existing.status === MembershipLifecycleEventStatus.COMPLETED &&
      existing.result
    ) {
      return {
        replay: {
          ...(existing.result as unknown as MembershipLifecycleResult),
          replayed: true,
        },
      };
    }
    if (existing.status === MembershipLifecycleEventStatus.PENDING) {
      throw AppError.conflict('Lifecycle command is already in progress');
    }
    const reclaimed = await MembershipLifecycleEvent.findOneAndUpdate(
      {
        _id: existing._id,
        status: MembershipLifecycleEventStatus.FAILED,
      },
      {
        $set: {
          status: MembershipLifecycleEventStatus.PENDING,
          errorCode: undefined,
          errorMessage: undefined,
          result: undefined,
        },
        $inc: { attemptCount: 1 },
      },
      { new: true, session }
    );
    if (!reclaimed) {
      throw AppError.conflict('Lifecycle command retry raced another request');
    }
    return {};
  }

  async load(
    userId: string,
    session: ClientSession
  ): Promise<LoadedLifecycleState> {
    const user = await User.findById(userId).session(session);
    if (!user) throw AppError.notFound('User not found');
    if (user.accountKind === AccountKind.SUPER_ADMIN) {
      throw AppError.validation(
        'Super Admin cannot participate in membership or Player lifecycle workflows'
      );
    }
    const player = await Player.findOne({ userId }).session(session);

    return {
      user,
      player,
      userVersion: user.get('__v') ?? 0,
      playerVersion: player ? (player.get('__v') ?? 0) : undefined,
      state: {
        userId: user._id.toString(),
        membershipStatus: user.membershipStatus,
        player: player
          ? {
              id: player._id.toString(),
              type: player.type,
              isActivePlayer: player.isActivePlayer,
              teamIds: player.teamIds.map((id) => id.toString()),
            }
          : undefined,
      },
    };
  }

  async apply(
    loaded: LoadedLifecycleState,
    result: MembershipLifecycleResult,
    session: ClientSession
  ): Promise<void> {
    if (result.player && !loaded.player) {
      await Player.create(
        [
          {
            userId: loaded.user._id,
            type: result.player.type,
            singlesRanking: 0,
            doublesRanking: 0,
            preferredPositions: [],
            isActivePlayer: result.player.isActivePlayer,
            teamIds: result.player.teamIds.map((id) => new Types.ObjectId(id)),
          },
        ],
        { session }
      );
    } else if (result.player && loaded.player) {
      const playerWrite = await Player.updateOne(
        { _id: loaded.player._id, __v: loaded.playerVersion },
        {
          $set: {
            type: result.player.type,
            isActivePlayer: result.player.isActivePlayer,
            teamIds: result.player.teamIds.map((id) => new Types.ObjectId(id)),
          },
          $inc: { __v: 1 },
        },
        { runValidators: true, session }
      );
      if (playerWrite.matchedCount !== 1) {
        throw AppError.conflict(
          'Player lifecycle state changed before the command could be applied'
        );
      }
    }

    const userUpdate: Record<string, unknown> = {
      $set: {
        membershipStatus: result.membershipStatus,
        isPlayer: Boolean(result.player),
      },
      $inc: { __v: 1 },
    };
    if (result.membershipStatus === MembershipStatus.INACTIVE) {
      (userUpdate.$set as Record<string, unknown>).administratorDesignation =
        false;
    }
    const userWrite = await User.updateOne(
      {
        _id: loaded.user._id,
        __v: loaded.userVersion,
        membershipStatus: loaded.state.membershipStatus,
      },
      userUpdate,
      { runValidators: true, session }
    );
    if (userWrite.matchedCount !== 1) {
      throw AppError.conflict(
        'Membership state changed before the command could be applied'
      );
    }
  }

  async audit(
    command: MembershipLifecycleCommand,
    before: MembershipLifecycleState,
    result: MembershipLifecycleResult,
    session: ClientSession
  ): Promise<Types.ObjectId> {
    return AuditService.writeRequired(
      {
        eventType: AuditEventType.MEMBERSHIP_LIFECYCLE_CHANGED,
        entityType: EntityType.USER,
        entityId: command.userId,
        actor: {
          id: command.actor.id,
          accountKind: command.actor.accountKind,
        },
        reason: command.reason,
        changes: [
          {
            field: 'membershipStatus',
            oldValue: before.membershipStatus,
            newValue: result.membershipStatus,
          },
          {
            field: 'player.type',
            oldValue: before.player?.type,
            newValue: result.player?.type,
          },
          {
            field: 'player.isActivePlayer',
            oldValue: before.player?.isActivePlayer,
            newValue: result.player?.isActivePlayer,
          },
          {
            field: 'operation',
            newValue: command.operation,
          },
          ...(command.operation ===
            MembershipLifecycleOperation.TRANSITION_MEMBERSHIP &&
          command.targetMembershipStatus === MembershipStatus.INACTIVE
            ? [
                {
                  field: 'inactivePlayerOutcome',
                  newValue: result.inactivePlayerOutcome,
                },
              ]
            : []),
          {
            field: 'teamCount',
            oldValue: before.player?.teamIds.length ?? 0,
            newValue: result.player?.teamIds.length ?? 0,
          },
        ],
      },
      session
    );
  }

  async complete(
    command: MembershipLifecycleCommand,
    result: MembershipLifecycleResult,
    session: ClientSession
  ): Promise<void> {
    const completed = await MembershipLifecycleEvent.findOneAndUpdate(
      {
        idempotencyKey: command.idempotencyKey,
        status: MembershipLifecycleEventStatus.PENDING,
      },
      {
        $set: {
          status: MembershipLifecycleEventStatus.COMPLETED,
          result: serializeResult(result),
          errorCode: undefined,
          errorMessage: undefined,
        },
      },
      { new: true, session }
    );
    if (!completed) {
      throw AppError.conflict('Lifecycle command completion state changed');
    }
  }

  async fail(
    command: MembershipLifecycleCommand,
    error: unknown
  ): Promise<void> {
    const details = errorDetails(error);
    await MembershipLifecycleEvent.updateOne(
      { idempotencyKey: command.idempotencyKey },
      {
        $set: {
          status: MembershipLifecycleEventStatus.FAILED,
          errorCode: details.code,
          errorMessage: details.message,
        },
      }
    );
  }

  async withTransaction<T>(
    operation: (session: ClientSession) => Promise<T>
  ): Promise<T> {
    const session = await mongoose.startSession();
    try {
      let result: T | undefined;
      await session.withTransaction(async () => {
        result = await operation(session);
      });
      if (result === undefined) {
        throw AppError.internal('Lifecycle transaction produced no result');
      }
      return result;
    } finally {
      await session.endSession();
    }
  }
}

export class MembershipLifecycleService {
  constructor(
    private readonly repository: MembershipLifecycleRepository = new MongoMembershipLifecycleRepository()
  ) {}

  async execute(
    input: MembershipLifecycleCommand
  ): Promise<MembershipLifecycleResult> {
    const command = membershipLifecycleCommandSchema.parse(input);
    const claim = await this.repository.claim(command);
    if (claim.replay) return claim.replay;

    try {
      return await this.repository.withTransaction((session) =>
        this.executeClaimed(command, session)
      );
    } catch (error) {
      await this.repository.fail(command, error);
      throw error;
    }
  }

  /** Executes inside a caller-owned transaction without opening or completing one. */
  async executeInSession(
    input: MembershipLifecycleCommand,
    session: ClientSession
  ): Promise<MembershipLifecycleResult> {
    const command = membershipLifecycleCommandSchema.parse(input);
    const claim = await this.repository.claim(command, session);
    if (claim.replay) return claim.replay;
    return this.executeClaimed(command, session);
  }

  private async executeClaimed(
    command: MembershipLifecycleCommand,
    session: ClientSession
  ): Promise<MembershipLifecycleResult> {
    const loaded = await this.repository.load(command.userId, session);
    this.assertPlayerEnablementRole(loaded, command);
    const result = planMembershipLifecycleCommand(loaded.state, command);
    await this.repository.apply(loaded, result, session);
    await this.repository.audit(command, loaded.state, result, session);
    await this.repository.complete(command, result, session);
    return result;
  }

  private assertPlayerEnablementRole(
    loaded: LoadedLifecycleState,
    command: MembershipLifecycleCommand
  ): void {
    if (
      command.operation ===
        MembershipLifecycleOperation.SET_PLAYER_ELIGIBILITY &&
      command.eligible &&
      loaded.user.accountKind === AccountKind.SUPER_ADMIN
    ) {
      throw AppError.validation('Super Admin cannot be enabled as a Player');
    }
  }
}

export const membershipLifecycleService = new MembershipLifecycleService();
