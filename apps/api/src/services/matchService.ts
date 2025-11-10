import { Match, IMatch } from '../models/Match';
import { Team } from '../models/Team';
import { Player } from '../models/Player';
import { Types } from 'mongoose';
import { MatchPersistenceTransformer, MatchApiTransformer } from '../transformers/match';
import { Domain } from '@club/shared-types/domain/match';
import { Api } from '@club/shared-types/api/match';
import { MatchStatus, LineupPosition } from '@club/shared-types/core/enums';
import { BaseLineupPlayer } from '@club/shared-types/core/base';

/**
 * Service for Match entity operations
 * Handles business logic and transformations between layers
 */
export class MatchService {
  /**
   * Helper: Populate lineup Map with player data and convert to Record<LineupPosition, BaseLineupPlayer[]>
   * Handles both Map (from Mongoose document) and Record (from .lean()) formats
   * Supports arrays of player IDs per position (for doubles/mixed)
   */
  private static async populateLineup(lineupData: Map<LineupPosition, Types.ObjectId[]> | Record<string, any>): Promise<Record<LineupPosition, BaseLineupPlayer[]>> {
    const lineup: Record<LineupPosition, BaseLineupPlayer[]> = {} as any;

    // Initialize all positions with empty arrays
    Object.values(LineupPosition).forEach(pos => {
      lineup[pos] = [];
    });

    // Convert to entries array - handle both Map and Record
    let entries: [string, Types.ObjectId[] | Types.ObjectId | null][];
    if (lineupData instanceof Map) {
      entries = Array.from(lineupData.entries());
    } else {
      entries = Object.entries(lineupData);
    }

    // Collect all player IDs to fetch in a single query
    const playerIds: Types.ObjectId[] = [];
    entries.forEach(([_, value]) => {
      if (Array.isArray(value)) {
        playerIds.push(...value.filter(id => id !== null));
      } else if (value !== null) {
        playerIds.push(value);
      }
    });

    if (playerIds.length === 0) {
      return lineup;
    }

    // Fetch all players at once with populated user data
    const players = await Player.find({ _id: { $in: playerIds } })
      .populate('userId', 'firstName lastName gender')
      .lean();

    // Create a map for quick lookup
    const playerMap = new Map(
      players.map((p: any) => [p._id.toString(), p])
    );

    // Populate lineup with player data
    entries.forEach(([position, value]) => {
      // Handle both array format (new) and single ID format (legacy)
      const playerIdArray = Array.isArray(value) ? value : (value ? [value] : []);

      playerIdArray.forEach(playerId => {
        if (playerId && playerMap.has(playerId.toString())) {
          const player: any = playerMap.get(playerId.toString())!;
          const user = player.userId;
          if (user) {
            lineup[position as LineupPosition].push({
              id: player._id.toString(),
              firstName: user.firstName,
              lastName: user.lastName,
              gender: user.gender
            });
          }
        }
      });
    });

    return lineup;
  }

  /**
   * Helper: Populate lineups for multiple matches efficiently
   * Supports arrays of player IDs per position (for doubles/mixed)
   */
  private static async populateMatchesLineup(matches: any[]): Promise<Domain.Match[]> {
    // Collect all unique player IDs from all matches
    const allPlayerIds = new Set<string>();
    matches.forEach(match => {
      if (match.lineup) {
        // Handle both Map and Record formats
        const entries = match.lineup instanceof Map
          ? Array.from(match.lineup.values())
          : Object.values(match.lineup);

        entries.forEach((value: any) => {
          // Handle both array format (new) and single ID format (legacy)
          if (Array.isArray(value)) {
            value.forEach(id => {
              if (id) allPlayerIds.add(id.toString());
            });
          } else if (value) {
            allPlayerIds.add(value.toString());
          }
        });
      }
    });

    // Fetch all players in a single query with populated user data
    const players = await Player.find({ _id: { $in: Array.from(allPlayerIds) } })
      .populate('userId', 'firstName lastName gender')
      .lean();

    // Create player lookup map
    const playerMap = new Map(
      players.map((p: any) => [p._id.toString(), p])
    );

    // Transform each match and populate its lineup
    return matches.map(match => {
      const lineup: Record<LineupPosition, BaseLineupPlayer[]> = {} as any;

      // Initialize all positions
      Object.values(LineupPosition).forEach(pos => {
        lineup[pos] = [];
      });

      // Populate lineup from match data
      if (match.lineup) {
        // Convert to entries array - handle both Map and Record
        let entries: [string, any][];
        if (match.lineup instanceof Map) {
          entries = Array.from(match.lineup.entries());
        } else {
          entries = Object.entries(match.lineup);
        }

        entries.forEach(([position, value]) => {
          // Handle both array format (new) and single ID format (legacy)
          const playerIdArray = Array.isArray(value) ? value : (value ? [value] : []);

          playerIdArray.forEach(playerId => {
            if (playerId && playerMap.has(playerId.toString())) {
              const player: any = playerMap.get(playerId.toString())!;
              const user = player.userId;
              if (user) {
                lineup[position as LineupPosition].push({
                  id: player._id.toString(),
                  firstName: user.firstName,
                  lastName: user.lastName,
                  gender: user.gender
                });
              }
            }
          });
        });
      }

      const domainMatch = MatchPersistenceTransformer.toDomain(match as any);
      domainMatch.lineup = lineup;
      return domainMatch;
    });
  }
  /**
   * Create a new match
   */
  static async createMatch(request: Api.CreateMatchRequest): Promise<Domain.Match> {
    const domainData = MatchApiTransformer.fromCreateRequest(request);

    // Initialize empty lineup
    const lineup = {} as any;
    Object.values(LineupPosition).forEach(pos => {
      lineup[pos] = [];
    });

    // Create persistence data
    const persistenceData = MatchPersistenceTransformer.toPersistence({
      ...domainData,
      status: MatchStatus.SCHEDULED,
      scores: undefined,
      unavailablePlayers: []
    });

    const match = await Match.create(persistenceData);

    return MatchPersistenceTransformer.toDomain(match.toObject() as any);
  }

  /**
   * Get match by ID
   */
  static async getMatchById(id: string): Promise<Domain.Match | null> {
    const match = await Match.findById(id).lean();
    if (!match) return null;

    // Populate lineup with player data
    const populatedLineup = await this.populateLineup(match.lineup);

    // Convert to domain with populated lineup
    const domainMatch = MatchPersistenceTransformer.toDomain(match as any);
    domainMatch.lineup = populatedLineup;

    return domainMatch;
  }

  /**
   * Update an existing match
   */
  static async updateMatch(id: string, request: Api.UpdateMatchRequest): Promise<Domain.Match> {
    const updates = MatchApiTransformer.fromUpdateRequest(request);

    // Convert partial updates to persistence format if needed
    const persistenceUpdates: any = {};
    if (updates.homeTeamId) {
      persistenceUpdates.homeTeamId = new Types.ObjectId(updates.homeTeamId);
    }
    if (updates.unavailablePlayers) {
      persistenceUpdates.unavailablePlayers = updates.unavailablePlayers.map(id => new Types.ObjectId(id));
    }
    // Copy other fields directly
    Object.keys(updates).forEach(key => {
      if (key !== 'homeTeamId' && key !== 'unavailablePlayers' && key !== 'id') {
        persistenceUpdates[key] = (updates as any)[key];
      }
    });

    const match = await Match.findByIdAndUpdate(
      id,
      persistenceUpdates,
      { new: true, runValidators: true }
    ).lean();

    if (!match) {
      throw new Error('Match not found');
    }

    // Populate lineup with player data
    const populatedLineup = await this.populateLineup(match.lineup);
    const domainMatch = MatchPersistenceTransformer.toDomain(match as any);
    domainMatch.lineup = populatedLineup;

    return domainMatch;
  }

  /**
   * Delete a match
   */
  static async deleteMatch(id: string): Promise<void> {
    const result = await Match.findByIdAndDelete(id);
    if (!result) {
      throw new Error('Match not found');
    }
  }

  /**
   * Update match lineup
   * Supports multiple players per position (for doubles/mixed)
   */
  static async updateLineup(
    matchId: string,
    lineup: Array<{ position: LineupPosition; playerId: string | null }>
  ): Promise<Domain.Match> {
    const match = await Match.findById(matchId);
    if (!match) {
      throw new Error('Match not found');
    }

    // Group players by position into arrays
    const lineupMap = new Map<LineupPosition, Types.ObjectId[]>();

    // Initialize all positions with empty arrays
    Object.values(LineupPosition).forEach(pos => {
      lineupMap.set(pos, []);
    });

    // Add players to their positions
    lineup.forEach(({ position, playerId }) => {
      if (playerId) {
        const positionPlayers = lineupMap.get(position) || [];
        positionPlayers.push(new Types.ObjectId(playerId));
        lineupMap.set(position, positionPlayers);
      }
    });

    console.log('📋 Updating lineup map:', {
      matchId,
      lineupMap: Array.from(lineupMap.entries()).map(([pos, ids]) => [pos, ids.map(id => id.toString())])
    });

    // The model expects a Map with array values
    (match as any).lineup = lineupMap;
    await match.save();

    // Populate lineup with player data before returning
    const savedMatch = await Match.findById(matchId).lean();
    if (!savedMatch) {
      throw new Error('Match not found after save');
    }

    const populatedLineup = await this.populateLineup(savedMatch.lineup);
    const domainMatch = MatchPersistenceTransformer.toDomain(savedMatch as any);
    domainMatch.lineup = populatedLineup;

    return domainMatch;
  }

  /**
   * Update match score
   */
  static async updateScore(
    matchId: string,
    homeScore: number,
    awayScore: number
  ): Promise<Domain.Match> {
    const match = await Match.findByIdAndUpdate(
      matchId,
      {
        scores: { homeScore, awayScore }
      },
      { new: true, runValidators: true }
    ).lean();

    if (!match) {
      throw new Error('Match not found');
    }

    // Populate lineup with player data
    const populatedLineup = await this.populateLineup(match.lineup);
    const domainMatch = MatchPersistenceTransformer.toDomain(match as any);
    domainMatch.lineup = populatedLineup;

    return domainMatch;
  }

  /**
   * Update match status
   */
  static async updateStatus(matchId: string, status: MatchStatus): Promise<Domain.Match> {
    const match = await Match.findByIdAndUpdate(
      matchId,
      { status },
      { new: true, runValidators: true }
    ).lean();

    if (!match) {
      throw new Error('Match not found');
    }

    // Populate lineup with player data
    const populatedLineup = await this.populateLineup(match.lineup);
    const domainMatch = MatchPersistenceTransformer.toDomain(match as any);
    domainMatch.lineup = populatedLineup;

    return domainMatch;
  }

  /**
   * Get matches by team ID
   */
  static async getMatchesByTeam(teamId: string): Promise<Domain.Match[]> {
    const matches = await Match.find({ homeTeamId: new Types.ObjectId(teamId) })
      .sort({ date: -1 })
      .lean();

    return this.populateMatchesLineup(matches);
  }

  /**
   * Get upcoming matches
   */
  static async getUpcomingMatches(): Promise<Domain.Match[]> {
    const now = new Date();
    const matches = await Match.find({
      date: { $gte: now },
      status: { $in: [MatchStatus.SCHEDULED, MatchStatus.IN_PROGRESS] }
    })
      .sort({ date: 1 })
      .lean();

    return this.populateMatchesLineup(matches);
  }

  /**
   * Get all matches
   */
  static async getAllMatches(filter?: {
    teamId?: string;
    status?: MatchStatus;
  }): Promise<Domain.Match[]> {
    const query: any = {};

    if (filter?.teamId) {
      query.homeTeamId = new Types.ObjectId(filter.teamId);
    }

    if (filter?.status) {
      query.status = filter.status;
    }

    const matches = await Match.find(query)
      .sort({ date: -1 })
      .lean();

    return this.populateMatchesLineup(matches);
  }

  /**
   * Get matches for a specific user (based on their team memberships)
   */
  static async getMatchesForUser(userId: string): Promise<Domain.Match[]> {
    // Find teams the user is a member of
    const teams = await Team.find({ playerIds: new Types.ObjectId(userId) }).lean();
    const teamIds = teams.map(team => team._id);

    // Find matches for those teams
    const matches = await Match.find({ homeTeamId: { $in: teamIds } })
      .sort({ date: -1 })
      .lean();

    return this.populateMatchesLineup(matches);
  }

  /**
   * Toggle player availability for a match
   * @param matchId - Match ID
   * @param playerId - Player ID to toggle
   * @param isAvailable - Whether player is available (true) or unavailable (false)
   */
  static async togglePlayerAvailability(
    matchId: string,
    playerId: string,
    isAvailable: boolean
  ): Promise<Domain.Match> {
    const match = await Match.findById(matchId);
    if (!match) {
      throw new Error('Match not found');
    }

    // Convert playerId to string for comparison
    const playerIdStr = playerId.toString();

    if (isAvailable) {
      // Remove from unavailable list if present
      match.unavailablePlayers = match.unavailablePlayers.filter(
        id => id.toString() !== playerIdStr
      );
    } else {
      // Add to unavailable list if not already present
      if (!match.unavailablePlayers.some(id => id.toString() === playerIdStr)) {
        match.unavailablePlayers.push(playerId as any);
      }
    }

    await match.save();

    return MatchPersistenceTransformer.toDomain(match.toObject() as any);
  }

  // Note: syncPlayerAvailability removed - auto-sync now happens automatically when:
  // - Player is removed from team (PlayerService.removePlayerFromTeam)
  // - Player is deleted (UserService.deletePlayerEntity)
}

