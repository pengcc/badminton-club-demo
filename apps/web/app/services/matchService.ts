/**
 * Match Service
 *
 * Handles all match-related data fetching and mutations
 * Uses Api.MatchResponse types from backend
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Api as MatchApi } from '@club/shared-types/api/match';
import type { MatchView } from '@club/shared-types/view/match';
import { MatchViewTransformers } from '@club/shared-types/view/transformers/match';
import { TeamService } from './teamService';
import { useStorage } from '@app/lib/storage';
import { BaseService } from './baseService';
import type { BaseLineupPlayer } from '@club/shared-types/core/base';
import type { LineupPosition } from '@club/shared-types/core/enums';

export class MatchService {
  /**
   * Get all matches (returns API response format)
   */
  static async getMatches(adapter: any): Promise<MatchApi.MatchResponse[]> {
    const apiMatches = await adapter.getMatches();
    return apiMatches;
  }

  /**
   * Hook: Get list of matches (API format)
   */
  static useMatchListRaw() {
    const { adapter } = useStorage();

    return useQuery({
      queryKey: BaseService.queryKey('matches', 'list-raw'),
      queryFn: () => MatchService.getMatches(adapter),
      enabled: !!adapter,
      staleTime: 2 * 60 * 1000,
    });
  }

  /**
   * Get all matches as cards (for list views)
   * Populates homeTeamName by fetching teams data
   */
  static async getMatchCards(adapter: any): Promise<MatchView.MatchCard[]> {
    const [apiMatches, teams] = await Promise.all([
      adapter.getMatches(),
      TeamService.getTeamCards(adapter)
    ]);

    return apiMatches.map((match: any) => {
      const homeTeam = teams.find((t: any) => t.id === match.homeTeamId);
      const homeTeamName = homeTeam?.name || 'Unknown Team';
      return MatchViewTransformers.toMatchCard(match, homeTeamName);
    });
  }

  /**
   * Get single match detail (for detail views)
   */
  static async getMatchDetails(adapter: any, id: string): Promise<MatchView.MatchDetails> {
    const apiMatch = await adapter.getMatch(id);
    return MatchViewTransformers.toMatchDetails(apiMatch as any);
  }

  /**
   * Hook: Get list of matches
   */
  static useMatchList() {
    const { adapter } = useStorage();

    return useQuery({
      queryKey: BaseService.queryKey('matches', 'list'),
      queryFn: () => MatchService.getMatchCards(adapter),
      enabled: !!adapter,
      staleTime: 2 * 60 * 1000, // 2 minutes - matches change frequently
    });
  }

  /**
   * Hook: Get upcoming matches (scheduled and in the future)
   * Filters on frontend but uses ISO string comparison for timezone safety
   */
  static useUpcomingMatches() {
    const { adapter } = useStorage();

    return useQuery({
      queryKey: BaseService.queryKey('matches', 'upcoming'),
      queryFn: async () => {
        const matches = await MatchService.getMatchCards(adapter);
        const now = new Date().toISOString();

        return matches.filter(match => {
          // Use ISO string comparison - timezone-safe
          return match.status === 'scheduled' && match.date > now;
        });
      },
      enabled: !!adapter,
      staleTime: 2 * 60 * 1000,
    });
  }

  /**
   * Hook: Get history matches (completed or past dates)
   * Filters on frontend but uses ISO string comparison for timezone safety
   * Optionally filter by year
   */
  static useHistoryMatches(yearFilter: string = 'all') {
    const { adapter } = useStorage();

    return useQuery({
      queryKey: BaseService.queryKey('matches', 'history', { year: yearFilter }),
      queryFn: async () => {
        const matches = await MatchService.getMatchCards(adapter);
        const now = new Date().toISOString();

        return matches.filter(match => {
          // Use ISO string comparison - timezone-safe
          const isPastOrCompleted = match.status === 'completed' || match.date < now;

          if (!isPastOrCompleted) return false;

          // Year filter
          if (yearFilter === 'all') return true;

          try {
            const matchYear = new Date(match.date).getFullYear().toString();
            return matchYear === yearFilter;
          } catch {
            return false;
          }
        });
      },
      enabled: !!adapter,
      staleTime: 5 * 60 * 1000, // 5 minutes - history changes less frequently
    });
  }

  /**
   * Hook: Get single match details
   */
  static useMatchDetails(id: string) {
    const { adapter } = useStorage();

    return useQuery({
      queryKey: BaseService.queryKey('matches', 'details', { id }),
      queryFn: () => MatchService.getMatchDetails(adapter, id),
      enabled: !!id && !!adapter,
      staleTime: 0, // Always consider stale so invalidation triggers refetch
      refetchOnMount: 'always', // Always refetch when component mounts
    });
  }

  /**
   * Hook: Create match mutation
   */
  static useCreateMatch() {
    const { adapter } = useStorage();
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (formData: MatchView.MatchFormData) => {
        if (!adapter) throw new Error('Storage adapter not available');
        const request = MatchViewTransformers.toCreateRequest(formData);
        const response = await adapter.createMatch(request);
        return MatchViewTransformers.toMatchCard(response as any);
      },
      onSuccess: () => {
        // Invalidate match list to trigger refetch
        queryClient.invalidateQueries({ queryKey: ['matches', 'list'] });
      },
    });
  }

  /**
   * Hook: Update match mutation
   */
  static useUpdateMatch() {
    const { adapter } = useStorage();
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({ id, formData }: { id: string; formData: Partial<MatchView.MatchFormData> }) => {
        if (!adapter) throw new Error('Storage adapter not available');
        const request = MatchViewTransformers.toUpdateRequest(formData);
        const response = await adapter.updateMatch(id, request);
        return MatchViewTransformers.toMatchCard(response as any);
      },
      onSuccess: (_data: any, variables: any) => {
        // Invalidate match list and the specific match detail
        queryClient.invalidateQueries({ queryKey: ['matches', 'list'] });
        queryClient.invalidateQueries({ queryKey: ['matches', 'details', { id: variables.id }] });
      },
    });
  }

  /**
   * Hook: Delete match mutation
   */
  static useDeleteMatch() {
    const { adapter } = useStorage();
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (id: string) => {
        if (!adapter) throw new Error('Storage adapter not available');
        await adapter.deleteMatch(id);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['matches', 'list'] });
      },
    });
  }

  /**
   * Hook: Update match lineup mutation
   */
  static useUpdateLineup() {
    const { adapter } = useStorage();
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({ matchId, lineup }: { matchId: string; lineup: Record<LineupPosition, BaseLineupPlayer[]> }) => {
        if (!adapter) throw new Error('Storage adapter not available');
        const response = await adapter.updateMatchLineup(matchId, lineup);
        return response;
      },
      onSuccess: (_data: any, variables: any) => {
        queryClient.invalidateQueries({ queryKey: ['matches', 'details', { id: variables.matchId }] });
        queryClient.invalidateQueries({ queryKey: ['matches', 'list'] });
      },
    });
  }

  /**
   * Hook: Toggle player availability mutation
   * Simplified: Modal queries its own data, so just invalidate specific match
   */
  static useTogglePlayerAvailability() {
    const { adapter } = useStorage();
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({
        matchId,
        playerId,
        isAvailable
      }: {
        matchId: string;
        playerId: string;
        isAvailable: boolean;
      }) => {
        if (!adapter) throw new Error('Storage adapter not available');
        const response = await adapter.toggleMatchPlayerAvailability(matchId, playerId, isAvailable);
        return response;
      },
      onSuccess: async (_data: any, variables: any) => {
        // Use the same queryKey format as the query itself (note: 'details' not 'detail')
        const queryKey = BaseService.queryKey('matches', 'details', { id: variables.matchId });

        // Use refetchQueries to force immediate refetch
        await queryClient.refetchQueries({
          queryKey,
          exact: true
        });

        // Also invalidate list for consistency
        queryClient.invalidateQueries({ queryKey: ['matches', 'list'] });
      },
    });
  }

  // Note: useSyncMatchPlayers() removed - auto-sync now happens on backend when player leaves team
}

