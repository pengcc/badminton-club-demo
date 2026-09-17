import { Team } from '../models/Team';
import { Player } from '../models/Player';
import { Match } from '../models/Match';
import mongoose, { Types, type ClientSession } from 'mongoose';
import {
  AuditEventType,
  EntityType,
  Gender,
} from '@club/shared-types/core/enums';
import {
  TeamPersistenceTransformer,
  TeamApiTransformer,
} from '../transformers/team';
import type { Domain } from '@club/shared-types/domain/team';
import type { Domain as PlayerDomain } from '@club/shared-types/domain/player';
import type { Api } from '@club/shared-types/api/team';
import { AppError } from '../utils/errors';
import { AuditService, type AuditActor } from './auditService';

type TeamDeletionActor = Pick<AuditActor, 'id' | 'accountKind'>;

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
      throw AppError.internal('Team transaction produced no result');
    }
    return result;
  } finally {
    await session.endSession();
  }
}

function canonicalTeamIds(
  teamIds: readonly (string | Types.ObjectId)[]
): Types.ObjectId[] {
  const idsByValue = new Map<string, Types.ObjectId>();
  for (const teamId of teamIds) {
    const value = teamId.toString();
    if (!Types.ObjectId.isValid(value)) {
      throw AppError.validation('Team identifier is invalid');
    }
    idsByValue.set(value, new Types.ObjectId(value));
  }
  return [...idsByValue.values()].sort((left, right) =>
    left.toString().localeCompare(right.toString())
  );
}

/**
 * Service for Team entity operations
 * Handles business logic and transformations between layers
 */
export class TeamService {
  /**
   * Claims existing Teams as the shared transaction coordination boundary for
   * commands that can create a current Team dependency.
   */
  static async claimTeams(
    teamIds: readonly (string | Types.ObjectId)[],
    session: ClientSession
  ): Promise<void> {
    const canonicalIds = canonicalTeamIds(teamIds);
    if (canonicalIds.length === 0) return;

    const claim = await Team.updateMany(
      { _id: { $in: canonicalIds } },
      { $inc: { __v: 1 } },
      { session, timestamps: false }
    );
    if (claim.matchedCount !== canonicalIds.length) {
      throw AppError.notFound('Team not found');
    }
  }

  /**
   * Resolve the active Player's current Team associations for an authenticated User.
   * This is the Competition scope fact consumed by Match list/detail authorization.
   */
  static async getCurrentTeamIdsForUser(
    userId: string
  ): Promise<Types.ObjectId[]> {
    if (!Types.ObjectId.isValid(userId)) return [];
    const player = await Player.findOne({
      userId: new Types.ObjectId(userId),
      isActivePlayer: true,
    })
      .select('teamIds')
      .lean();
    return player?.teamIds ?? [];
  }

  /**
   * Create a new team
   */
  static async createTeam(
    request: Api.CreateTeamRequest,
    creatorId: string
  ): Promise<Domain.Team> {
    const domainData = TeamApiTransformer.fromCreateRequest(request, creatorId);
    const persistenceData =
      TeamPersistenceTransformer.toPersistence(domainData);

    const team = await Team.create(persistenceData);

    return TeamPersistenceTransformer.toDomain(team.toObject() as any);
  }

  /**
   * Get team by ID
   * Note: playerIds computed from Player.teamIds (unidirectional relationship)
   */
  static async getTeamById(id: string): Promise<Domain.Team | null> {
    const team = await Team.findById(id).lean();
    if (!team) return null;

    // Compute playerIds from Player collection
    const players = await Player.find({
      teamIds: new Types.ObjectId(id),
      isActivePlayer: true,
    })
      .select('_id')
      .lean();

    const teamData = {
      ...team,
      playerIds: players.map((p) => p._id.toString()),
    };

    return TeamPersistenceTransformer.toDomain(teamData as any);
  }

  /**
   * Update an existing team
   * Note: playerIds is computed, not stored. Use PlayerService for roster changes.
   */
  static async updateTeam(
    id: string,
    request: Api.UpdateTeamRequest
  ): Promise<Domain.Team> {
    const updates = TeamApiTransformer.fromUpdateRequest(request);

    const team = await Team.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    }).lean();

    if (!team) {
      throw new AppError('Team not found', 404);
    }

    // Compute playerIds from Player collection
    const players = await Player.find({
      teamIds: new Types.ObjectId(id),
      isActivePlayer: true,
    })
      .select('_id')
      .lean();

    const teamData = {
      ...team,
      playerIds: players.map((p) => p._id.toString()),
    };

    return TeamPersistenceTransformer.toDomain(teamData as any);
  }

  /**
   * Delete a team
   */
  static async deleteTeam(id: string, actor: TeamDeletionActor): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw AppError.validation('Team identifier is invalid');
    }
    const teamId = new Types.ObjectId(id);

    await withTransaction(async (session) => {
      await this.claimTeams([teamId], session);
      const team = await Team.findById(teamId).session(session);
      if (!team) throw AppError.notFound('Team not found');

      const playerDependency = await Player.exists({ teamIds: teamId }).session(
        session
      );
      const matchDependency = await Match.exists({ teamId }).session(session);
      if (playerDependency || matchDependency) {
        throw new AppError(
          'Team cannot be deleted while Player or Match references exist',
          409,
          'TEAM_DELETE_DEPENDENCIES'
        );
      }

      const deletion = await Team.deleteOne(
        { _id: teamId, __v: team.get('__v') },
        { session }
      );
      if (deletion.deletedCount !== 1) {
        throw AppError.conflict(
          'Team changed before deletion could be applied'
        );
      }

      await AuditService.writeRequired(
        {
          eventType: AuditEventType.TEAM_DELETED,
          entityType: EntityType.TEAM,
          entityId: teamId,
          actor,
        },
        session
      );
      return teamId.toString();
    });
  }

  /**
   * Get team players
   * Computed from Player.teamIds (unidirectional - single source of truth)
   */
  static async getTeamPlayers(teamId: string): Promise<PlayerDomain.Player[]> {
    const team = await Team.findById(teamId);
    if (!team) {
      throw new AppError('Team not found', 404);
    }

    // Compute roster from Player.teamIds (single source of truth)
    const players = await Player.find({
      teamIds: new Types.ObjectId(teamId),
      isActivePlayer: true,
    }).lean();

    // Import PlayerPersistenceTransformer to convert to domain
    const { PlayerPersistenceTransformer } = await import(
      '../transformers/player'
    );
    return players.map((player) =>
      PlayerPersistenceTransformer.toDomain(player as any)
    );
  }

  /**
   * Get all teams
   * Computes playerIds for each team from Player.teamIds
   */
  static async getAllTeams(filter?: {
    matchLevel?: string;
    createdById?: string;
  }): Promise<Domain.Team[]> {
    const query: any = {};

    if (filter?.matchLevel) {
      query.matchLevel = filter.matchLevel;
    }

    if (filter?.createdById) {
      query.createdById = new Types.ObjectId(filter.createdById);
    }

    const teams = await Team.find(query).sort({ teamId: 1 }).lean();

    // Compute playerIds for all teams efficiently
    const teamIds = teams.map((t) => t._id);
    const playersByTeam = await Player.aggregate([
      {
        $match: {
          teamIds: { $in: teamIds },
          isActivePlayer: true,
        },
      },
      { $unwind: '$teamIds' },
      {
        $group: {
          _id: '$teamIds',
          playerIds: { $push: '$_id' },
        },
      },
    ]);

    // Create map for efficient lookup
    const playerMap = new Map(
      playersByTeam.map((item) => [item._id.toString(), item.playerIds])
    );

    // Attach computed playerIds to teams
    return teams.map((team) => {
      const playerIds = playerMap.get(team._id.toString()) || [];
      return TeamPersistenceTransformer.toDomain({
        ...team,
        playerIds: playerIds.map((id: Types.ObjectId) => id.toString()),
      } as any);
    });
  }

  /**
   * Get teams for a specific player
   * Queries Player.teamIds directly (unidirectional)
   */
  static async getTeamsForPlayer(playerId: string): Promise<Domain.Team[]> {
    const player = await Player.findOne({
      _id: playerId,
      isActivePlayer: true,
    }).lean();
    if (!player) return [];

    const teams = await Team.find({
      _id: { $in: player.teamIds },
    }).lean();

    // Attach computed playerIds for consistency
    const teamIds = teams.map((t) => t._id);
    const playersByTeam = await Player.aggregate([
      {
        $match: {
          teamIds: { $in: teamIds },
          isActivePlayer: true,
        },
      },
      { $unwind: '$teamIds' },
      {
        $group: {
          _id: '$teamIds',
          playerIds: { $push: '$_id' },
        },
      },
    ]);

    const playerMap = new Map(
      playersByTeam.map((item) => [item._id.toString(), item.playerIds])
    );

    return teams.map((team) => {
      const playerIds = playerMap.get(team._id.toString()) || [];
      return TeamPersistenceTransformer.toDomain({
        ...team,
        playerIds: playerIds.map((id: Types.ObjectId) => id.toString()),
      } as any);
    });
  }

  /**
   * Get team with player count statistics
   * Computes from Player.teamIds
   */
  static async getTeamWithStats(teamId: string): Promise<Api.TeamResponse> {
    const team = await this.getTeamById(teamId);
    if (!team) {
      throw new AppError('Team not found', 404);
    }

    // Count players in this team (from Player.teamIds)
    const totalPlayers = await Player.countDocuments({
      teamIds: new Types.ObjectId(teamId),
    });

    const activePlayers = await Player.countDocuments({
      teamIds: new Types.ObjectId(teamId),
      isActivePlayer: true,
    });

    return TeamApiTransformer.toApi(team, {
      playerCount: totalPlayers,
      activePlayerCount: activePlayers,
    });
  }

  /**
   * Get team statistics (player counts with gender breakdown)
   * Aggregates from Player → User for gender information
   * Note: Counts ALL players (active and inactive) to match Players tab behavior
   */
  static async getTeamStats(teamId: string): Promise<Api.TeamRosterSummary> {
    // Aggregate player stats with gender from User
    const stats = await Player.aggregate([
      // Match players in this team (both active and inactive)
      {
        $match: {
          teamIds: new Types.ObjectId(teamId),
        },
      },
      // Join with User to get gender
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },
      // Group by gender
      {
        $group: {
          _id: '$user.gender',
          count: { $sum: 1 },
        },
      },
    ]);

    // Format response
    const breakdown = {
      total: 0,
      male: 0,
      female: 0,
      nonBinary: 0,
    };

    stats.forEach((stat: any) => {
      breakdown.total += stat.count;
      if (stat._id === Gender.MALE) breakdown.male = stat.count;
      if (stat._id === Gender.FEMALE) breakdown.female = stat.count;
      if (stat._id === Gender.NON_BINARY) breakdown.nonBinary = stat.count;
    });

    return breakdown;
  }
}
