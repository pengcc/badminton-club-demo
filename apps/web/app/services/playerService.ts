/**
 * Player Service
 *
 * Handles all player-related data fetching and mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PlayerView } from '@club/shared-types/view/player';
import { PlayerViewTransformers } from '@club/shared-types/view/transformers/player';
import * as playerApi from '@app/lib/api/playerApi';
import { BaseService } from './baseService';

export class PlayerService {
  /**
   * Get all players (raw API format for backward compatibility)
   */
  static async getPlayers(filters?: any): Promise<any> {
    return await playerApi.getPlayers(filters);
  }

  /**
   * Hook: Get list of players (raw format)
   */
  static usePlayerListRaw(filters?: any) {
    return useQuery({
      queryKey: BaseService.queryKey('players', 'list-raw', filters),
      queryFn: () => PlayerService.getPlayers(filters),
      staleTime: 5 * 60 * 1000,
    });
  }

  /**
   * Get all players as cards (for list views)
   */
  static async getPlayerCards(filters?: any): Promise<PlayerView.PlayerCard[]> {
    const response = filters
      ? await playerApi.getPlayers(filters)
      : await playerApi.getPlayers();

    const players = Array.isArray(response) ? response : response.data;
    return players.map((player: any) => PlayerViewTransformers.toPlayerCard(player));
  }  /**
   * Hook: Get list of players
   */
  static usePlayerList(filters?: any) {
    return useQuery({
      queryKey: BaseService.queryKey('players', 'list', filters),
      queryFn: () => PlayerService.getPlayerCards(filters),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  }

  /**
   * Hook: Create player mutation
   */
  static useCreatePlayer() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (formData: any) => {
        // Create requests typically use form data directly
        const response = await playerApi.createPlayer(formData);
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
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({ id, formData }: { id: string; formData: any }) => {
        // Use formData directly or transform if available
        const request = formData.isActivePlayer !== undefined
          ? PlayerViewTransformers.toUpdateRequest(formData as PlayerView.PlayerFormData)
          : formData;
        const response = await playerApi.updatePlayer(id, request);
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
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (id: string) => {
        await playerApi.deletePlayer(id);
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
        return await playerApi.batchUpdatePlayers(playerIds, updates);
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
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({
        playerId,
        teamId
      }: {
        playerId: string;
        teamId: string;
      }) => {
        return await playerApi.addPlayerToTeam(playerId, teamId);
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
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({
        playerId,
        teamId
      }: {
        playerId: string;
        teamId: string;
      }) => {
        return await playerApi.removePlayerFromTeam(playerId, teamId);
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
