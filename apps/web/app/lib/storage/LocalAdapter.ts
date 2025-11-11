/**
 * Local Storage Adapter (Placeholder)
 *
 * TODO: Phase 2 implementation
 * - Set up IndexedDB with Dexie.js
 * - Implement all StorageAdapter methods
 * - Load seed data on initialization
 * - Implement data management methods
 *
 * This placeholder allows Phase 1 code to compile.
 */

import type { StorageAdapter } from './StorageAdapter';
import type { Api as UserApi } from '@club/shared-types/api/user';
import type { Api as MatchApi } from '@club/shared-types/api/match';
import type { Api as TeamApi } from '@club/shared-types/api/team';
import type { Api as PlayerApi } from '@club/shared-types/api/player';
import type { PaginatedResponse } from '../api/types';
import type { UserFilterParams } from '../api/userApi';
import type { PlayerQueryParams } from '../api/playerApi';

export class LocalAdapter implements StorageAdapter {
  // User methods
  async getUsers(): Promise<UserApi.UserResponse[]> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  async getUsersWithFilters(_params?: UserFilterParams): Promise<PaginatedResponse<UserApi.UserResponse>> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  async getUser(_id: string): Promise<UserApi.UserResponse> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  async createUser(_data: UserApi.CreateUserRequest): Promise<UserApi.UserResponse> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  async updateUser(_id: string, _data: UserApi.UpdateUserRequest): Promise<UserApi.UserResponse> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  async batchUpdateUsers(_userIds: string[], _updateData: Partial<UserApi.UpdateUserRequest>): Promise<{
    success: boolean;
    modifiedCount: number;
    users: UserApi.UserResponse[];
  }> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  async deleteUser(_id: string): Promise<{ success: boolean; message?: string }> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  // Match methods
  async getMatches(): Promise<MatchApi.MatchResponse[]> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  async getMatch(_id: string): Promise<MatchApi.MatchResponse> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  async createMatch(_data: MatchApi.CreateMatchRequest): Promise<MatchApi.MatchResponse> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  async updateMatch(_id: string, _data: MatchApi.UpdateMatchRequest): Promise<MatchApi.MatchResponse> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  async deleteMatch(_id: string): Promise<{ success: boolean; message?: string }> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  async toggleMatchPlayerAvailability(
    _matchId: string,
    _playerId: string,
    _isAvailable: boolean,
    _note?: string
  ): Promise<MatchApi.MatchResponse> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  async updateMatchLineup(
    _matchId: string,
    _lineup: Record<string, any[]>
  ): Promise<MatchApi.MatchResponse> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  // Team methods
  async getTeams(): Promise<TeamApi.TeamResponse[]> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  async getTeam(_id: string): Promise<TeamApi.TeamResponse> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  async createTeam(_data: TeamApi.CreateTeamRequest): Promise<TeamApi.TeamResponse> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  async updateTeam(_id: string, _data: TeamApi.UpdateTeamRequest): Promise<TeamApi.TeamResponse> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  async deleteTeam(_id: string): Promise<{ success: boolean; message?: string }> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  async getTeamStats(_id: string): Promise<{ total: number; male: number; female: number }> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  // Player methods
  async getPlayers(_params?: PlayerQueryParams): Promise<PaginatedResponse<PlayerApi.PlayerResponse>> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  async getPlayer(_id: string): Promise<PlayerApi.PlayerResponse> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  async createPlayer(_data: PlayerApi.CreatePlayerRequest): Promise<PlayerApi.PlayerResponse> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  async updatePlayer(_id: string, _data: PlayerApi.UpdatePlayerRequest): Promise<PlayerApi.PlayerResponse> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  async deletePlayer(_id: string): Promise<{ success: boolean; message?: string }> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  async batchUpdatePlayers(
    _playerIds: string[],
    _updates: {
      isActivePlayer?: boolean;
      singlesRanking?: number;
      doublesRanking?: number;
      ranking?: number;
      rankingOffset?: number;
      addToTeams?: string[];
      removeFromTeams?: string[];
    }
  ): Promise<{ success: boolean; updated: number }> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  async addPlayerToTeam(_playerId: string, _teamId: string): Promise<PlayerApi.PlayerResponse> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }

  async removePlayerFromTeam(_playerId: string, _teamId: string): Promise<PlayerApi.PlayerResponse> {
    throw new Error('LocalAdapter not implemented yet - Phase 2');
  }
}
