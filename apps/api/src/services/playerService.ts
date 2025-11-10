import { Player } from '../models/Player';
import { Team } from '../models/Team';
import { Match } from '../models/Match';
import mongoose, { Schema, Types } from 'mongoose';
import { PlayerPersistenceTransformer, PlayerApiTransformer } from '../transformers/player';
import { Domain } from '@club/shared-types/domain/player';
import { Api } from '@club/shared-types/api/player';

/**
 * Helper: Check if MongoDB supports transactions (replica set required)
 * In local dev with standalone MongoDB, transactions will fail
 */
async function supportsTransactions(): Promise<boolean> {
  try {
    const admin = mongoose.connection.db?.admin();
    if (!admin) return false;

    const result = await admin.command({ isMaster: 1 });
    // Check if it's a replica set member or mongos (sharded cluster)
    return !!(result.setName || result.msg === 'isdbgrid');
  } catch (error) {
    return false;
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
    const player = await Player.findById(playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    // Apply updates
    if (updates.singlesRanking !== undefined) player.singlesRanking = updates.singlesRanking;
    if (updates.doublesRanking !== undefined) player.doublesRanking = updates.doublesRanking;
    if (updates.preferredPositions !== undefined) player.preferredPositions = updates.preferredPositions;
    if (updates.isActivePlayer !== undefined) player.isActivePlayer = updates.isActivePlayer;
    if (updates.teamIds !== undefined) {
      player.teamIds = updates.teamIds.map(id => new Types.ObjectId(id)) as any;
    }

    await player.save();

    // Transform to domain object
    return PlayerPersistenceTransformer.toDomain(player.toObject() as any);
  }

  /**
   * Get all players with user info populated
   * @returns Array of player API responses with user data
   */
  static async getAllPlayersWithUserInfo(): Promise<Api.PlayerResponse[]> {
    const players = await Player.find().populate('userId', 'firstName lastName email gender membershipStatus');
    console.log('Fetched players with user info:', players.length);
    return players.map(player => {
      const playerObj = player.toObject() as any;

      // Get populated user data
      const populatedUser = playerObj.userId as any;

      // Store the actual userId (ObjectId) before transformation
      const userIdValue = populatedUser?._id || playerObj.userId;

      // Replace populated user with just the ID for domain transformation
      const playerForDomain = {
        ...playerObj,
        userId: userIdValue
      };

      const domainPlayer = PlayerPersistenceTransformer.toDomain(playerForDomain);

      // Compute fullName from firstName and lastName
      const userName = populatedUser?.firstName && populatedUser?.lastName
        ? `${populatedUser.lastName}, ${populatedUser.firstName}`
        : '';
      return PlayerApiTransformer.toApi(domainPlayer, {
        userName: userName,
        userEmail: populatedUser?.email || '',
        userGender: populatedUser?.gender
      });
    });
  }

  /**
   * Get active players for a specific team
   * @param teamId - Team ID to filter players
   * @returns Array of player API responses
   */
  static async getActivePlayersForTeam(teamId: string | Schema.Types.ObjectId): Promise<Api.PlayerResponse[]> {
    const players = await Player.find({
      teamIds: teamId,
      isActivePlayer: true
    }).populate('userId', 'firstName lastName email gender');

    return players.map(player => {
      const playerObj = player.toObject() as any;

      // Get populated user data
      const populatedUser = playerObj.userId as any;

      // Store the actual userId (ObjectId) before transformation
      const userIdValue = populatedUser?._id || playerObj.userId;

      // Replace populated user with just the ID for domain transformation
      const playerForDomain = {
        ...playerObj,
        userId: userIdValue
      };

      const domainPlayer = PlayerPersistenceTransformer.toDomain(playerForDomain);

      const userName = populatedUser?.firstName && populatedUser?.lastName
        ? `${populatedUser.lastName}, ${populatedUser.firstName}`
        : '';
      return PlayerApiTransformer.toApi(domainPlayer, {
        userName: userName,
        userEmail: populatedUser?.email || ''
      });
    });
  }

  /**
   * Get player by user ID
   * @param userId - User ID to find player for
   * @returns Player domain object or null
   */
  static async getPlayerByUserId(userId: string | Schema.Types.ObjectId): Promise<Domain.Player | null> {
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
  static async getPlayerById(playerId: string | Schema.Types.ObjectId): Promise<Domain.Player | null> {
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
  static async getPlayerByIdWithUserInfo(playerId: string | Schema.Types.ObjectId): Promise<Api.PlayerResponse | null> {
    const player = await Player.findById(playerId).populate('userId', 'firstName lastName email');
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
      userId: userIdValue
    };

    const domainPlayer = PlayerPersistenceTransformer.toDomain(playerForDomain);

    const userName = populatedUser?.firstName && populatedUser?.lastName
      ? `${populatedUser.lastName}, ${populatedUser.firstName}`
      : '';
    return PlayerApiTransformer.toApi(domainPlayer, {
      userName: userName,
      userEmail: populatedUser?.email || ''
    });
  }

  /**
   * Get all players
   * @returns Array of player domain objects
   */
  static async getAllPlayers(): Promise<Domain.Player[]> {
    const players = await Player.find();
    return players.map(player => PlayerPersistenceTransformer.toDomain(player.toObject() as any));
  }

  /**
   * Get players by team
   * @param teamId - Team ID to filter players
   * @returns Array of player domain objects
   */
  static async getPlayersByTeam(teamId: string | Schema.Types.ObjectId): Promise<Domain.Player[]> {
    const players = await Player.find({ teamIds: teamId });
    return players.map(player => PlayerPersistenceTransformer.toDomain(player.toObject() as any));
  }

  /**
   * Get active players
   * @returns Array of player domain objects
   */
  static async getActivePlayers(): Promise<Domain.Player[]> {
    const players = await Player.find({ isActivePlayer: true });
    return players.map(player => PlayerPersistenceTransformer.toDomain(player.toObject() as any));
  }

  /**
   * Batch update multiple players
   * @param playerIds - Array of player IDs to update
   * @param updates - Updates to apply to all selected players
   * @returns Result with count of modified documents
   */
  static async batchUpdatePlayers(
    playerIds: string[],
    updates: {
      isActivePlayer?: boolean;
      singlesRanking?: number;
      doublesRanking?: number;
      singlesRankingOffset?: number;
      doublesRankingOffset?: number;
      addToTeams?: string[];
      removeFromTeams?: string[];
    }
  ): Promise<{ modifiedCount: number }> {
    // Validate input
    if (!playerIds || playerIds.length === 0) {
      return { modifiedCount: 0 };
    }

    const updateOperations: any = {};

    // Build update operations
    if (updates.isActivePlayer !== undefined) {
      updateOperations.isActivePlayer = updates.isActivePlayer;
    }

    if (updates.singlesRanking !== undefined) {
      updateOperations.singlesRanking = updates.singlesRanking;
    }

    if (updates.doublesRanking !== undefined) {
      updateOperations.doublesRanking = updates.doublesRanking;
    }

    // Handle ranking offsets separately with $inc operator
    if (updates.singlesRankingOffset !== undefined || updates.doublesRankingOffset !== undefined) {
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
      return { modifiedCount: result.modifiedCount };
    }

    // Handle team operations separately if needed
    if (updates.addToTeams && updates.addToTeams.length > 0) {
      const teamObjectIds = updates.addToTeams.map(id => new Types.ObjectId(id));
      const playerObjectIds = playerIds.map(id => new Types.ObjectId(id));

      // UNIDIRECTIONAL: Only update Player.teamIds (no Team.playerIds sync!)
      await Player.updateMany(
        { _id: { $in: playerObjectIds } },
        { $addToSet: { teamIds: { $each: teamObjectIds } } }
      );
    }

    if (updates.removeFromTeams && updates.removeFromTeams.length > 0) {
      const teamObjectIds = updates.removeFromTeams.map(id => new Types.ObjectId(id));
      const playerObjectIds = playerIds.map(id => new Types.ObjectId(id));

      // UNIDIRECTIONAL: Only update Player.teamIds (no Team.playerIds sync!)
      await Player.updateMany(
        { _id: { $in: playerObjectIds } },
        { $pull: { teamIds: { $in: teamObjectIds } } }
      );
    }        // Apply basic field updates if any
    if (Object.keys(updateOperations).length > 0) {
      const result = await Player.updateMany(
        { _id: { $in: playerIds } },
        { $set: updateOperations }
      );
      return { modifiedCount: result.modifiedCount };
    }

    // If only team operations were performed, return count of affected players
    return { modifiedCount: playerIds.length };
  }

  /**
   * Add a single player to a team
   * UNIDIRECTIONAL: Only updates Player.teamIds (single source of truth)
   * @param playerId - ID of the player to add
   * @param teamId - ID of the team to add player to
   * @returns Updated player domain object
   */
  static async addPlayerToTeam(playerId: string, teamId: string): Promise<Domain.Player> {
    const player = await Player.findById(playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    const team = await Team.findById(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    // Check if player already in team
    const teamObjectId = new Types.ObjectId(teamId);
    const alreadyInTeam = player.teamIds.some(id =>
      id.toString() === teamObjectId.toString()
    );

    if (!alreadyInTeam) {
      // UNIDIRECTIONAL: Only update Player.teamIds (no Team.playerIds sync needed!)
      player.teamIds.push(teamObjectId as any);
      await player.save();
    }

    return PlayerPersistenceTransformer.toDomain(player.toObject() as any);
  }

  /**
   * Remove a single player from a team
   * UNIDIRECTIONAL: Only updates Player.teamIds (single source of truth)
   * AUTO-SYNCS: Removes player from all matches for this team (unavailablePlayers + lineup)
   * Uses transactions if available (replica set), otherwise sequential operations
   * @param playerId - ID of the player to remove
   * @param teamId - ID of the team to remove player from
   * @returns Updated player domain object
   */
  static async removePlayerFromTeam(playerId: string, teamId: string): Promise<Domain.Player> {
    const useTransactions = await supportsTransactions();

    if (useTransactions) {
      // Use transactions for data consistency (production with replica set)
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const player = await Player.findById(playerId).session(session);
        if (!player) {
          throw new Error('Player not found');
        }

        // Verify team exists
        const team = await Team.findById(teamId).session(session);
        if (!team) {
          throw new Error('Team not found');
        }

        // UNIDIRECTIONAL: Only update Player.teamIds (no Team.playerIds sync!)
        player.teamIds = player.teamIds.filter(id => id.toString() !== teamId);
        await player.save({ session });

        // AUTO-SYNC: Remove player from all matches for this team
        const playerObjectId = new Types.ObjectId(playerId);
        await Match.updateMany(
          { homeTeamId: teamId },
          {
            $pull: {
              unavailablePlayers: playerObjectId,
              'lineup.singles': playerObjectId,
              'lineup.doubles': playerObjectId,
              'lineup.mixed': playerObjectId
            }
          },
          { session }
        );

        await session.commitTransaction();
        return PlayerPersistenceTransformer.toDomain(player.toObject() as any);
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        session.endSession();
      }
    } else {
      // Fallback: Sequential operations (local dev with standalone MongoDB)
      console.warn('⚠️  Transactions not supported - using sequential operations');

      const player = await Player.findById(playerId);
      if (!player) {
        throw new Error('Player not found');
      }

      // Verify team exists
      const team = await Team.findById(teamId);
      if (!team) {
        throw new Error('Team not found');
      }

      // UNIDIRECTIONAL: Only update Player.teamIds (no Team.playerIds sync!)
      player.teamIds = player.teamIds.filter(id => id.toString() !== teamId);
      await player.save();

      // AUTO-SYNC: Remove player from all matches for this team
      const playerObjectId = new Types.ObjectId(playerId);
      await Match.updateMany(
        { homeTeamId: teamId },
        {
          $pull: {
            unavailablePlayers: playerObjectId,
            'lineup.singles': playerObjectId,
            'lineup.doubles': playerObjectId,
            'lineup.mixed': playerObjectId
          }
        }
      );

      return PlayerPersistenceTransformer.toDomain(player.toObject() as any);
    }
  }
}