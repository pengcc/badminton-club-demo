/**
 * Server Storage Adapter
 *
 * Pure delegation wrapper around existing API client methods.
 * No business logic, no data transformation - just passes calls through.
 *
 * ARCHITECTURE RULES:
 * - Zero business logic (pure delegation)
 * - No data transformation
 * - No caching or state management
 * - Direct pass-through to API client
 * - Maintains exact API signatures
 */

import type { StorageAdapter } from './StorageAdapter';
import type { Api as UserApi } from '@club/shared-types/api/user';
import type { Api as MatchApi } from '@club/shared-types/api/match';
import type { Api as TeamApi } from '@club/shared-types/api/team';
import type { Api as PlayerApi } from '@club/shared-types/api/player';
import type { PaginatedResponse } from '../api/types';
import type { UserFilterParams } from '../api/userApi';
import type { PlayerQueryParams } from '../api/playerApi';
import type { LineupPosition } from '@club/shared-types/core/enums';
import type { BaseLineupPlayer } from '@club/shared-types/core/base';

// Import existing API client methods
import * as UserAPI from '../api/userApi';
import * as MatchAPI from '../api/matchApi';
import * as TeamAPI from '../api/teamApi';
import * as PlayerAPI from '../api/playerApi';

/**
 * ServerAdapter - Pure delegation to existing API client
 *
 * This adapter ensures zero impact on existing server mode functionality.
 * Every method is a direct pass-through to the existing API client.
 */
export class ServerAdapter implements StorageAdapter {
  // ============================================================================
  // USER OPERATIONS - Direct delegation to UserAPI
  // ============================================================================

  async getUsers(): Promise<UserApi.UserResponse[]> {
    return UserAPI.getUsers();
  }

  async getUsersWithFilters(params?: UserFilterParams): Promise<PaginatedResponse<UserApi.UserResponse>> {
    return UserAPI.getUsersWithFilters(params);
  }

  async getUser(id: string): Promise<UserApi.UserResponse> {
    return UserAPI.getUser(id);
  }

  async createUser(userData: UserApi.CreateUserRequest): Promise<UserApi.UserResponse> {
    return UserAPI.createUser(userData);
  }

  async updateUser(id: string, userData: UserApi.UpdateUserRequest): Promise<UserApi.UserResponse> {
    return UserAPI.updateUser(id, userData);
  }

  async batchUpdateUsers(
    userIds: string[],
    updateData: Partial<UserApi.UpdateUserRequest>
  ): Promise<{ success: boolean; modifiedCount: number; users: UserApi.UserResponse[] }> {
    return UserAPI.batchUpdateUsers(userIds, updateData);
  }

  async deleteUser(id: string): Promise<{ success: boolean; message?: string }> {
    return UserAPI.deleteUser(id);
  }

  // ============================================================================
  // MATCH OPERATIONS - Direct delegation to MatchAPI
  // ============================================================================

  async getMatches(): Promise<MatchApi.MatchResponse[]> {
    return MatchAPI.getMatches();
  }

  async getMatch(id: string): Promise<MatchApi.MatchResponse> {
    return MatchAPI.getMatch(id);
  }

  async createMatch(matchData: MatchApi.CreateMatchRequest): Promise<MatchApi.MatchResponse> {
    return MatchAPI.createMatch(matchData);
  }

  async updateMatch(id: string, matchData: MatchApi.UpdateMatchRequest): Promise<MatchApi.MatchResponse> {
    return MatchAPI.updateMatch(id, matchData);
  }

  async deleteMatch(id: string): Promise<{ success: boolean; message?: string }> {
    return MatchAPI.deleteMatch(id);
  }

  async toggleMatchPlayerAvailability(
    matchId: string,
    playerId: string,
    isAvailable: boolean,
    note?: string
  ): Promise<MatchApi.MatchResponse> {
    return MatchAPI.toggleMatchPlayerAvailability(matchId, playerId, isAvailable, note);
  }

  async updateMatchLineup(
    matchId: string,
    lineup: Record<LineupPosition, BaseLineupPlayer[]>
  ): Promise<MatchApi.MatchResponse> {
    return MatchAPI.updateMatchLineup(matchId, lineup);
  }

  // ============================================================================
  // TEAM OPERATIONS - Direct delegation to TeamAPI
  // ============================================================================

  async getTeams(): Promise<TeamApi.TeamResponse[]> {
    return TeamAPI.getTeams();
  }

  async getTeam(id: string): Promise<TeamApi.TeamResponse> {
    return TeamAPI.getTeam(id);
  }

  async createTeam(teamData: TeamApi.CreateTeamRequest): Promise<TeamApi.TeamResponse> {
    return TeamAPI.createTeam(teamData);
  }

  async updateTeam(id: string, teamData: TeamApi.UpdateTeamRequest): Promise<TeamApi.TeamResponse> {
    return TeamAPI.updateTeam(id, teamData);
  }

  async deleteTeam(id: string): Promise<{ success: boolean; message?: string }> {
    return TeamAPI.deleteTeam(id);
  }

  async getTeamStats(id: string): Promise<{ total: number; male: number; female: number }> {
    return TeamAPI.getTeamStats(id);
  }

  // ============================================================================
  // PLAYER OPERATIONS - Direct delegation to PlayerAPI
  // ============================================================================

  async getPlayers(params?: PlayerQueryParams): Promise<PaginatedResponse<PlayerApi.PlayerResponse>> {
    return PlayerAPI.getPlayers(params);
  }

  async getPlayer(id: string): Promise<PlayerApi.PlayerResponse> {
    return PlayerAPI.getPlayer(id);
  }

  async createPlayer(playerData: PlayerApi.CreatePlayerRequest): Promise<PlayerApi.PlayerResponse> {
    return PlayerAPI.createPlayer(playerData);
  }

  async updatePlayer(id: string, playerData: PlayerApi.UpdatePlayerRequest): Promise<PlayerApi.PlayerResponse> {
    return PlayerAPI.updatePlayer(id, playerData);
  }

  async deletePlayer(id: string): Promise<{ success: boolean; message?: string }> {
    return PlayerAPI.deletePlayer(id);
  }

  async batchUpdatePlayers(
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
  ): Promise<{ success: boolean; updated: number }> {
    return PlayerAPI.batchUpdatePlayers(playerIds, updates);
  }

  async addPlayerToTeam(playerId: string, teamId: string): Promise<PlayerApi.PlayerResponse> {
    return PlayerAPI.addPlayerToTeam(playerId, teamId);
  }

  async removePlayerFromTeam(playerId: string, teamId: string): Promise<PlayerApi.PlayerResponse> {
    return PlayerAPI.removePlayerFromTeam(playerId, teamId);
  }

  // ============================================================================
  // AUTHENTICATION OPERATIONS - Direct delegation to AuthAPI
  // ============================================================================

  async login(credentials: { email: string; password: string }): Promise<{ user: any; token: string; refreshToken?: string }> {
    const AuthAPI = await import('../api/authApi');
    return AuthAPI.login(credentials);
  }

  async verifyToken(): Promise<any> {
    const AuthAPI = await import('../api/authApi');
    return AuthAPI.verifyToken();
  }

  async logout(): Promise<void> {
    const AuthAPI = await import('../api/authApi');
    return AuthAPI.logout();
  }

  // ============================================================================
  // DATA MANAGEMENT - Not supported in server mode
  // ============================================================================

  async clearAllData(): Promise<void> {
    throw new Error('clearAllData is not supported in server mode');
  }

  async getStorageSize(): Promise<number> {
    return 0; // Server mode doesn't track client storage
  }

  async checkStorageQuota(): Promise<{ usage: number; quota: number; percentage: number }> {
    return { usage: 0, quota: 0, percentage: 0 };
  }

  async exportData(): Promise<string> {
    throw new Error('exportData is not supported in server mode');
  }

  async importData(_json: string): Promise<void> {
    throw new Error('importData is not supported in server mode');
  }
}
