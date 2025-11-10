import { Types } from 'mongoose';
import { Domain } from '@club/shared-types/domain/player';
import { Persistence } from '../types/persistence/player';
import { Api } from '@club/shared-types/api/player';

/**
 * Player Persistence ↔ Domain Transformers
 * Handles ObjectId ↔ string conversions and BaseDocument mapping
 */
export class PlayerPersistenceTransformer {
  /**
   * Transform Persistence.PlayerDocument to Domain.Player
   * Converts ObjectId to string for domain layer
   * Note: matchIds is undefined (computed field, not stored)
   */
  static toDomain(doc: Persistence.PlayerDocument): Domain.Player {
    if (!doc._id) {
      throw new Error('PlayerDocument missing _id field');
    }
    if (!doc.userId) {
      throw new Error(`PlayerDocument ${doc._id} missing userId field`);
    }
    return {
      id: doc._id.toString(),
      userId: doc.userId.toString(),
      singlesRanking: doc.singlesRanking,
      doublesRanking: doc.doublesRanking,
      preferredPositions: doc.preferredPositions || [],
      isActivePlayer: doc.isActivePlayer,
      teamIds: (doc.teamIds || []).map(id => id.toString()),
      matchIds: undefined, // Computed field - not stored in database
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
  }

  /**
   * Transform Domain.Player to Persistence.PlayerDocument (for creation/update)
   * Converts string to ObjectId for persistence layer
   * Note: This returns a partial document without _id and timestamps (for creation)
   * Note: matchIds is not included (computed field, never stored)
   */
  static toPersistence(
    player: Omit<Domain.Player, 'id' | 'matchIds' | 'createdAt' | 'updatedAt'>
  ): Omit<Persistence.PlayerDocument, keyof import('../types/persistence/base').BaseDocument> {
    return {
      userId: new Types.ObjectId(player.userId),
      singlesRanking: player.singlesRanking,
      doublesRanking: player.doublesRanking,
      preferredPositions: player.preferredPositions,
      isActivePlayer: player.isActivePlayer,
      teamIds: player.teamIds.map(id => new Types.ObjectId(id))
      // matchIds NOT included - computed field
    };
  }
}

/**
 * Player Domain ↔ API Transformers
 * Handles Date ↔ ISO string conversions and computed fields
 */
export class PlayerApiTransformer {
  /**
   * Transform Domain.Player to Api.PlayerResponse
   * Converts Date to ISO string
   * Optionally includes computed fields (matchCount) and user info
   */
  static toApi(player: Domain.Player, options?: {
    userName?: string;
    userEmail?: string;
    userGender?: string;
  }): Api.PlayerResponse {
    // Compute rankingDisplay: "singles/doubles"
    const rankingDisplay = `${player.singlesRanking}/${player.doublesRanking}`;

    return {
      id: player.id,
      userId: player.userId,
      userName: options?.userName || '',
      userEmail: options?.userEmail || '',
      userGender: options?.userGender,
      singlesRanking: player.singlesRanking,
      doublesRanking: player.doublesRanking,
      rankingDisplay: rankingDisplay,
      preferredPositions: player.preferredPositions,
      isActivePlayer: player.isActivePlayer,
      teamIds: player.teamIds,
      matchCount: player.matchIds?.length || 0,  // Computed from matchIds if available
      createdAt: player.createdAt.toISOString(),
      updatedAt: player.updatedAt.toISOString()
    };
  }

  /**
   * Transform Api.CreatePlayerRequest to Domain.Player (partial)
   * Used when creating a new player
   */
  static fromCreateRequest(
    req: Api.CreatePlayerRequest
  ): Omit<Domain.Player, 'id' | 'matchIds' | 'createdAt' | 'updatedAt'> {
    return {
      userId: req.userId,
      singlesRanking: req.singlesRanking || 0,
      doublesRanking: req.doublesRanking || 0,
      preferredPositions: req.preferredPositions || [],
      isActivePlayer: req.isActivePlayer ?? true,
      teamIds: req.teamIds || []
    };
  }

  /**
   * Transform Api.UpdatePlayerRequest to Partial<Domain.Player>
   * Used when updating an existing player
   */
  static fromUpdateRequest(req: Api.UpdatePlayerRequest): Partial<Domain.Player> {
    const update: Partial<Domain.Player> = {};

    if (req.singlesRanking !== undefined) update.singlesRanking = req.singlesRanking;
    if (req.doublesRanking !== undefined) update.doublesRanking = req.doublesRanking;
    if (req.preferredPositions !== undefined) update.preferredPositions = req.preferredPositions;
    if (req.isActivePlayer !== undefined) update.isActivePlayer = req.isActivePlayer;
    if (req.teamIds !== undefined) update.teamIds = req.teamIds;

    return update;
  }
}
