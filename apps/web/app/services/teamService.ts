/**
 * Team Service
 *
 * Handles all team-related data fetching and mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TeamView } from '@club/shared-types/view/team';
import { TeamViewTransformers } from '@club/shared-types/view/transformers/team';
import { useStorage } from '@app/lib/storage';
import { BaseService } from './baseService';

export class TeamService {
  /**
   * Get all teams (raw API format for backward compatibility)
   */
  static async getTeams(adapter: any): Promise<any[]> {
    const apiTeams = await adapter.getTeams();
    return apiTeams;
  }

  /**
   * Hook: Get list of teams (raw format)
   */
  static useTeamListRaw() {
    const { adapter } = useStorage();

    return useQuery({
      queryKey: BaseService.queryKey('teams', 'list-raw'),
      queryFn: () => TeamService.getTeams(adapter),
      enabled: !!adapter,
      staleTime: 30 * 60 * 1000,
    });
  }

  /**
   * Get all teams as cards (for list views)
   */
  static async getTeamCards(adapter: any): Promise<TeamView.TeamCard[]> {
    const apiTeams = await adapter.getTeams();
    return apiTeams.map((team: any) => TeamViewTransformers.toTeamCard(team));
  }

  /**
   * Get single team detail (for detail views)
   */
  static async getTeamDetail(adapter: any, id: string): Promise<TeamView.TeamCard> {
    const apiTeam = await adapter.getTeam(id);
    return TeamViewTransformers.toTeamCard(apiTeam as any);
  }

  /**
   * Hook: Get list of teams
   */
  static useTeamList() {
    const { adapter } = useStorage();

    return useQuery({
      queryKey: BaseService.queryKey('teams', 'list'),
      queryFn: () => TeamService.getTeamCards(adapter),
      enabled: !!adapter,
      staleTime: 30 * 60 * 1000, // 30 minutes - teams change rarely
    });
  }

  /**
   * Hook: Get single team detail
   */
  static useTeamDetail(id: string) {
    const { adapter } = useStorage();

    return useQuery({
      queryKey: BaseService.queryKey('teams', 'detail', { id }),
      queryFn: () => TeamService.getTeamDetail(adapter, id),
      enabled: !!id && !!adapter,
      staleTime: 30 * 60 * 1000,
    });
  }

  /**
   * Hook: Create team mutation
   */
  static useCreateTeam() {
    const { adapter } = useStorage();
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (formData: TeamView.TeamFormData) => {
        if (!adapter) throw new Error('Storage adapter not available');
        const request = TeamViewTransformers.toCreateRequest(formData);
        const response = await adapter.createTeam(request);
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
    const { adapter } = useStorage();
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({ id, formData }: { id: string; formData: Partial<TeamView.TeamFormData> }) => {
        if (!adapter) throw new Error('Storage adapter not available');
        const request = TeamViewTransformers.toUpdateRequest(formData);
        const response = await adapter.updateTeam(id, request);
        return TeamViewTransformers.toTeamCard(response as any);
      },
      onSuccess: (_data: any, variables: any) => {
        queryClient.invalidateQueries({ queryKey: ['teams', 'list'] });
        queryClient.invalidateQueries({ queryKey: ['teams', 'detail', { id: variables.id }] });
      },
    });
  }

  /**
   * Hook: Delete team mutation
   */
  static useDeleteTeam() {
    const { adapter } = useStorage();
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (id: string) => {
        if (!adapter) throw new Error('Storage adapter not available');
        await adapter.deleteTeam(id);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['teams', 'list'] });
      },
    });
  }

  /**
   * Get team statistics (player counts with gender breakdown)
   */
  static async getTeamStats(adapter: any, id: string): Promise<{
    total: number;
    male: number;
    female: number;
  }> {
    return await adapter.getTeamStats(id);
  }

  /**
   * Hook: Get team statistics
   */
  static useTeamStats(id: string) {
    const { adapter } = useStorage();

    return useQuery({
      queryKey: BaseService.queryKey('teams', 'stats', { id }),
      queryFn: () => TeamService.getTeamStats(adapter, id),
      enabled: !!id && !!adapter,
      staleTime: 5 * 60 * 1000, // 5 minutes - stats change when players are added/removed
    });
  }
}
