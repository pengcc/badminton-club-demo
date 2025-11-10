import apiClient from './client';
import { ApiResponse } from './types';
import { Api } from '@club/shared-types/api/match';
import { BaseLineupPlayer } from '@club/shared-types/core/base';
import { LineupPosition } from '@club/shared-types/core/enums';

/**
 * Match API module
 * Handles all match-related HTTP requests with full type safety
 */

/**
 * Get all matches
 * Returns properly typed API responses (not MongoDB documents)
 */
export const getMatches = async (): Promise<Api.MatchResponse[]> => {
  const response = await apiClient.get<ApiResponse<Api.MatchResponse[]>>('/matches');
  return response.data.data;
};

/**
 * Get match by ID
 * Returns properly typed API response (not MongoDB document)
 */
export const getMatch = async (id: string): Promise<Api.MatchResponse> => {
  const response = await apiClient.get<ApiResponse<Api.MatchResponse>>(`/matches/${id}`);
  return response.data.data;
};

/**
 * Create a new match
 */
export const createMatch = async (matchData: Api.CreateMatchRequest): Promise<Api.MatchResponse> => {
  const response = await apiClient.post<ApiResponse<Api.MatchResponse>>('/matches', matchData);
  return response.data.data;
};

/**
 * Update an existing match
 */
export const updateMatch = async (
  id: string,
  matchData: Api.UpdateMatchRequest
): Promise<Api.MatchResponse> => {
  const response = await apiClient.put<ApiResponse<Api.MatchResponse>>(`/matches/${id}`, matchData);
  return response.data.data;
};

/**
 * Delete a match
 */
export const deleteMatch = async (id: string): Promise<{ success: boolean; message?: string }> => {
  const response = await apiClient.delete<ApiResponse<null>>(`/matches/${id}`);
  return { success: response.data.success, message: response.data.message };
};

/**
 * Toggle player availability for a match
 */
export const toggleMatchPlayerAvailability = async (
  matchId: string,
  playerId: string,
  isAvailable: boolean,
  note?: string
): Promise<Api.MatchResponse> => {
  const response = await apiClient.patch<ApiResponse<Api.MatchResponse>>(
    `/matches/${matchId}/availability/${playerId}`,
    { isAvailable, note }
  );
  return response.data.data;
};

// Note: syncMatchPlayers removed - auto-sync now happens on backend

/**
 * Update match lineup
 */
export const updateMatchLineup = async (
  matchId: string,
  lineup: Record<LineupPosition, BaseLineupPlayer[]>
): Promise<Api.MatchResponse> => {
  const response = await apiClient.put<ApiResponse<Api.MatchResponse>>(
    `/matches/${matchId}/lineup`,
    { lineup }
  );
  return response.data.data;
};
