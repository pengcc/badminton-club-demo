import apiClient from './client';
import { ApiResponse } from './types';
import { Api } from '@club/shared-types/api/team';

/**
 * Team API module
 * Handles all team-related HTTP requests with full type safety
 */

/**
 * Get all teams
 */
export const getTeams = async (): Promise<Api.TeamResponse[]> => {
  const response = await apiClient.get<ApiResponse<Api.TeamResponse[]>>('/teams');
  return response.data.data;
};

/**
 * Get a single team by ID
 */
export const getTeam = async (id: string): Promise<Api.TeamResponse> => {
  const response = await apiClient.get<ApiResponse<Api.TeamResponse>>(`/teams/${id}`);
  return response.data.data;
};

/**
 * Create a new team
 */
export const createTeam = async (teamData: Api.CreateTeamRequest): Promise<Api.TeamResponse> => {
  const response = await apiClient.post<ApiResponse<Api.TeamResponse>>('/teams', teamData);
  return response.data.data;
};

/**
 * Update an existing team
 */
export const updateTeam = async (
  id: string,
  teamData: Api.UpdateTeamRequest
): Promise<Api.TeamResponse> => {
  const response = await apiClient.put<ApiResponse<Api.TeamResponse>>(`/teams/${id}`, teamData);
  return response.data.data;
};

/**
 * Delete a team
 */
export const deleteTeam = async (id: string): Promise<{ success: boolean; message?: string }> => {
  const response = await apiClient.delete<ApiResponse<null>>(`/teams/${id}`);
  return { success: response.data.success, message: response.data.message };
};

/**
 * Get team statistics (player counts with gender breakdown)
 */
export const getTeamStats = async (id: string): Promise<{
  total: number;
  male: number;
  female: number;
}> => {
  const response = await apiClient.get<ApiResponse<{
    total: number;
    male: number;
    female: number;
  }>>(`/teams/${id}/stats`);
  return response.data.data;
};
