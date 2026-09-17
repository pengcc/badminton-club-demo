import { Types } from 'mongoose';
import type { Domain } from '@club/shared-types/domain/team';
import type { Persistence } from '../types/persistence/team';
import type { Api } from '@club/shared-types/api/team';
import { teamMatchLevelSchema } from '@club/shared-types/schemas/team';
import type { BaseDocument } from '../types/persistence/base';

/**
 * Team Persistence ↔ Domain Transformers
 * Handles ObjectId ↔ string conversions and BaseDocument mapping
 */
export class TeamPersistenceTransformer {
  /**
   * Transform Persistence.TeamDocument to Domain.Team
   * Converts ObjectId to string for domain layer
   */
  static toDomain(doc: Persistence.TeamDocument): Domain.Team {
    if (!doc._id) {
      throw new Error('TeamDocument missing _id field');
    }
    if (!doc.createdById) {
      throw new Error(`TeamDocument ${doc._id} missing createdById field`);
    }
    return {
      id: doc._id.toString(),
      teamId: doc.teamId,
      shortName: doc.shortName,
      leagueTeamName: doc.leagueTeamName,
      matchLevel: teamMatchLevelSchema.parse(doc.matchLevel),
      createdById: doc.createdById.toString(),
      playerIds: (doc.playerIds || []).map((id) => id.toString()),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  /**
   * Transform Domain.Team to Persistence.TeamDocument (for creation/update)
   * Converts string to ObjectId for persistence layer
   * Note: This returns a partial document without _id (for creation)
   */
  static toPersistence(
    team: Omit<Domain.Team, 'id' | 'createdAt' | 'updatedAt'>
  ): Omit<Persistence.TeamDocument, keyof BaseDocument> {
    return {
      teamId: team.teamId,
      shortName: team.shortName,
      leagueTeamName: team.leagueTeamName,
      matchLevel: team.matchLevel,
      createdById: new Types.ObjectId(team.createdById),
      playerIds: team.playerIds.map((id) => new Types.ObjectId(id)),
    };
  }
}

/**
 * Team Domain ↔ API Transformers
 * Handles Date ↔ ISO string conversions and computed fields
 */
export class TeamApiTransformer {
  /**
   * Transform Domain.Team to Api.TeamResponse
   * Converts Date to ISO string and adds computed fields
   */
  static toApi(
    team: Domain.Team,
    options?: {
      playerCount?: number;
      activePlayerCount?: number;
      matchCount?: number;
    }
  ): Api.TeamResponse {
    return {
      id: team.id,
      teamId: team.teamId,
      shortName: team.shortName,
      leagueTeamName: team.leagueTeamName,
      matchLevel: team.matchLevel,
      createdById: team.createdById,
      playerIds: team.playerIds,
      stats: {
        playerCount: options?.playerCount ?? team.playerIds.length,
        activePlayerCount: options?.activePlayerCount ?? team.playerIds.length,
      },
      createdAt: team.createdAt.toISOString(),
      updatedAt: team.updatedAt.toISOString(),
    };
  }

  /**
   * Transform Api.CreateTeamRequest to Domain.Team (partial)
   * Note: Returns partial team data for creation
   * Phase 3: playerIds initialized as empty, populated via Player endpoints
   */
  static fromCreateRequest(
    request: Api.CreateTeamRequest,
    creatorId: string
  ): Omit<Domain.Team, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      teamId: request.teamId,
      shortName: request.shortName,
      leagueTeamName: request.leagueTeamName,
      matchLevel: request.matchLevel,
      createdById: creatorId,
      playerIds: [], // Phase 3: Always start empty, use Player endpoints to add players
    };
  }

  /**
   * Transform Api.UpdateTeamRequest to partial Domain.Team
   * Handles partial updates
   * Phase 3: playerIds not updatable via Team endpoints (use Player endpoints)
   */
  static fromUpdateRequest(
    request: Api.UpdateTeamRequest
  ): Api.UpdateTeamRequest {
    const update: Api.UpdateTeamRequest = {};

    if (request.shortName !== undefined) update.shortName = request.shortName;
    if (request.leagueTeamName !== undefined)
      update.leagueTeamName = request.leagueTeamName;
    if (request.matchLevel !== undefined)
      update.matchLevel = request.matchLevel;
    // playerIds removed - Phase 3: Use Player endpoints for roster changes

    return update;
  }
}
