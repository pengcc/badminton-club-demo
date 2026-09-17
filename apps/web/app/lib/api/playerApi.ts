import apiClient from './client';
import type { ApiResponse } from './types';
import type { Api } from '@club/shared-types/api/player';

/**
 * Player API module
 * Handles all player-related HTTP requests with full type safety
 */

/**
 * Get all players
 */
export const getPlayers = async (): Promise<Api.PlayerResponse[]> => {
  const response = await apiClient.get<Api.PlayerListResponse>('/players');
  return response.data.data;
};

/**
 * Get a single player by ID
 */
export const getPlayer = async (id: string): Promise<Api.PlayerResponse> => {
  const response = await apiClient.get<ApiResponse<Api.PlayerResponse>>(
    `/players/${id}`
  );
  return response.data.data;
};

/**
 * Create a new player
 */
export const createPlayer = async (
  playerData: Api.CreatePlayerRequest
): Promise<Api.PlayerResponse> => {
  const response = await apiClient.post<ApiResponse<Api.PlayerResponse>>(
    '/players',
    playerData
  );
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
export const deletePlayer = async (
  id: string,
  idempotencyKey: string
): Promise<{ success: boolean; message?: string }> => {
  const response = await apiClient.delete<ApiResponse<null>>(`/players/${id}`, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return { success: response.data.success, message: response.data.message };
};

export const setPlayerParticipation = async (
  id: string,
  isActivePlayer: boolean,
  idempotencyKey: string
): Promise<Api.PlayerResponse> => {
  const response = await apiClient.patch<ApiResponse<Api.PlayerResponse>>(
    `/players/${id}/active-status`,
    { isActivePlayer },
    { headers: { 'Idempotency-Key': idempotencyKey } }
  );
  return response.data.data;
};

export const getPlayerLifecycleCandidates = async (): Promise<
  Api.PlayerLifecycleCandidate[]
> => {
  const response = await apiClient.get<
    ApiResponse<Api.PlayerLifecycleCandidate[]>
  >('/players/lifecycle/candidates');
  return response.data.data;
};

export const batchPlayerLifecycle = async (
  request: Api.PlayerLifecycleBatchRequest,
  idempotencyKey: string
): Promise<Api.PlayerLifecycleBatchResult> => {
  const response = await apiClient.post<
    ApiResponse<Api.PlayerLifecycleBatchResult>
  >('/players/lifecycle/batch', request, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return response.data.data;
};

export const cleanupPlayer = async (
  id: string,
  reason: string
): Promise<Api.PlayerCleanupResult> => {
  const response = await apiClient.post<ApiResponse<Api.PlayerCleanupResult>>(
    `/players/${id}/cleanup`,
    { reason }
  );
  return response.data.data;
};

export const convertFormerMemberToExternal = async (
  id: string,
  request: Api.ConvertFormerMemberToExternalRequest,
  idempotencyKey: string
): Promise<Api.PlayerResponse> => {
  const response = await apiClient.post<ApiResponse<Api.PlayerResponse>>(
    `/players/lifecycle/${id}/convert-to-external`,
    request,
    { headers: { 'Idempotency-Key': idempotencyKey } }
  );
  return response.data.data;
};

/**
 * Batch update multiple players (admin only)
 */
export const batchUpdatePlayers = async (
  request: Api.BatchUpdatePlayersRequest,
  idempotencyKey: string
): Promise<Api.BatchUpdatePlayersResult> => {
  const response = await apiClient.post<
    ApiResponse<Api.BatchUpdatePlayersResult>
  >('/players/batch-update', request, {
    headers: { 'Idempotency-Key': idempotencyKey },
  });
  return response.data.data;
};
