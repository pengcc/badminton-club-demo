/**
 * Player Service
 *
 * Handles all player-related data fetching and mutations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { PlayerView } from '@club/shared-types/view/player';
import type { Api } from '@club/shared-types/api/player';
import { PlayerViewTransformers } from '@club/shared-types/view/transformers/player';
import * as playerApi from '@app/lib/api/playerApi';
import { retryAmbiguousLifecycleMutation } from './lifecycleMutationRetry';

export class PlayerService {
  /**
   * Get all players as cards (for list views)
   */
  static async getPlayerCards(): Promise<PlayerView.PlayerCard[]> {
    const players = await playerApi.getPlayers();
    return players.map((player: Api.PlayerResponse) =>
      PlayerViewTransformers.toPlayerCard(player)
    );
  } /**
   * Hook: Get list of players
   */
  static usePlayerList() {
    return useQuery({
      queryKey: ['players', 'list'] as const,
      queryFn: () => PlayerService.getPlayerCards(),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  }

  /**
   * Hook: Create player mutation
   */
  static useCreatePlayer() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (formData: Api.CreatePlayerRequest) => {
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
      mutationFn: async ({
        id,
        formData,
      }: {
        id: string;
        formData: Partial<Api.UpdatePlayerRequest>;
      }) => {
        const response = await playerApi.updatePlayer(id, formData);
        return PlayerViewTransformers.toPlayerCard(response as any);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['players', 'list'] });

        // Invalidate matches - player updates may affect team rosters and match availability
        // This ensures upcoming matches tab shows updated roster immediately
        queryClient.invalidateQueries({ queryKey: ['matches', 'list'] });
        queryClient.invalidateQueries({ queryKey: ['matches', 'detail'] });
        queryClient.invalidateQueries({
          queryKey: ['matches', 'lineup-context'],
        });
      },
    });
  }

  /**
   * Hook: Delete player mutation
   */
  static useDeletePlayer() {
    const queryClient = useQueryClient();

    return useMutation({
      retry: retryAmbiguousLifecycleMutation,
      mutationFn: async (variables: {
        id: string;
        idempotencyKey?: string;
      }) => {
        variables.idempotencyKey ??= crypto.randomUUID();
        await playerApi.deletePlayer(variables.id, variables.idempotencyKey);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['players', 'list'] });
      },
    });
  }

  static useSetPlayerParticipation() {
    const queryClient = useQueryClient();
    return useMutation({
      retry: retryAmbiguousLifecycleMutation,
      mutationFn: async (variables: {
        id: string;
        isActivePlayer: boolean;
        idempotencyKey?: string;
      }) => {
        variables.idempotencyKey ??= crypto.randomUUID();
        return playerApi.setPlayerParticipation(
          variables.id,
          variables.isActivePlayer,
          variables.idempotencyKey
        );
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['players'] });
        queryClient.invalidateQueries({ queryKey: ['matches'] });
      },
    });
  }

  static useLifecycleCandidates(enabled = true) {
    return useQuery({
      queryKey: ['players', 'lifecycle-candidates'],
      queryFn: playerApi.getPlayerLifecycleCandidates,
      enabled,
    });
  }

  static useBatchPlayerLifecycle() {
    const queryClient = useQueryClient();
    return useMutation({
      retry: retryAmbiguousLifecycleMutation,
      mutationFn: async (variables: {
        request: Api.PlayerLifecycleBatchRequest;
        idempotencyKey?: string;
      }) => {
        variables.idempotencyKey ??= crypto.randomUUID();
        return playerApi.batchPlayerLifecycle(
          variables.request,
          variables.idempotencyKey
        );
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['players'] });
        queryClient.invalidateQueries({ queryKey: ['users'] });
        queryClient.invalidateQueries({ queryKey: ['matches'] });
      },
    });
  }

  static useCleanupPlayer() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({ id, reason }: { id: string; reason: string }) =>
        playerApi.cleanupPlayer(id, reason),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['players'] });
        queryClient.invalidateQueries({ queryKey: ['users'] });
        queryClient.invalidateQueries({ queryKey: ['matches'] });
      },
    });
  }

  static useConvertFormerMemberToExternal() {
    const queryClient = useQueryClient();
    return useMutation({
      retry: retryAmbiguousLifecycleMutation,
      mutationFn: async (variables: {
        id: string;
        reason: string;
        idempotencyKey?: string;
      }) => {
        variables.idempotencyKey ??= crypto.randomUUID();
        return playerApi.convertFormerMemberToExternal(
          variables.id,
          { reason: variables.reason },
          variables.idempotencyKey
        );
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['players'] });
        queryClient.invalidateQueries({ queryKey: ['users'] });
        queryClient.invalidateQueries({ queryKey: ['matches'] });
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
      retry: retryAmbiguousLifecycleMutation,
      mutationFn: async (variables: {
        playerIds: Api.BatchUpdatePlayersRequest['playerIds'];
        idempotencyKey?: string;
        updates: Api.BatchUpdatePlayersRequest['updates'];
      }) => {
        variables.idempotencyKey ??= crypto.randomUUID();
        return await playerApi.batchUpdatePlayers(
          {
            playerIds: variables.playerIds,
            updates: variables.updates,
          },
          variables.idempotencyKey
        );
      },
      onSuccess: () => {
        // Invalidate all affected caches
        queryClient.invalidateQueries({ queryKey: ['players'] });
        queryClient.invalidateQueries({ queryKey: ['teams'] });

        // Invalidate matches - batch updates affect team rosters and match availability
        queryClient.invalidateQueries({ queryKey: ['matches', 'list'] });
        queryClient.invalidateQueries({ queryKey: ['matches', 'detail'] });
        queryClient.invalidateQueries({
          queryKey: ['matches', 'lineup-context'],
        });
      },
    });
  }
}
