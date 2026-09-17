import type { Api } from '@club/shared-types/api/player';
import { createHash } from 'node:crypto';
import {
  AccountKind,
  MembershipStatus,
  PlayerType,
} from '@club/shared-types/core/enums';
import {
  MembershipLifecycleOperation,
  type MembershipLifecycleActor,
  type MembershipLifecycleCommand,
  type MembershipLifecycleState,
} from '@club/shared-types/domain/membershipLifecycle';
import mongoose, { Types } from 'mongoose';
import { Player } from '../models/Player';
import { User } from '../models/User';
import {
  MembershipLifecycleEvent,
  MembershipLifecycleEventStatus,
} from '../models/MembershipLifecycleEvent';
import { AppError } from '../utils/errors';
import { isPlayerEligibleForTeam } from './membershipLifecyclePolicy';
import {
  membershipLifecycleCommandFingerprint,
  membershipLifecycleService,
} from './membershipLifecycleService';
import { PlayerService } from './playerService';

const currentMembershipStatuses = [
  MembershipStatus.ACTIVE,
  MembershipStatus.PASSIVE,
];
const MAX_LIFECYCLE_CANDIDATES = 200;

function lifecycleState(
  user: {
    _id: Types.ObjectId;
    membershipStatus: MembershipStatus;
  },
  player?: {
    _id: Types.ObjectId;
    type: PlayerType;
    isActivePlayer: boolean;
    teamIds: Types.ObjectId[];
  }
): MembershipLifecycleState {
  return {
    userId: user._id.toString(),
    membershipStatus: user.membershipStatus,
    player: player
      ? {
          id: player._id.toString(),
          type: player.type,
          isActivePlayer: player.isActivePlayer,
          teamIds: player.teamIds.map((teamId) => teamId.toString()),
        }
      : undefined,
  };
}

export class PlayerLifecycleAdministrationService {
  static async listCandidates(): Promise<Api.PlayerLifecycleCandidate[]> {
    const users = await User.find({
      accountKind: AccountKind.PERSON,
      membershipStatus: { $in: currentMembershipStatuses },
    })
      .select('_id firstName lastName accountKind membershipStatus')
      .sort({ lastName: 1, firstName: 1, _id: 1 })
      .limit(MAX_LIFECYCLE_CANDIDATES)
      .lean();
    const players = await Player.find({
      userId: { $in: users.map((user) => user._id) },
    }).lean();
    const playersByUser = new Map(
      players.map((player) => [player.userId.toString(), player])
    );

    return users.map((user) => {
      if (
        user.accountKind !== AccountKind.PERSON ||
        user.membershipStatus === undefined
      ) {
        throw AppError.internal(
          'Player lifecycle candidate projection returned a non-person account'
        );
      }
      const player = playersByUser.get(user._id.toString());
      const state = lifecycleState(user, player);
      return {
        userId: user._id.toString(),
        userName: `${user.lastName}, ${user.firstName}`,
        membershipStatus: user.membershipStatus,
        playerId: player?._id.toString(),
        isParticipationEnabled: player?.isActivePlayer ?? false,
        isEffectivelyEligible: isPlayerEligibleForTeam(state),
      };
    });
  }

  static async executeBatch(input: {
    userIds: string[];
    action: Api.PlayerLifecycleBatchAction;
    reason: string;
    idempotencyKey: string;
    actor: MembershipLifecycleActor;
    occurredAt?: Date;
  }): Promise<Api.PlayerLifecycleBatchResult> {
    const uniqueUserIds = [...new Set(input.userIds)];
    if (uniqueUserIds.length < 1 || uniqueUserIds.length > 50) {
      throw AppError.validation('Batch must contain between 1 and 50 Users');
    }
    if (uniqueUserIds.some((userId) => !Types.ObjectId.isValid(userId))) {
      throw AppError.validation('Batch contains an invalid User identifier');
    }
    const baseKey = input.idempotencyKey.trim();
    if (baseKey.length < 8 || baseKey.length > 200) {
      throw AppError.validation('A valid Idempotency-Key is required');
    }
    const occurredAt = input.occurredAt ?? new Date();
    const items: Api.PlayerLifecycleBatchItemResult[] = [];

    for (const userId of uniqueUserIds) {
      try {
        const user = await User.findById(userId).select(
          'accountKind membershipStatus'
        );
        if (!user) throw AppError.notFound('User not found');
        if (user.accountKind !== AccountKind.PERSON) {
          throw AppError.validation(
            'Player lifecycle batch targets must be person accounts'
          );
        }
        const player = await Player.findOne({ userId }).select(
          '_id type isActivePlayer'
        );
        if (input.action === 'enable') {
          if (!currentMembershipStatuses.includes(user.membershipStatus)) {
            throw AppError.validation(
              'Player enablement requires a current person Member'
            );
          }
          if (player && player.type !== PlayerType.MEMBER) {
            throw AppError.validation(
              'Current Member Player lifecycle requires a member Player identity'
            );
          }
        } else {
          if (!player?.isActivePlayer) {
            throw AppError.validation(
              'Player deactivation requires an enabled current Player'
            );
          }
          const compatibleMember =
            player.type === PlayerType.MEMBER &&
            currentMembershipStatuses.includes(user.membershipStatus);
          const compatibleExternal =
            player.type === PlayerType.EXTERNAL &&
            user.membershipStatus === MembershipStatus.INACTIVE;
          if (!compatibleMember && !compatibleExternal) {
            throw AppError.validation(
              'Player deactivation requires a compatible current Player identity'
            );
          }
        }

        const result = await membershipLifecycleService.execute({
          operation: MembershipLifecycleOperation.SET_PLAYER_ELIGIBILITY,
          userId,
          expectedMembershipStatus: user.membershipStatus,
          eligible: input.action === 'enable',
          playerTypeForCreation:
            input.action === 'enable' && !player
              ? PlayerType.MEMBER
              : undefined,
          actor: input.actor,
          reason: input.reason,
          idempotencyKey: `${baseKey}:player-lifecycle:${input.action}:${userId}`,
          occurredAt,
        });
        items.push({
          userId,
          playerId: result.player?.id ?? player?._id.toString(),
          replayed: result.replayed,
        });
      } catch (error) {
        const appError =
          error instanceof AppError
            ? error
            : AppError.internal('Player lifecycle batch item failed');
        items.push({
          userId,
          error: { code: appError.code, message: appError.message },
        });
      }
    }

    const updatedCount = items.filter((item) => !item.error).length;
    return {
      success: updatedCount === items.length,
      updatedCount,
      failureCount: items.length - updatedCount,
      items,
    };
  }

  static async convertFormerMemberToExternal(input: {
    playerId: string;
    reason: string;
    idempotencyKey: string;
    actor: MembershipLifecycleActor;
    occurredAt?: Date;
  }): Promise<Api.PlayerResponse> {
    if (!Types.ObjectId.isValid(input.playerId)) {
      throw AppError.validation('Player identifier is invalid');
    }
    const reason = input.reason.trim();
    if (!reason || reason.length > 500) {
      throw AppError.validation('A conversion reason is required');
    }
    const baseKey = input.idempotencyKey.trim();
    if (baseKey.length < 8 || baseKey.length > 200) {
      throw AppError.validation('A valid Idempotency-Key is required');
    }

    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const lifecycleIdempotencyKey = `former-member-to-external:${createHash(
          'sha256'
        )
          .update(`${baseKey}:${input.playerId}`)
          .digest('hex')}`;
        const existingClaim = await MembershipLifecycleEvent.findOne({
          idempotencyKey: lifecycleIdempotencyKey,
        }).session(session);
        if (existingClaim) {
          const replayCommand: MembershipLifecycleCommand = {
            operation: MembershipLifecycleOperation.CONVERT_PLAYER_TYPE,
            userId: existingClaim.userId.toString(),
            expectedMembershipStatus: MembershipStatus.INACTIVE,
            targetPlayerType: PlayerType.EXTERNAL,
            eligible: true,
            actor: input.actor,
            reason,
            idempotencyKey: lifecycleIdempotencyKey,
            occurredAt: input.occurredAt ?? new Date(),
          };
          const result = existingClaim.result as
            | { player?: { id?: string } }
            | undefined;
          if (
            existingClaim.status !== MembershipLifecycleEventStatus.COMPLETED ||
            existingClaim.commandFingerprint !==
              membershipLifecycleCommandFingerprint(replayCommand) ||
            result?.player?.id !== input.playerId
          ) {
            throw AppError.conflict(
              'Idempotency-Key is already used by another lifecycle command'
            );
          }
          return;
        }

        const player = await Player.findById(input.playerId).session(session);
        if (!player) throw AppError.notFound('Player not found');
        const user = await User.findById(player.userId).session(session);
        if (!user) throw AppError.notFound('User not found');
        if (user.accountKind !== AccountKind.PERSON) {
          throw AppError.validation(
            'External Player conversion requires a person account'
          );
        }
        if (
          user.membershipStatus !== MembershipStatus.INACTIVE ||
          player.type !== PlayerType.MEMBER ||
          player.isActivePlayer ||
          player.teamIds.length > 0
        ) {
          throw AppError.conflict(
            'External Player conversion requires an inactive former Member with disabled participation and no current Teams'
          );
        }

        await membershipLifecycleService.executeInSession(
          {
            operation: MembershipLifecycleOperation.CONVERT_PLAYER_TYPE,
            userId: user._id.toString(),
            expectedMembershipStatus: MembershipStatus.INACTIVE,
            targetPlayerType: PlayerType.EXTERNAL,
            eligible: true,
            actor: input.actor,
            reason,
            idempotencyKey: lifecycleIdempotencyKey,
            occurredAt: input.occurredAt ?? new Date(),
          },
          session
        );
      });
    } finally {
      await session.endSession();
    }

    const updated = await PlayerService.getPlayerByIdWithUserInfo(
      input.playerId
    );
    if (!updated) {
      throw AppError.internal('Converted Player projection is unavailable');
    }
    return updated;
  }
}
