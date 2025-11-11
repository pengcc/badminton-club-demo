/**
 * Player Service
 *
 * Handles all player-related data fetching and mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PlayerView } from '@club/shared-types/view/player';
import { PlayerViewTransformers } from '@club/shared-types/view/transformers/player';
import { useStorage } from '@app/lib/storage';
import { BaseService } from './baseService';

export class PlayerService {
  /**
   * Get all players (raw API format for backward compatibility)
   */
  static async getPlayers(adapter: any, filters?: any): Promise<any> {
    return await adapter.getPlayers(filters);
  }

  /**
   * Hook: Get list of players (raw format)
   */
  static usePlayerListRaw(filters?: any) {
    const { adapter } = useStorage();

    return useQuery({
      queryKey: BaseService.queryKey('players', 'list-raw', filters),
      queryFn: () => PlayerService.getPlayers(adapter, filters),
      enabled: !!adapter,
      staleTime: 5 * 60 * 1000,
    });
  }

  /**
   * Get all players as cards (for list views)
   */
  static async getPlayerCards(adapter: any, filters?: any): Promise<PlayerView.PlayerCard[]> {
    const response = filters
      ? await adapter.getPlayers(filters)
      : await adapter.getPlayers();

    const players = Array.isArray(response) ? response : response.data;
    return players.map((player: any) => PlayerViewTransformers.toPlayerCard(player));
  }

  /**
   * Hook: Get list of players
   */
  static usePlayerList(filters?: any) {
    const { adapter } = useStorage();

    return useQuery({
      queryKey: BaseService.queryKey('players', 'list', filters),
      queryFn: () => PlayerService.getPlayerCards(adapter, filters),
      enabled: !!adapter,
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  }

  /**
   * Hook: Create player mutation
   */
  static useCreatePlayer() {
    const { adapter } = useStorage();
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (formData: any) => {
        if (!adapter) throw new Error('Storage adapter not available');
        // Create requests typically use form data directly
        const response = await adapter.createPlayer(formData);
        return PlayerViewTransformers.toPlayerCard(response as any);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['players', 'list'] });
      },
    });
  }

  /**
   * Hook: Update player mutation
   */
  static useUpdatePlayer() {
    const { adapter } = useStorage();
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({ id, formData }: { id: string; formData: any }) => {
        if (!adapter) throw new Error('Storage adapter not available');
        // Use formData directly or transform if available
        const request = formData.isActivePlayer !== undefined
          ? PlayerViewTransformers.toUpdateRequest(formData as PlayerView.PlayerFormData)
          : formData;
        const response = await adapter.updatePlayer(id, request);
        return PlayerViewTransformers.toPlayerCard(response as any);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['players', 'list'] });

        // Invalidate matches - player updates may affect team rosters and match availability
        // This ensures upcoming matches tab shows updated roster immediately
        queryClient.invalidateQueries({ queryKey: ['matches', 'list'] });
        queryClient.invalidateQueries({ queryKey: ['matches', 'details'] });
      },
    });
  }

  /**
   * Hook: Delete player mutation
   */
  static useDeletePlayer() {
    const { adapter } = useStorage();
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (id: string) => {
        if (!adapter) throw new Error('Storage adapter not available');
        await adapter.deletePlayer(id);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['players', 'list'] });
      },
    });
  }

  /**
   * Hook: Batch update players mutation
   * Handles batch operations like activating/deactivating players or updating teams
   */
  static useBatchUpdatePlayers() {
    const { adapter } = useStorage();
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({
        playerIds,
        updates
      }: {
        playerIds: string[];
        updates: {
          isActivePlayer?: boolean;
          singlesRanking?: number;
          doublesRanking?: number;
          addToTeams?: string[];
          removeFromTeams?: string[];
        };
      }) => {
        if (!adapter) throw new Error('Storage adapter not available');
        return await adapter.batchUpdatePlayers(playerIds, updates);
      },
      onSuccess: () => {
        // Invalidate all affected caches
        queryClient.invalidateQueries({ queryKey: ['players'] });
        queryClient.invalidateQueries({ queryKey: ['teams'] });

        // Invalidate matches - batch updates affect team rosters and match availability
        queryClient.invalidateQueries({ queryKey: ['matches', 'list'] });
        queryClient.invalidateQueries({ queryKey: ['matches', 'details'] });
      },
    });
  }

  /**
   * Hook: Add player to team mutation
   */
  static useAddPlayerToTeam() {
    const { adapter } = useStorage();
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({
        playerId,
        teamId
      }: {
        playerId: string;
        teamId: string;
      }) => {
        if (!adapter) throw new Error('Storage adapter not available');
        return await adapter.addPlayerToTeam(playerId, teamId);
      },
      onSuccess: () => {
        // Invalidate all affected caches
        queryClient.invalidateQueries({ queryKey: ['players'] });
        queryClient.invalidateQueries({ queryKey: ['teams'] });
        queryClient.invalidateQueries({ queryKey: ['matches', 'list'] });
        queryClient.invalidateQueries({ queryKey: ['matches', 'details'] });
      },
    });
  }

  /**
   * Hook: Remove player from team mutation
   */
  static useRemovePlayerFromTeam() {
    const { adapter } = useStorage();
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({
        playerId,
        teamId
      }: {
        playerId: string;
        teamId: string;
      }) => {
        if (!adapter) throw new Error('Storage adapter not available');
        return await adapter.removePlayerFromTeam(playerId, teamId);
      },
      onSuccess: () => {
        // Invalidate all affected caches
        queryClient.invalidateQueries({ queryKey: ['players'] });
        queryClient.invalidateQueries({ queryKey: ['teams'] });
        queryClient.invalidateQueries({ queryKey: ['matches', 'list'] });
        queryClient.invalidateQueries({ queryKey: ['matches', 'details'] });
      },
    });
  }
}
