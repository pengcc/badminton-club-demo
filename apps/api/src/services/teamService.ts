import { Team } from '../models/Team';
import { Player } from '../models/Player';
import { Types } from 'mongoose';
import { TeamPersistenceTransformer, TeamApiTransformer } from '../transformers/team';
import type { Domain } from '@club/shared-types/domain/team';
import type { Domain as PlayerDomain } from '@club/shared-types/domain/player';
import type { Api } from '@club/shared-types/api/team';

/**
 * Service for Team entity operations
 * Handles business logic and transformations between layers
 */
export class TeamService {
  /**
   * Create a new team
   */
  static async createTeam(request: Api.CreateTeamRequest): Promise<Domain.Team> {
    const domainData = TeamApiTransformer.fromCreateRequest(request);
    const persistenceData = TeamPersistenceTransformer.toPersistence(domainData);

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
      isActivePlayer: true
    }).select('_id').lean();

    const teamData = {
      ...team,
      playerIds: players.map(p => p._id.toString())
    };

    return TeamPersistenceTransformer.toDomain(teamData as any);
  }

  /**
   * Update an existing team
   * Note: playerIds is computed, not stored. Use PlayerService for roster changes.
   */
  static async updateTeam(id: string, request: Api.UpdateTeamRequest): Promise<Domain.Team> {
    const updates = TeamApiTransformer.fromUpdateRequest(request);

    // Remove playerIds from updates - it's computed, not stored
    const { playerIds, ...persistenceUpdates } = updates as any;

    if (playerIds) {
      console.warn('⚠️  playerIds cannot be updated directly. Use PlayerService.addPlayerToTeam/removePlayerFromTeam');
    }

    const team = await Team.findByIdAndUpdate(
      id,
      persistenceUpdates,
      { new: true, runValidators: true }
    ).lean();

    if (!team) {
      throw new Error('Team not found');
    }

    // Compute playerIds from Player collection
    const players = await Player.find({
      teamIds: new Types.ObjectId(id),
      isActivePlayer: true
    }).select('_id').lean();

    const teamData = {
      ...team,
      playerIds: players.map(p => p._id.toString())
    };

    return TeamPersistenceTransformer.toDomain(teamData as any);
  }

  /**
   * Delete a team
   */
  static async deleteTeam(id: string): Promise<void> {
    const result = await Team.findByIdAndDelete(id);
    if (!result) {
      throw new Error('Team not found');
    }
  }

  /**
   * Get team players
   * Computed from Player.teamIds (unidirectional - single source of truth)
   */
  static async getTeamPlayers(teamId: string): Promise<PlayerDomain.Player[]> {
    const team = await Team.findById(teamId);
    if (!team) {
      throw new Error('Team not found');
    }

    // Compute roster from Player.teamIds (single source of truth)
    const players = await Player.find({
      teamIds: new Types.ObjectId(teamId),
      isActivePlayer: true
    }).lean();

    // Import PlayerPersistenceTransformer to convert to domain
    const { PlayerPersistenceTransformer } = await import('../transformers/player');
    return players.map(player => PlayerPersistenceTransformer.toDomain(player as any));
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

    const teams = await Team.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Compute playerIds for all teams efficiently
    const teamIds = teams.map(t => t._id);
    const playersByTeam = await Player.aggregate([
      {
        $match: {
          teamIds: { $in: teamIds },
          isActivePlayer: true
        }
      },
      { $unwind: '$teamIds' },
      {
        $group: {
          _id: '$teamIds',
          playerIds: { $push: '$_id' }
        }
      }
    ]);

    // Create map for efficient lookup
    const playerMap = new Map(
      playersByTeam.map(item => [item._id.toString(), item.playerIds])
    );

    // Attach computed playerIds to teams
    return teams.map(team => {
      const playerIds = playerMap.get(team._id.toString()) || [];
      return TeamPersistenceTransformer.toDomain({
        ...team,
        playerIds: playerIds.map((id: Types.ObjectId) => id.toString())
      } as any);
    });
  }

  /**
   * Get teams for a specific player
   * Queries Player.teamIds directly (unidirectional)
   */
  static async getTeamsForPlayer(playerId: string): Promise<Domain.Team[]> {
    const player = await Player.findById(playerId).lean();
    if (!player) return [];

    const teams = await Team.find({
      _id: { $in: player.teamIds }
    }).lean();

    // Attach computed playerIds for consistency
    const teamIds = teams.map(t => t._id);
    const playersByTeam = await Player.aggregate([
      {
        $match: {
          teamIds: { $in: teamIds },
          isActivePlayer: true
        }
      },
      { $unwind: '$teamIds' },
      {
        $group: {
          _id: '$teamIds',
          playerIds: { $push: '$_id' }
        }
      }
    ]);

    const playerMap = new Map(
      playersByTeam.map(item => [item._id.toString(), item.playerIds])
    );

    return teams.map(team => {
      const playerIds = playerMap.get(team._id.toString()) || [];
      return TeamPersistenceTransformer.toDomain({
        ...team,
        playerIds: playerIds.map((id: Types.ObjectId) => id.toString())
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
      throw new Error('Team not found');
    }

    // Count players in this team (from Player.teamIds)
    const totalPlayers = await Player.countDocuments({
      teamIds: new Types.ObjectId(teamId)
    });

    const activePlayers = await Player.countDocuments({
      teamIds: new Types.ObjectId(teamId),
      isActivePlayer: true
    });

    return TeamApiTransformer.toApi(team, {
      playerCount: totalPlayers,
      activePlayerCount: activePlayers
    });
  }

  /**
   * Get team statistics (player counts with gender breakdown)
   * Aggregates from Player → User for gender information
   * Note: Counts ALL players (active and inactive) to match Players tab behavior
   */
  static async getTeamStats(teamId: string): Promise<{
    total: number;
    male: number;
    female: number;
  }> {
    // Aggregate player stats with gender from User
    const stats = await Player.aggregate([
      // Match players in this team (both active and inactive)
      {
        $match: {
          teamIds: new Types.ObjectId(teamId)
        }
      },
      // Join with User to get gender
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      // Group by gender
      {
        $group: {
          _id: '$user.gender',
          count: { $sum: 1 }
        }
      }
    ]);

    // Format response
    const breakdown = {
      total: 0,
      male: 0,
      female: 0
    };

    stats.forEach((stat: any) => {
      breakdown.total += stat.count;
      if (stat._id === 'male') breakdown.male = stat.count;
      if (stat._id === 'female') breakdown.female = stat.count;
    });

    return breakdown;
  }
}
