import type { Api } from '@club/shared-types/api/player';
import {
  AccountKind,
  AuditEventType,
  EntityType,
} from '@club/shared-types/core/enums';
import type { MembershipLifecycleActor } from '@club/shared-types/domain/membershipLifecycle';
import mongoose, { Types, type ClientSession } from 'mongoose';
import { Match } from '../models/Match';
import { Player, type IPlayer } from '../models/Player';
import { User, type IUser } from '../models/User';
import { AppError } from '../utils/errors';
import { AuditService } from './auditService';

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
      throw AppError.internal('Cleanup transaction produced no result');
    }
    return result as T;
  } finally {
    await session.endSession();
  }
}

async function assertPlayerCleanupAllowed(
  player: IPlayer,
  user: IUser,
  evaluatedAt: Date,
  session: ClientSession
): Promise<void> {
  if (user.accountKind !== AccountKind.PERSON) {
    throw AppError.conflict('Super Admin cannot own a Player identity');
  }
  if (player.isActivePlayer) {
    throw AppError.conflict(
      'End Player participation before physical Player cleanup'
    );
  }
  if (player.teamIds.length > 0) {
    throw AppError.conflict(
      'Player cleanup is blocked by current Team associations'
    );
  }
  const futureDependency = await Match.exists({
    startAt: { $gte: evaluatedAt },
    $or: [
      { 'lineup.playerId': player._id },
      { 'availability.playerId': player._id },
    ],
  }).session(session);
  if (futureDependency) {
    throw AppError.conflict(
      'Player cleanup is blocked by a current or future Match dependency'
    );
  }
}

async function deletePlayer(
  player: IPlayer,
  user: IUser,
  session: ClientSession,
  retainUser: boolean
): Promise<void> {
  const playerVersion = player.get('__v') ?? 0;
  if (retainUser) {
    const userVersion = user.get('__v') ?? 0;
    const userWrite = await User.updateOne(
      { _id: user._id, __v: userVersion },
      { $set: { isPlayer: false }, $inc: { __v: 1 } },
      { runValidators: true, session }
    );
    if (userWrite.matchedCount !== 1) {
      throw AppError.conflict(
        'User state changed before Player cleanup could be applied'
      );
    }
  }
  const playerWrite = await Player.deleteOne({
    _id: player._id,
    __v: playerVersion,
  }).session(session);
  if (playerWrite.deletedCount !== 1) {
    throw AppError.conflict(
      'Player state changed before cleanup could be applied'
    );
  }
}

export class PlayerCleanupService {
  static async cleanupLoadedPlayerInSession(input: {
    player: IPlayer;
    user: IUser;
    reason: string;
    actor: MembershipLifecycleActor;
    evaluatedAt: Date;
    session: ClientSession;
    retainUser: boolean;
  }): Promise<Api.PlayerCleanupResult> {
    await assertPlayerCleanupAllowed(
      input.player,
      input.user,
      input.evaluatedAt,
      input.session
    );
    await deletePlayer(
      input.player,
      input.user,
      input.session,
      input.retainUser
    );
    await AuditService.writeRequired(
      {
        eventType: AuditEventType.PLAYER_DELETED,
        entityType: EntityType.PLAYER,
        entityId: input.player._id,
        actor: {
          id: new Types.ObjectId(input.actor.id),
          accountKind: input.actor.accountKind,
        },
        reason: input.reason,
        changes: [
          { field: 'userId', oldValue: input.user._id.toString() },
          {
            field: input.retainUser ? 'physicalCleanup' : 'withUserCleanup',
            newValue: true,
          },
        ],
      },
      input.session
    );
    return {
      playerId: input.player._id.toString(),
      userId: input.user._id.toString(),
    };
  }

  static async cleanupPlayer(input: {
    playerId: string;
    reason: string;
    actor: MembershipLifecycleActor;
    evaluatedAt?: Date;
  }): Promise<Api.PlayerCleanupResult> {
    if (!Types.ObjectId.isValid(input.playerId)) {
      throw AppError.validation('Player identifier is invalid');
    }
    const evaluatedAt = input.evaluatedAt ?? new Date();
    return withTransaction(async (session) => {
      const player = await Player.findById(input.playerId).session(session);
      if (!player) throw AppError.notFound('Player not found');
      const user = await User.findById(player.userId).session(session);
      if (!user) throw AppError.conflict('Player User is unavailable');
      return this.cleanupLoadedPlayerInSession({
        player,
        user,
        evaluatedAt,
        reason: input.reason,
        actor: input.actor,
        session,
        retainUser: true,
      });
    });
  }
}
