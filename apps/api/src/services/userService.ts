import { User, IUser } from '../models/User';
import { Player, IPlayer } from '../models/Player';
import { Team } from '../models/Team';
import { Match } from '../models/Match';
import mongoose, { Schema, Types } from 'mongoose';
import { UserRole } from '@club/shared-types/core/enums';

/**
 * Helper: Check if MongoDB supports transactions (replica set required)
 */
async function supportsTransactions(): Promise<boolean> {
  try {
    const admin = mongoose.connection.db?.admin();
    if (!admin) return false;

    const result = await admin.command({ isMaster: 1 });
    return !!(result.setName || result.msg === 'isdbgrid');
  } catch (error) {
    return false;
  }
}

/**
 * Service for User entity management and Player lifecycle
 */
export class UserService {
  /**
   * Toggle user's player status and manage Player entity lifecycle
   * @param userId - User ID to update
   * @param shouldBePlayer - Whether user should be a player
   * @returns Updated user document
   */
  static async setPlayerStatus(
    userId: string | Schema.Types.ObjectId,
    shouldBePlayer: boolean
  ): Promise<IUser> {
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const validRolesForPlayer = [UserRole.MEMBER, UserRole.GUEST_PLAYER, UserRole.ADMIN];
    // Validate business rules: only ADMIN, MEMBER and GUEST_PLAYER can be players
    if (shouldBePlayer && !validRolesForPlayer.includes(user.role)) {
      throw new Error('Only members, guest players, and admins can be promoted to player status');
    }

    // If status is already correct, return early
    if (user.isPlayer === shouldBePlayer) {
      return user;
    }

    // Update user's isPlayer flag
    user.isPlayer = shouldBePlayer;
    await user.save();

    // Create or delete Player entity based on new status
    if (shouldBePlayer) {
      await this.createPlayerEntity(userId);
    } else {
      await this.deletePlayerEntity(userId);
    }

    return user;
  }

  /**
   * Create a new Player entity for a user
   * @param userId - User ID to create player for
   * @returns Created player document
   */
  static async createPlayerEntity(userId: string | Schema.Types.ObjectId): Promise<IPlayer> {
    // Check if Player already exists
    const existingPlayer = await Player.findOne({ userId });
    if (existingPlayer) {
      console.log(`Player already exists for user ${userId}`);
      return existingPlayer;
    }

    // Create new Player entity with default values
    const player = await Player.create({
      userId,
      singlesRanking: 0,
      doublesRanking: 0,
      preferredPositions: [],
      isActivePlayer: true,
      teamIds: []
    });

    console.log(`Created Player entity for user ${userId}`);
    return player;
  }

  /**
   * Delete Player entity and clean up all relationships
   * CASCADE: Removes player from matches (unavailablePlayers + lineup)
   * UNIDIRECTIONAL: No Team cleanup needed (Player.teamIds is deleted with player)
   * Uses transactions if available (replica set), otherwise sequential operations
   * @param userId - User ID to delete player for
   */
  static async deletePlayerEntity(userId: string | Schema.Types.ObjectId): Promise<void> {
    const player = await Player.findOne({ userId });
    if (!player) {
      console.log(`No Player entity found for user ${userId}`);
      return;
    }

    const useTransactions = await supportsTransactions();

    if (useTransactions) {
      // Use transactions for data consistency (production with replica set)
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const playerObjectId = player._id;

        // CASCADE: Remove player from all matches (unavailablePlayers + lineup)
        await Match.updateMany(
          {},
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

        // Delete Player document
        // Note: No Team cleanup needed - roster computed from Player.teamIds
        await Player.deleteOne({ _id: playerObjectId }, { session });

        await session.commitTransaction();
        console.log(`Deleted Player entity for user ${userId} with cascade cleanup`);
      } catch (error) {
        await session.abortTransaction();
        console.error(`Error deleting Player entity for user ${userId}:`, error);
        throw error;
      } finally {
        session.endSession();
      }
    } else {
      // Fallback: Sequential operations (local dev with standalone MongoDB)
      console.warn('⚠️  Transactions not supported - using sequential operations');

      try {
        const playerObjectId = player._id;

        // CASCADE: Remove player from all matches (unavailablePlayers + lineup)
        await Match.updateMany(
          {},
          {
            $pull: {
              unavailablePlayers: playerObjectId,
              'lineup.singles': playerObjectId,
              'lineup.doubles': playerObjectId,
              'lineup.mixed': playerObjectId
            }
          }
        );

        // Delete Player document
        // Note: No Team cleanup needed - roster computed from Player.teamIds
        await Player.deleteOne({ _id: playerObjectId });

        console.log(`Deleted Player entity for user ${userId} with cascade cleanup`);
      } catch (error) {
        console.error(`Error deleting Player entity for user ${userId}:`, error);
        throw error;
      }
    }
  }

  /**
   * Batch create Player entities for multiple users
   * @param userIds - Array of user IDs to create players for
   * @returns Array of created player documents
   */
  static async batchCreatePlayers(userIds: (string | Schema.Types.ObjectId)[]): Promise<IPlayer[]> {
    const players: IPlayer[] = [];
    const errors: string[] = [];

    for (const userId of userIds) {
      try {
        // Check if Player already exists
        const existingPlayer = await Player.findOne({ userId });
        if (existingPlayer) {
          players.push(existingPlayer);
          continue;
        }

        // Create new Player entity
        const player = await this.createPlayerEntity(userId);
        players.push(player);
      } catch (error: any) {
        errors.push(`User ${userId}: ${error.message}`);
        console.error(`Failed to create Player for user ${userId}:`, error.message);
      }
    }

    if (errors.length > 0) {
      console.warn(`Batch create players completed with ${errors.length} errors:`, errors);
    }

    return players;
  }

  /**
   * Batch delete Player entities for multiple users
   * @param userIds - Array of user IDs to delete players for
   * @returns Array of error messages (empty if all successful)
   */
  static async batchDeletePlayers(userIds: (string | Schema.Types.ObjectId)[]): Promise<string[]> {
    const errors: string[] = [];

    for (const userId of userIds) {
      try {
        await this.deletePlayerEntity(userId);
      } catch (error: any) {
        errors.push(`User ${userId}: ${error.message}`);
        console.error(`Failed to delete Player for user ${userId}:`, error.message);
      }
    }

    if (errors.length > 0) {
      console.warn(`Batch delete players completed with ${errors.length} errors:`, errors);
    }

    return errors;
  }

  /**
   * Get user by ID
   * @param userId - User ID
   * @returns User document or null
   */
  static async getUserById(userId: string | Schema.Types.ObjectId): Promise<IUser | null> {
    return await User.findById(userId);
  }

  /**
   * Get all users
   * @returns Array of user documents
   */
  static async getAllUsers(): Promise<IUser[]> {
    return await User.find();
  }

  /**
   * Update user data (excluding player status)
   * @param userId - User ID to update
   * @param updates - Partial user data to update
   * @returns Updated user document
   */
  static async updateUser(
    userId: string | Schema.Types.ObjectId,
    updates: Partial<IUser>
  ): Promise<IUser | null> {
    // Prevent direct isPlayer updates (must use setPlayerStatus)
    const { isPlayer, ...safeUpdates } = updates as any;

    if (isPlayer !== undefined) {
      throw new Error('Use setPlayerStatus() to update player status');
    }

    return await User.findByIdAndUpdate(
      userId,
      { $set: safeUpdates },
      { new: true, runValidators: true }
    );
  }
}
