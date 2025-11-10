import { Types } from 'mongoose';
import { Domain } from '@club/shared-types/domain/match';
import { Persistence } from '../types/persistence/match';
import { Api } from '@club/shared-types/api/match';
import { MatchStatus } from '@club/shared-types/core/enums';

/**
 * Match Persistence ↔ Domain Transformers
 * Handles ObjectId ↔ string conversions and BaseDocument mapping
 */
export class MatchPersistenceTransformer {
  /**
   * Transform Persistence.MatchDocument to Domain.Match
   * Converts ObjectId to string for domain layer
   */
  static toDomain(doc: Persistence.MatchDocument): Domain.Match {
    if (!doc._id) {
      throw new Error('MatchDocument missing _id field');
    }
    if (!doc.homeTeamId) {
      throw new Error(`MatchDocument ${doc._id} missing homeTeamId field`);
    }
    if (!doc.createdById) {
      throw new Error(`MatchDocument ${doc._id} missing createdById field`);
    }
    return {
      id: doc._id.toString(),
      date: doc.date,
      time: doc.time,
      location: doc.location,
      status: doc.status,
      homeTeamId: doc.homeTeamId.toString(),
      awayTeamName: doc.awayTeamName,
      createdById: doc.createdById.toString(),
      scores: doc.scores,
      lineup: doc.lineup,
      unavailablePlayers: (doc.unavailablePlayers || []).map(id => id.toString()),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt
    };
  }

  /**
   * Transform Domain.Match to Persistence.MatchDocument (for creation/update)
   * Converts string to ObjectId for persistence layer
   * Note: This returns a partial document without _id (for creation)
   */
  static toPersistence(
    match: Omit<Domain.Match, 'id' | 'createdAt' | 'updatedAt'>
  ): Omit<Persistence.MatchDocument, keyof import('../types/persistence/base').BaseDocument> {
    // Validate ObjectId fields before conversion
    if (!match.homeTeamId || !Types.ObjectId.isValid(match.homeTeamId)) {
      throw new Error(`Invalid homeTeamId: ${match.homeTeamId}`);
    }
    if (!match.createdById || !Types.ObjectId.isValid(match.createdById)) {
      throw new Error(`Invalid createdById: ${match.createdById}`);
    }

    return {
      date: match.date,
      time: match.time,
      location: match.location,
      status: match.status,
      homeTeamId: new Types.ObjectId(match.homeTeamId),
      awayTeamName: match.awayTeamName,
      createdById: new Types.ObjectId(match.createdById),
      scores: match.scores,
      cancellationReason: match.cancellationReason,
      lineup: match.lineup,
      unavailablePlayers: match.unavailablePlayers.map(id => new Types.ObjectId(id))
    };
  }
}

/**
 * Match Domain ↔ API Transformers
 * Handles Date ↔ ISO string conversions and computed fields
 */
export class MatchApiTransformer {
  /**
   * Format date for display
   */
  private static formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  }

  /**
   * Get status badge configuration
   */
  private static getStatusBadge(status: MatchStatus): { text: string; color: string } {
    switch (status) {
      case MatchStatus.SCHEDULED:
        return { text: 'Scheduled', color: 'blue' };
      case MatchStatus.IN_PROGRESS:
        return { text: 'In Progress', color: 'yellow' };
      case MatchStatus.COMPLETED:
        return { text: 'Completed', color: 'green' };
      case MatchStatus.CANCELLED:
        return { text: 'Cancelled', color: 'red' };
      default:
        return { text: 'Unknown', color: 'gray' };
    }
  }

  /**
   * Transform Domain.Match to Api.MatchResponse
   * Converts Date to ISO string and adds computed fields
   */
  static toApi(match: Domain.Match, options?: {
    totalPlayerCount?: number;
  }): Api.MatchResponse {
    const availablePlayerCount = options?.totalPlayerCount
      ? options.totalPlayerCount - match.unavailablePlayers.length
      : 0;

    return {
      id: match.id,
      date: match.date.toISOString().split('T')[0], // YYYY-MM-DD
      time: match.time,
      location: match.location,
      status: match.status,
      homeTeamId: match.homeTeamId,
      awayTeamName: match.awayTeamName,
      createdById: match.createdById,
      scores: match.scores,
      cancellationReason: match.cancellationReason,
      lineup: match.lineup,
      unavailablePlayers: match.unavailablePlayers,
      metadata: {
        formattedDate: this.formatDate(match.date),
        statusBadge: this.getStatusBadge(match.status),
        availablePlayerCount,
        totalPlayerCount: options?.totalPlayerCount ?? 0
      },
      createdAt: match.createdAt.toISOString(),
      updatedAt: match.updatedAt.toISOString()
    };
  }

  /**
   * Transform Api.CreateMatchRequest to Domain.Match (partial)
   * Converts ISO string to Date
   * Note: Returns partial match data for creation
   */
  static fromCreateRequest(
    request: Api.CreateMatchRequest
  ): Omit<Domain.Match, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'scores' | 'unavailablePlayers'> {
    return {
      date: new Date(request.date),
      time: request.time,
      location: request.location,
      homeTeamId: request.homeTeamId,
      awayTeamName: request.awayTeamName,
      createdById: request.createdById,
      lineup: request.lineup ?? {} as any
    };
  }

  /**
   * Transform Api.UpdateMatchRequest to partial Domain.Match
   * Handles partial updates
   */
  static fromUpdateRequest(
    request: Api.UpdateMatchRequest
  ): Partial<Omit<Domain.Match, 'id' | 'createdAt' | 'updatedAt' | 'createdById'>> {
    const update: Partial<Omit<Domain.Match, 'id' | 'createdAt' | 'updatedAt' | 'createdById'>> = {};

    if (request.date !== undefined) update.date = new Date(request.date);
    if (request.time !== undefined) update.time = request.time;
    if (request.location !== undefined) update.location = request.location;
    if (request.status !== undefined) update.status = request.status as MatchStatus;
    if (request.awayTeamName !== undefined) update.awayTeamName = request.awayTeamName;
    if (request.scores !== undefined) update.scores = request.scores;
    if (request.lineup !== undefined) update.lineup = request.lineup;
    if (request.unavailablePlayers !== undefined) update.unavailablePlayers = request.unavailablePlayers;

    return update;
  }
}
