/**
 * Team Service
 *
 * Handles all team-related data fetching and mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TeamView } from '@club/shared-types/view/team';
import type { Api } from '@club/shared-types/api/team';
import { TeamViewTransformers } from '@club/shared-types/view/transformers/team';
import * as teamApi from '@app/lib/api/teamApi';

const teamKeys = {
  listRaw: ['teams', 'list-raw'] as const,
  list: ['teams', 'list'] as const,
  detail: (id: string) => ['teams', 'detail', { id }] as const,
  stats: (id: string) => ['teams', 'stats', { id }] as const,
};

export class TeamService {
  /**
   * Get all teams (raw API format for backward compatibility)
   */
  static async getTeams(): Promise<Api.TeamResponse[]> {
    const apiTeams = await teamApi.getTeams();
    return apiTeams;
  }

  /**
   * Hook: Get list of teams (raw format)
   */
  static useTeamListRaw() {
    return useQuery({
      queryKey: teamKeys.listRaw,
      queryFn: () => TeamService.getTeams(),
      staleTime: 30 * 60 * 1000,
    });
  }

  /**
   * Get all teams as cards (for list views)
   */
  static async getTeamCards(): Promise<TeamView.TeamCard[]> {
    const apiTeams = await teamApi.getTeams();
    // Type assertion needed for date conversion (API returns string dates)
    return apiTeams.map((team: Api.TeamResponse) =>
      TeamViewTransformers.toTeamCard(team as any)
    );
  }

  /**
   * Get single team detail (for detail views)
   */
  static async getTeamDetail(id: string): Promise<TeamView.TeamCard> {
    const apiTeam = await teamApi.getTeam(id);
    return TeamViewTransformers.toTeamCard(apiTeam as any); // Type assertion needed for date conversion
  }

  /**
   * Hook: Get list of teams
   */
  static useTeamList() {
    return useQuery({
      queryKey: teamKeys.list,
      queryFn: () => TeamService.getTeamCards(),
      staleTime: 30 * 60 * 1000, // 30 minutes - teams change rarely
    });
  }

  /**
   * Hook: Get single team detail
   */
  static useTeamDetail(id: string) {
    return useQuery({
      queryKey: teamKeys.detail(id),
      queryFn: () => TeamService.getTeamDetail(id),
      enabled: !!id,
      staleTime: 30 * 60 * 1000,
    });
  }

  /**
   * Hook: Create team mutation
   */
  static useCreateTeam() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (formData: TeamView.TeamFormData) => {
        const request = TeamViewTransformers.toCreateRequest(formData);
        const response = await teamApi.createTeam(request);
        return TeamViewTransformers.toTeamCard(response as any); // Type assertion needed for date conversion
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: teamKeys.list });
        queryClient.invalidateQueries({
          queryKey: ['matches', 'lineup-context'],
        });
      },
    });
  }

  /**
   * Hook: Update team mutation
   */
  static useUpdateTeam() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({
        id,
        formData,
      }: {
        id: string;
        formData: Partial<TeamView.TeamFormData>;
      }) => {
        const request = TeamViewTransformers.toUpdateRequest(formData);
        const response = await teamApi.updateTeam(id, request);
        return TeamViewTransformers.toTeamCard(response as any); // Type assertion needed for date conversion
      },
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: teamKeys.list });
        queryClient.invalidateQueries({
          queryKey: teamKeys.detail(variables.id),
          exact: true,
        });
        queryClient.invalidateQueries({
          queryKey: ['matches', 'lineup-context'],
        });
      },
    });
  }

  /**
   * Hook: Delete team mutation
   */
  static useDeleteTeam() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (id: string) => {
        await teamApi.deleteTeam(id);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: teamKeys.list });
        queryClient.invalidateQueries({
          queryKey: ['matches', 'lineup-context'],
        });
      },
    });
  }

  /**
   * Get team statistics (player counts with gender breakdown)
   */
  static async getTeamStats(id: string): Promise<Api.TeamRosterSummary> {
    return await teamApi.getTeamStats(id);
  }

  /**
   * Hook: Get team statistics
   */
  static useTeamStats(id: string) {
    return useQuery({
      queryKey: teamKeys.stats(id),
      queryFn: () => TeamService.getTeamStats(id),
      enabled: !!id,
      staleTime: 5 * 60 * 1000, // 5 minutes - stats change when players are added/removed
    });
  }
}
