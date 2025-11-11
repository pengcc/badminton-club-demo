/**
 * Storage Adapter Interface
 *
 * Defines the contract for all storage implementations (Server and Local).
 * All methods match existing API signatures from apps/web/app/lib/api/*.ts
 *
 * ARCHITECTURE RULES:
 * - Interface mirrors existing API client methods exactly
 * - No new type properties allowed
 * - All types come from @club/shared-types
 * - ServerAdapter is pure delegation
 * - LocalAdapter implements same signatures with IndexedDB
 */

import type { Api as UserApi } from '@club/shared-types/api/user';
import type { Api as MatchApi } from '@club/shared-types/api/match';
import type { Api as TeamApi } from '@club/shared-types/api/team';
import type { Api as PlayerApi } from '@club/shared-types/api/player';
import type { PaginatedResponse } from '../api/types';
import type { UserFilterParams } from '../api/userApi';
import type { PlayerQueryParams } from '../api/playerApi';
import type { LineupPosition } from '@club/shared-types/core/enums';
import type { BaseLineupPlayer } from '@club/shared-types/core/base';

/**
 * Core storage adapter interface
 * All methods return Promises to support both async server calls and async IndexedDB operations
 */
export interface StorageAdapter {
  // ============================================================================
  // USER OPERATIONS
  // ============================================================================

  /**
   * Get all users (no pagination)
   */
  getUsers(): Promise<UserApi.UserResponse[]>;

  /**
   * Get users with filters and pagination
   */
  getUsersWithFilters(params?: UserFilterParams): Promise<PaginatedResponse<UserApi.UserResponse>>;

  /**
   * Get a single user by ID
   */
  getUser(id: string): Promise<UserApi.UserResponse>;

  /**
   * Create a new user
   */
  createUser(userData: UserApi.CreateUserRequest): Promise<UserApi.UserResponse>;

  /**
   * Update an existing user
   */
  updateUser(id: string, userData: UserApi.UpdateUserRequest): Promise<UserApi.UserResponse>;

  /**
   * Batch update multiple users
   */
  batchUpdateUsers(
    userIds: string[],
    updateData: Partial<UserApi.UpdateUserRequest>
  ): Promise<{ success: boolean; modifiedCount: number; users: UserApi.UserResponse[] }>;

  /**
   * Delete a user
   */
  deleteUser(id: string): Promise<{ success: boolean; message?: string }>;

  // ============================================================================
  // MATCH OPERATIONS
  // ============================================================================

  /**
   * Get all matches (no pagination)
   */
  getMatches(): Promise<MatchApi.MatchResponse[]>;

  /**
   * Get match by ID
   */
  getMatch(id: string): Promise<MatchApi.MatchResponse>;

  /**
   * Create a new match
   */
  createMatch(matchData: MatchApi.CreateMatchRequest): Promise<MatchApi.MatchResponse>;

  /**
   * Update an existing match
   */
  updateMatch(id: string, matchData: MatchApi.UpdateMatchRequest): Promise<MatchApi.MatchResponse>;

  /**
   * Delete a match
   */
  deleteMatch(id: string): Promise<{ success: boolean; message?: string }>;

  /**
   * Toggle player availability for a match
   */
  toggleMatchPlayerAvailability(
    matchId: string,
    playerId: string,
    isAvailable: boolean,
    note?: string
  ): Promise<MatchApi.MatchResponse>;

  /**
   * Update match lineup
   */
  updateMatchLineup(
    matchId: string,
    lineup: Record<LineupPosition, BaseLineupPlayer[]>
  ): Promise<MatchApi.MatchResponse>;

  // ============================================================================
  // TEAM OPERATIONS
  // ============================================================================

  /**
   * Get all teams (no pagination)
   */
  getTeams(): Promise<TeamApi.TeamResponse[]>;

  /**
   * Get a single team by ID
   */
  getTeam(id: string): Promise<TeamApi.TeamResponse>;

  /**
   * Create a new team
   */
  createTeam(teamData: TeamApi.CreateTeamRequest): Promise<TeamApi.TeamResponse>;

  /**
   * Update an existing team
   */
  updateTeam(id: string, teamData: TeamApi.UpdateTeamRequest): Promise<TeamApi.TeamResponse>;

  /**
   * Delete a team
   */
  deleteTeam(id: string): Promise<{ success: boolean; message?: string }>;

  /**
   * Get team statistics (player counts with gender breakdown)
   */
  getTeamStats(id: string): Promise<{ total: number; male: number; female: number }>;

  // ============================================================================
  // PLAYER OPERATIONS
  // ============================================================================

  /**
   * Get all players with optional filters and pagination
   */
  getPlayers(params?: PlayerQueryParams): Promise<PaginatedResponse<PlayerApi.PlayerResponse>>;

  /**
   * Get a single player by ID
   */
  getPlayer(id: string): Promise<PlayerApi.PlayerResponse>;

  /**
   * Create a new player
   */
  createPlayer(playerData: PlayerApi.CreatePlayerRequest): Promise<PlayerApi.PlayerResponse>;

  /**
   * Update an existing player
   */
  updatePlayer(id: string, playerData: PlayerApi.UpdatePlayerRequest): Promise<PlayerApi.PlayerResponse>;

  /**
   * Delete a player
   */
  deletePlayer(id: string): Promise<{ success: boolean; message?: string }>;

  /**
   * Batch update multiple players
   */
  batchUpdatePlayers(
    playerIds: string[],
    updates: {
      isActivePlayer?: boolean;
      singlesRanking?: number;
      doublesRanking?: number;
      ranking?: number;
      rankingOffset?: number;
      addToTeams?: string[];
      removeFromTeams?: string[];
    }
  ): Promise<{ success: boolean; updated: number }>;

  /**
   * Add a player to a team
   */
  addPlayerToTeam(playerId: string, teamId: string): Promise<PlayerApi.PlayerResponse>;

  /**
   * Remove a player from a team
   */
  removePlayerFromTeam(playerId: string, teamId: string): Promise<PlayerApi.PlayerResponse>;

  // ============================================================================
  // AUTHENTICATION OPERATIONS
  // ============================================================================

  /**
   * Login with credentials
   * Server mode: calls API
   * Local mode: validates against local users, returns mock token
   */
  login(credentials: { email: string; password: string }): Promise<{ user: any; token: string; refreshToken?: string }>;

  /**
   * Verify token
   * Server mode: calls API
   * Local mode: validates mock token, returns user
   */
  verifyToken(): Promise<any>;

  /**
   * Logout
   * Server mode: calls API
   * Local mode: clears mock token
   */
  logout(): Promise<void>;

  // ============================================================================
  // DATA MANAGEMENT (Local Mode Only)
  // ============================================================================

  /**
   * Clear all local data and reset to defaults
   * Server mode: throws error
   * Local mode: clears IndexedDB and reloads seed data
   */
  clearAllData?(): Promise<void>;

  /**
   * Get storage size in bytes
   * Server mode: returns 0
   * Local mode: returns IndexedDB usage
   */
  getStorageSize?(): Promise<number>;

  /**
   * Check storage quota
   * Server mode: returns { usage: 0, quota: 0, percentage: 0 }
   * Local mode: returns actual quota info
   */
  checkStorageQuota?(): Promise<{ usage: number; quota: number; percentage: number }>;

  /**
   * Export all data as JSON
   * Server mode: throws error
   * Local mode: exports IndexedDB data
   */
  exportData?(): Promise<string>;

  /**
   * Import data from JSON
   * Server mode: throws error
   * Local mode: imports into IndexedDB
   */
  importData?(json: string): Promise<void>;
}
