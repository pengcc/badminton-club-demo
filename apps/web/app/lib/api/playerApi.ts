import apiClient from './client';
import type { ApiResponse, PaginatedResponse, PaginationParams } from './types';
import type { Api } from '@club/shared-types/api/player';

/**
 * Player API module
 * Handles all player-related HTTP requests with full type safety
 */

/**
 * Query parameters for player list
 */
export interface PlayerQueryParams extends PaginationParams {
  team?: string;
  isActive?: boolean;
  search?: string;
}

/**
 * Get all players with optional filters
 */
export const getPlayers = async (
  params?: PlayerQueryParams
): Promise<PaginatedResponse<Api.PlayerResponse>> => {
  const response = await apiClient.get<PaginatedResponse<Api.PlayerResponse>>(
    '/players',
    { params }
  );
  return response.data;
};

/**
 * Get a single player by ID
 */
export const getPlayer = async (id: string): Promise<Api.PlayerResponse> => {
  const response = await apiClient.get<ApiResponse<Api.PlayerResponse>>(`/players/${id}`);
  return response.data.data;
};

/**
 * Create a new player
 */
export const createPlayer = async (
  playerData: Api.CreatePlayerRequest
): Promise<Api.PlayerResponse> => {
  const response = await apiClient.post<ApiResponse<Api.PlayerResponse>>('/players', playerData);
  return response.data.data;
};

/**
 * Update an existing player
 */
export const updatePlayer = async (
  id: string,
  playerData: Api.UpdatePlayerRequest
): Promise<Api.PlayerResponse> => {
  const response = await apiClient.put<ApiResponse<Api.PlayerResponse>>(
    `/players/${id}`,
    playerData
  );
  return response.data.data;
};

/**
 * Delete a player
 */
export const deletePlayer = async (id: string): Promise<{ success: boolean; message?: string }> => {
  const response = await apiClient.delete<ApiResponse<null>>(`/players/${id}`);
  return { success: response.data.success, message: response.data.message };
};

/**
 * Batch update multiple players (admin only)
 */
export const batchUpdatePlayers = async (
  playerIds: string[],
  updates: {
    isActivePlayer?: boolean;
    singlesRanking?: number;
    doublesRanking?: number;
    /** @deprecated Use singlesRanking and doublesRanking */
    ranking?: number;
    rankingOffset?: number;
    addToTeams?: string[];
    removeFromTeams?: string[];
  }
): Promise<{ success: boolean; updated: number }> => {
  const response = await apiClient.post<ApiResponse<{ updated: number }>>(
    '/players/batch-update',
    { playerIds, updates }
  );
  return { success: response.data.success, updated: response.data.data.updated };
};

/**
 * Add a player to a team
 */
export const addPlayerToTeam = async (
  playerId: string,
  teamId: string
): Promise<Api.PlayerResponse> => {
  const response = await apiClient.post<ApiResponse<Api.PlayerResponse>>(
    `/players/${playerId}/teams/${teamId}`
  );
  return response.data.data;
};

/**
 * Remove a player from a team
 */
export const removePlayerFromTeam = async (
  playerId: string,
  teamId: string
): Promise<Api.PlayerResponse> => {
  const response = await apiClient.delete<ApiResponse<Api.PlayerResponse>>(
    `/players/${playerId}/teams/${teamId}`
  );
  return response.data.data;
};
