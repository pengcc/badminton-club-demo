import { Player } from '../models/Player';
import { Team } from '../models/Team';
import type { Schema } from 'mongoose';
import mongoose, { Types, type ClientSession } from 'mongoose';
import {
  PlayerPersistenceTransformer,
  PlayerApiTransformer,
} from '../transformers/player';
import type { Domain } from '@club/shared-types/domain/player';
import type { Api } from '@club/shared-types/api/player';
import { AppError } from '../utils/errors';
import { assertPlayerEligibleForTeam } from './membershipEligibilityService';
import { PasswordSetupDeliveryService } from './passwordSetupDeliveryService';
import { isPlayerEligibleForTeam } from './membershipLifecyclePolicy';
import { TeamService } from './teamService';
import { PasswordRecoveryService } from './passwordRecoveryService';

export const MAX_PLAYER_BATCH_SIZE = 50;

async function withTransaction<T>(
  operation: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await operation(session);
    });
    if (result === undefined) {
      throw AppError.internal('Player transaction produced no result');
    }
    return result;
  } finally {
    await session.endSession();
  }
}

function uniqueObjectIds(ids: string[], label: string): Types.ObjectId[] {
  if (ids.some((id) => !Types.ObjectId.isValid(id))) {
    throw AppError.validation(`${label} contains an invalid identifier`);
  }
  const canonicalIds = ids.map((id) => new Types.ObjectId(id).toString());
  if (new Set(canonicalIds).size !== ids.length) {
    throw AppError.validation(`${label} must contain unique identifiers`);
  }
  return canonicalIds.map((id) => new Types.ObjectId(id));
}

async function mutatePlayerTeamAssociations(
  playerId: Types.ObjectId,
  addTeamIds: Types.ObjectId[],
  removeTeamIds: Types.ObjectId[],
  session: ClientSession
): Promise<void> {
  const eligibility =
    addTeamIds.length > 0
      ? await assertPlayerEligibleForTeam(playerId.toString(), session)
      : undefined;
  const currentPlayer = eligibility
    ? undefined
    : await Player.findById(playerId).session(session);
  if (!eligibility && !currentPlayer) {
    throw AppError.notFound('Player not found');
  }

  let playerVersion =
    eligibility?.playerVersion ?? currentPlayer?.get('__v') ?? 0;

  if (addTeamIds.length > 0) {
    const assignment = await Player.updateOne(
      {
        _id: playerId,
        __v: playerVersion,
        type: eligibility?.playerType,
        isActivePlayer: true,
      },
      {
        $addToSet: { teamIds: { $each: addTeamIds } },
        $inc: { __v: 1 },
      },
      { runValidators: true, session }
    );
    if (assignment.matchedCount !== 1) {
      throw AppError.conflict(
        'Player eligibility changed before Team assignment could be applied'
      );
    }
    playerVersion += 1;
  }

  if (removeTeamIds.length > 0) {
    const removal = await Player.updateOne(
      { _id: playerId, __v: playerVersion },
      {
        $pull: { teamIds: { $in: removeTeamIds } },
        $inc: { __v: 1 },
      },
      { runValidators: true, session }
    );
    if (removal.matchedCount !== 1) {
      throw AppError.conflict(
        'Player Team assignment changed before removal could be applied'
      );
    }
  }
}

/**
 * Service for Player entity operations
 * Players are separate entities linked to Users via userId
 */
export class PlayerService {
  /**
   * Update player sports data
   * @param playerId - Player ID to update
   * @param updates - Partial player data to update
   * @returns Updated player domain object
   */
  static async updatePlayerSportsData(
    playerId: string | Schema.Types.ObjectId,
    updates: Api.UpdatePlayerRequest
  ): Promise<Domain.Player> {
    const untrustedUpdates = updates as Record<string, unknown>;
    if (
      untrustedUpdates.isActivePlayer !== undefined ||
      untrustedUpdates.teamIds !== undefined
    ) {
      throw AppError.validation(
        'Player eligibility and Team assignment require their authoritative services'
      );
    }
    const player = await Player.findById(playerId);
    if (!player) {
      throw new AppError('Player not found', 404);
    }

    // Apply updates
    if (updates.singlesRanking !== undefined)
      player.singlesRanking = updates.singlesRanking;
    if (updates.doublesRanking !== undefined)
      player.doublesRanking = updates.doublesRanking;
    if (updates.preferredPositions !== undefined)
      player.preferredPositions = updates.preferredPositions;

    await player.save();

    // Transform to domain object
    return PlayerPersistenceTransformer.toDomain(player.toObject() as any);
  }

  /**
   * Get all players with user info populated
   * @returns Array of player API responses with user data
   */
  static async getAllPlayersWithUserInfo(
    includeAccountSetup = false
  ): Promise<Api.PlayerResponse[]> {
    const userProjection = [
      'firstName',
      'lastName',
      'email',
      'gender',
      'accountKind',
      'administratorDesignation',
      'membershipStatus',
      'accountSuspension',
      ...(includeAccountSetup
        ? [
            'accountOnboardingStatus',
            'passwordSetupExpiresAt',
            'passwordSetupGeneration',
            'passwordSetupDeliveryGeneration',
            'passwordSetupDeliveryStatus',
            'passwordSetupDeliveryClaimedAt',
          ]
        : []),
    ].join(' ');
    const players = await Player.find().populate('userId', userProjection);
    console.log('Fetched players with user info:', players.length);
    const knownPlayers = players.map((player) => {
      const playerObject = player.toObject() as any;
      return {
        userId: playerObject.userId._id,
        type: playerObject.type,
        isActivePlayer: playerObject.isActivePlayer,
      };
    });
    const [setupSummaries, recoveryAvailability] = includeAccountSetup
      ? await Promise.all([
          PasswordSetupDeliveryService.setupSummariesForUsers(
            players.map((player) => (player.toObject() as any).userId),
            knownPlayers
          ),
          PasswordRecoveryService.availabilityForUsers(
            players.map((player) => (player.toObject() as any).userId),
            knownPlayers
          ),
        ])
      : [undefined, undefined];
    return players.map((player) => {
      const playerObj = player.toObject() as any;

      // Get populated user data
      const populatedUser = playerObj.userId as any;

      // Store the actual userId (ObjectId) before transformation
      const userIdValue = populatedUser?._id || playerObj.userId;

      // Replace populated user with just the ID for domain transformation
      const playerForDomain = {
        ...playerObj,
        userId: userIdValue,
      };

      const domainPlayer =
        PlayerPersistenceTransformer.toDomain(playerForDomain);

      // Compute fullName from firstName and lastName
      const userName =
        populatedUser?.firstName && populatedUser?.lastName
          ? `${populatedUser.lastName}, ${populatedUser.firstName}`
          : '';
      const response = PlayerApiTransformer.toApi(domainPlayer, {
        userName: userName,
        userEmail: populatedUser?.email || '',
        userGender: populatedUser?.gender,
        membershipStatus: populatedUser?.membershipStatus,
        isEffectivelyEligible: populatedUser
          ? isPlayerEligibleForTeam({
              userId: userIdValue.toString(),
              membershipStatus: populatedUser.membershipStatus,
              player: {
                id: domainPlayer.id,
                type: domainPlayer.type,
                isActivePlayer: domainPlayer.isActivePlayer,
                teamIds: domainPlayer.teamIds,
              },
            })
          : false,
      });
      const accountSetup = setupSummaries?.get(userIdValue.toString());
      return accountSetup
        ? {
            ...response,
            accountSetup,
            passwordRecoveryAvailable:
              recoveryAvailability?.get(userIdValue.toString()) ?? false,
          }
        : response;
    });
  }

  /**
   * Get active players for a specific team
   * @param teamId - Team ID to filter players
   * @returns Array of player API responses
   */
  static async getActivePlayersForTeam(
    teamId: string | Schema.Types.ObjectId
  ): Promise<Api.PlayerResponse[]> {
    const players = await Player.find({
      teamIds: teamId,
      isActivePlayer: true,
    }).populate('userId', 'firstName lastName email gender membershipStatus');

    return players
      .map((player) => {
        const playerObj = player.toObject() as any;

        // Get populated user data
        const populatedUser = playerObj.userId as any;

        // Store the actual userId (ObjectId) before transformation
        const userIdValue = populatedUser?._id || playerObj.userId;

        // Replace populated user with just the ID for domain transformation
        const playerForDomain = {
          ...playerObj,
          userId: userIdValue,
        };

        const domainPlayer =
          PlayerPersistenceTransformer.toDomain(playerForDomain);

        const userName =
          populatedUser?.firstName && populatedUser?.lastName
            ? `${populatedUser.lastName}, ${populatedUser.firstName}`
            : '';
        return PlayerApiTransformer.toApi(domainPlayer, {
          userName: userName,
          userEmail: populatedUser?.email || '',
          userGender: populatedUser?.gender,
          membershipStatus: populatedUser?.membershipStatus,
          isEffectivelyEligible: populatedUser
            ? isPlayerEligibleForTeam({
                userId: userIdValue.toString(),
                membershipStatus: populatedUser.membershipStatus,
                player: {
                  id: domainPlayer.id,
                  type: domainPlayer.type,
                  isActivePlayer: domainPlayer.isActivePlayer,
                  teamIds: domainPlayer.teamIds,
                },
              })
            : false,
        });
      })
      .filter((player) => player.isEffectivelyEligible);
  }

  /**
   * Get player by user ID
   * @param userId - User ID to find player for
   * @returns Player domain object or null
   */
  static async getPlayerByUserId(
    userId: string | Schema.Types.ObjectId
  ): Promise<Domain.Player | null> {
    const player = await Player.findOne({ userId });
    if (!player) {
      return null;
    }

    return PlayerPersistenceTransformer.toDomain(player.toObject() as any);
  }

  /**
   * Get player by ID
   * @param playerId - Player ID
   * @returns Player domain object or null
   */
  static async getPlayerById(
    playerId: string | Schema.Types.ObjectId
  ): Promise<Domain.Player | null> {
    const player = await Player.findById(playerId);
    if (!player) {
      return null;
    }

    return PlayerPersistenceTransformer.toDomain(player.toObject() as any);
  }

  /**
   * Get player by ID with user info populated
   * @param playerId - Player ID
   * @returns Player API response with user data
   */
  static async getPlayerByIdWithUserInfo(
    playerId: string | Schema.Types.ObjectId
  ): Promise<Api.PlayerResponse | null> {
    const player = await Player.findById(playerId).populate(
      'userId',
      'firstName lastName email gender membershipStatus'
    );
    if (!player) {
      return null;
    }

    const playerObj = player.toObject() as any;

    // Get populated user data
    const populatedUser = playerObj.userId as any;

    // Store the actual userId (ObjectId) before transformation
    const userIdValue = populatedUser?._id || playerObj.userId;

    // Replace populated user with just the ID for domain transformation
    const playerForDomain = {
      ...playerObj,
      userId: userIdValue,
    };

    const domainPlayer = PlayerPersistenceTransformer.toDomain(playerForDomain);

    const userName =
      populatedUser?.firstName && populatedUser?.lastName
        ? `${populatedUser.lastName}, ${populatedUser.firstName}`
        : '';
    return PlayerApiTransformer.toApi(domainPlayer, {
      userName: userName,
      userEmail: populatedUser?.email || '',
      userGender: populatedUser?.gender,
      membershipStatus: populatedUser?.membershipStatus,
      isEffectivelyEligible: populatedUser
        ? isPlayerEligibleForTeam({
            userId: userIdValue.toString(),
            membershipStatus: populatedUser.membershipStatus,
            player: {
              id: domainPlayer.id,
              type: domainPlayer.type,
              isActivePlayer: domainPlayer.isActivePlayer,
              teamIds: domainPlayer.teamIds,
            },
          })
        : false,
    });
  }

  /**
   * Get all players
   * @returns Array of player domain objects
   */
  static async getAllPlayers(): Promise<Domain.Player[]> {
    const players = await Player.find();
    return players.map((player) =>
      PlayerPersistenceTransformer.toDomain(player.toObject() as any)
    );
  }

  /**
   * Get players by team
   * @param teamId - Team ID to filter players
   * @returns Array of player domain objects
   */
  static async getPlayersByTeam(
    teamId: string | Schema.Types.ObjectId
  ): Promise<Domain.Player[]> {
    const players = await Player.find({ teamIds: teamId });
    return players.map((player) =>
      PlayerPersistenceTransformer.toDomain(player.toObject() as any)
    );
  }

  /**
   * Get active players
   * @returns Array of player domain objects
   */
  static async getActivePlayers(): Promise<Domain.Player[]> {
    const players = await Player.find({ isActivePlayer: true });
    return players.map((player) =>
      PlayerPersistenceTransformer.toDomain(player.toObject() as any)
    );
  }

  /**
   * Batch update multiple players
   * @param playerIds - Array of player IDs to update
   * @param updates - Updates to apply to all selected players
   * @returns Result with count of modified documents
   */
  static async batchUpdatePlayers(
    playerIds: string[],
    updates: Api.BatchUpdatePlayersRequest['updates']
  ): Promise<Api.BatchUpdatePlayersResult> {
    if (!playerIds || playerIds.length === 0) {
      throw AppError.validation('At least one Player is required');
    }
    if (playerIds.length > MAX_PLAYER_BATCH_SIZE) {
      throw AppError.validation(
        `Maximum ${MAX_PLAYER_BATCH_SIZE} players per batch operation`
      );
    }

    if ((updates as Record<string, unknown>).isActivePlayer !== undefined) {
      throw AppError.validation(
        'Player eligibility changes require MembershipLifecycleService'
      );
    }

    const playerObjectIds = uniqueObjectIds(playerIds, 'playerIds');
    const addTeamObjectIds = uniqueObjectIds(
      updates.addToTeams ?? [],
      'addToTeams'
    );
    const removeTeamObjectIds = uniqueObjectIds(
      updates.removeFromTeams ?? [],
      'removeFromTeams'
    );
    const hasTeamUpdates = Boolean(
      addTeamObjectIds.length || removeTeamObjectIds.length
    );
    const hasSportingUpdates =
      updates.singlesRanking !== undefined ||
      updates.doublesRanking !== undefined ||
      updates.singlesRankingOffset !== undefined ||
      updates.doublesRankingOffset !== undefined;
    if (hasTeamUpdates && hasSportingUpdates) {
      throw AppError.validation(
        'Team roster changes cannot be combined with ranking updates'
      );
    }
    if (!hasTeamUpdates && !hasSportingUpdates) {
      throw AppError.validation('At least one update is required');
    }

    const removeTeamIds = new Set(
      removeTeamObjectIds.map((teamId) => teamId.toString())
    );
    if (
      addTeamObjectIds.some((teamId) => removeTeamIds.has(teamId.toString()))
    ) {
      throw AppError.validation('Team additions and removals must not overlap');
    }

    if (hasTeamUpdates) {
      return withTransaction(async (session) => {
        const teamObjectIds = [...addTeamObjectIds, ...removeTeamObjectIds];
        const players = await Player.find({
          _id: { $in: playerObjectIds },
        }).session(session);
        const teamCount = await Team.countDocuments({
          _id: { $in: teamObjectIds },
        }).session(session);
        if (players.length !== playerObjectIds.length) {
          throw AppError.notFound('One or more Players were not found');
        }
        if (teamCount !== teamObjectIds.length) {
          throw AppError.notFound('One or more Teams were not found');
        }
        await TeamService.claimTeams(addTeamObjectIds, session);

        for (const playerId of playerObjectIds) {
          await mutatePlayerTeamAssociations(
            playerId,
            addTeamObjectIds,
            removeTeamObjectIds,
            session
          );
        }

        return { updatedCount: playerObjectIds.length };
      });
    }

    const updateOperations: any = {};

    // Build update operations
    if (updates.singlesRanking !== undefined) {
      updateOperations.singlesRanking = updates.singlesRanking;
    }

    if (updates.doublesRanking !== undefined) {
      updateOperations.doublesRanking = updates.doublesRanking;
    }

    // Handle ranking offsets separately with $inc operator
    if (
      updates.singlesRankingOffset !== undefined ||
      updates.doublesRankingOffset !== undefined
    ) {
      const incOperations: any = {};
      if (updates.singlesRankingOffset !== undefined) {
        incOperations.singlesRanking = updates.singlesRankingOffset;
      }
      if (updates.doublesRankingOffset !== undefined) {
        incOperations.doublesRanking = updates.doublesRankingOffset;
      }
      const result = await Player.updateMany(
        { _id: { $in: playerIds } },
        { $inc: incOperations }
      );
      return { updatedCount: result.modifiedCount };
    }

    // Apply basic field updates if any
    if (Object.keys(updateOperations).length > 0) {
      const result = await Player.updateMany(
        { _id: { $in: playerIds } },
        { $set: updateOperations }
      );
      return { updatedCount: result.modifiedCount };
    }

    // If only team operations were performed, return count of affected players
    throw AppError.validation('At least one update is required');
  }

  /**
   * Add a single player to a team
   * UNIDIRECTIONAL: Only updates Player.teamIds (single source of truth)
   * @param playerId - ID of the player to add
   * @param teamId - ID of the team to add player to
   * @returns Updated player domain object
   */
  static async addPlayerToTeam(
    playerId: string,
    teamId: string
  ): Promise<Domain.Player> {
    if (!Types.ObjectId.isValid(playerId) || !Types.ObjectId.isValid(teamId)) {
      throw AppError.validation(
        'Player Team assignment contains an invalid identifier'
      );
    }
    return withTransaction(async (session) => {
      const teamObjectId = new Types.ObjectId(teamId);
      await TeamService.claimTeams([teamObjectId], session);
      await mutatePlayerTeamAssociations(
        new Types.ObjectId(playerId),
        [teamObjectId],
        [],
        session
      );
      const player = await Player.findById(playerId).session(session);
      if (!player) throw AppError.notFound('Player not found');
      return PlayerPersistenceTransformer.toDomain(player.toObject() as any);
    });
  }

  /**
   * Remove a single player from a team
   * UNIDIRECTIONAL: Only updates Player.teamIds (single source of truth)
   * Uses the required transaction boundary
   * @param playerId - ID of the player to remove
   * @param teamId - ID of the team to remove player from
   * @returns Updated player domain object
   */
  static async removePlayerFromTeam(
    playerId: string,
    teamId: string
  ): Promise<Domain.Player> {
    if (!Types.ObjectId.isValid(playerId) || !Types.ObjectId.isValid(teamId)) {
      throw AppError.validation(
        'Player Team assignment contains an invalid identifier'
      );
    }
    return withTransaction(async (session) => {
      const team = await Team.findById(teamId).session(session);
      if (!team) throw AppError.notFound('Team not found');

      await mutatePlayerTeamAssociations(
        new Types.ObjectId(playerId),
        [],
        [new Types.ObjectId(teamId)],
        session
      );
      const updated = await Player.findById(playerId).session(session);
      if (!updated) throw AppError.notFound('Player not found');
      return PlayerPersistenceTransformer.toDomain(updated.toObject() as any);
    });
  }
}
