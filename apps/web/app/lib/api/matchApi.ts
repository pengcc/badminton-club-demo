import apiClient from './client';
import type { ApiResponse } from './types';
import type { Api } from '@club/shared-types/api/match';
import type { MatchListView } from '@club/shared-types/core/enums';

/**
 * Match API module
 * Handles all match-related HTTP requests with full type safety
 */

/**
 * Get all matches
 * Returns properly typed API responses (not MongoDB documents)
 */
export const getMatches = async (
  view: MatchListView
): Promise<Api.MatchResponse[]> => {
  const response = await apiClient.get<ApiResponse<Api.MatchResponse[]>>(
    '/matches',
    { params: { view } }
  );
  return response.data.data;
};

/**
 * Get match by ID
 * Returns properly typed API response (not MongoDB document)
 */
export const getMatch = async (
  id: string
): Promise<Api.MatchDetailResponse> => {
  const response = await apiClient.get<ApiResponse<Api.MatchDetailResponse>>(
    `/matches/${id}`
  );
  return response.data.data;
};

export const getMatchLineupContext = async (
  id: string
): Promise<Api.LineupContextResponse> => {
  const response = await apiClient.get<ApiResponse<Api.LineupContextResponse>>(
    `/matches/${id}/lineup-context`
  );
  return response.data.data;
};

/**
 * Create a new match
 */
export const createMatch = async (
  matchData: Api.CreateMatchRequest
): Promise<Api.MatchResponse> => {
  const response = await apiClient.post<ApiResponse<Api.MatchResponse>>(
    '/matches',
    matchData
  );
  return response.data.data;
};

/**
 * Update an existing match
 */
export const updateMatch = async (
  id: string,
  matchData: Api.UpdateMatchRequest
): Promise<Api.MatchResponse> => {
  const response = await apiClient.put<ApiResponse<Api.MatchResponse>>(
    `/matches/${id}`,
    matchData
  );
  return response.data.data;
};

/**
 * Delete a match
 */
export const deleteMatch = async (
  id: string,
  request: Api.DeleteMatchRequest
): Promise<{ success: boolean; message?: string }> => {
  const response = await apiClient.delete<ApiResponse<null>>(`/matches/${id}`, {
    data: request,
  });
  return { success: response.data.success, message: response.data.message };
};

export const setMatchResult = async (
  id: string,
  result: Api.SetMatchResultRequest
): Promise<Api.MatchResponse> => {
  const response = await apiClient.put<ApiResponse<Api.MatchResponse>>(
    `/matches/${id}/result`,
    result
  );
  return response.data.data;
};

export const setOwnMatchAvailability = async (
  matchId: string,
  request: Api.SetOwnMatchAvailabilityRequest
): Promise<Api.MatchResponse> => {
  const response = await apiClient.put<ApiResponse<Api.MatchResponse>>(
    `/matches/${matchId}/availability/self`,
    request
  );
  return response.data.data;
};

export const setPlayerMatchAvailability = async (
  matchId: string,
  playerId: string,
  request: Api.SetPlayerMatchAvailabilityRequest
): Promise<Api.MatchResponse> => {
  const response = await apiClient.put<ApiResponse<Api.MatchResponse>>(
    `/matches/${matchId}/availability/${playerId}`,
    request
  );
  return response.data.data;
};

// Current Match access derives from Player.teamIds. Removing a Team association
// does not delete retained Match Availability or Lineup references.

/**
 * Update match lineup
 */
export const updateMatchLineup = async (
  matchId: string,
  request: Api.SetMatchLineupRequest
): Promise<Api.MatchDetailResponse> => {
  const response = await apiClient.put<ApiResponse<Api.MatchDetailResponse>>(
    `/matches/${matchId}/lineup`,
    request
  );
  return response.data.data;
};

/**
 * Import matches from CSV file
 * Backend handles all parsing and validation
 */
export const importFromCSV = async (
  file: File,
  teamId: string
): Promise<Api.MatchCsvImportResponse> => {
  const formData = new FormData();
  formData.append('teamId', teamId);
  formData.append('file', file);
  const response = await apiClient.post<Api.MatchCsvImportResponse>(
    '/matches/import-csv',
    formData,
    { headers: { 'Content-Type': undefined } }
  );
  return response.data;
};
