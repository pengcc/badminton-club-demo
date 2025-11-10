/**
 * Team Service
 *
 * Handles all team-related data fetching and mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { TeamView } from '@club/shared-types/view/team';
import { TeamViewTransformers } from '@club/shared-types/view/transformers/team';
import * as teamApi from '@app/lib/api/teamApi';
import { BaseService } from './baseService';

export class TeamService {
  /**
   * Get all teams (raw API format for backward compatibility)
   */
  static async getTeams(): Promise<any[]> {
    const apiTeams = await teamApi.getTeams();
    return apiTeams;
  }

  /**
   * Hook: Get list of teams (raw format)
   */
  static useTeamListRaw() {
    return useQuery({
      queryKey: BaseService.queryKey('teams', 'list-raw'),
      queryFn: () => TeamService.getTeams(),
      staleTime: 30 * 60 * 1000,
    });
  }

  /**
   * Get all teams as cards (for list views)
   */
  static async getTeamCards(): Promise<TeamView.TeamCard[]> {
    const apiTeams = await teamApi.getTeams();
    return apiTeams.map((team: any) => TeamViewTransformers.toTeamCard(team));
  }

  /**
   * Get single team detail (for detail views)
   */
  static async getTeamDetail(id: string): Promise<TeamView.TeamCard> {
    const apiTeam = await teamApi.getTeam(id);
    return TeamViewTransformers.toTeamCard(apiTeam as any);
  }

  /**
   * Hook: Get list of teams
   */
  static useTeamList() {
    return useQuery({
      queryKey: BaseService.queryKey('teams', 'list'),
      queryFn: () => TeamService.getTeamCards(),
      staleTime: 30 * 60 * 1000, // 30 minutes - teams change rarely
    });
  }

  /**
   * Hook: Get single team detail
   */
  static useTeamDetail(id: string) {
    return useQuery({
      queryKey: BaseService.queryKey('teams', 'detail', { id }),
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
        return TeamViewTransformers.toTeamCard(response as any);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['teams', 'list'] });
      },
    });
  }

  /**
   * Hook: Update team mutation
   */
  static useUpdateTeam() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({ id, formData }: { id: string; formData: Partial<TeamView.TeamFormData> }) => {
        const request = TeamViewTransformers.toUpdateRequest(formData);
        const response = await teamApi.updateTeam(id, request);
        return TeamViewTransformers.toTeamCard(response as any);
      },
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries({ queryKey: ['teams', 'list'] });
        queryClient.invalidateQueries({ queryKey: ['teams', 'detail', { id: variables.id }] });
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
        queryClient.invalidateQueries({ queryKey: ['teams', 'list'] });
      },
    });
  }

  /**
   * Get team statistics (player counts with gender breakdown)
   */
  static async getTeamStats(id: string): Promise<{
    total: number;
    male: number;
    female: number;
  }> {
    return await teamApi.getTeamStats(id);
  }

  /**
   * Hook: Get team statistics
   */
  static useTeamStats(id: string) {
    return useQuery({
      queryKey: BaseService.queryKey('teams', 'stats', { id }),
      queryFn: () => TeamService.getTeamStats(id),
      enabled: !!id,
      staleTime: 5 * 60 * 1000, // 5 minutes - stats change when players are added/removed
    });
  }
}
