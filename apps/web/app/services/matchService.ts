'use client';

import { useEffect } from 'react';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import type { Api as MatchApi } from '@club/shared-types/api/match';
import type { MatchView } from '@club/shared-types/view/match';
import { MatchViewTransformers } from '@club/shared-types/view/transformers/match';
import {
  MatchAvailabilityParticipation,
  MatchListView,
} from '@club/shared-types/core/enums';
import * as matchApi from '@app/lib/api/matchApi';
import { TeamService } from './teamService';

export const matchKeys = {
  all: ['matches'] as const,
  lists: () => [...matchKeys.all, 'list'] as const,
  list: (view: MatchListView) => [...matchKeys.lists(), { view }] as const,
  details: () => [...matchKeys.all, 'detail'] as const,
  detail: (id: string) => [...matchKeys.details(), id] as const,
  lineupContexts: () => [...matchKeys.all, 'lineup-context'] as const,
  lineupContext: (id: string) => [...matchKeys.lineupContexts(), id] as const,
};

export type MatchAvailabilityMutation =
  | {
      kind: 'self';
      matchId: string;
      expectedVersion: number;
      participation: MatchAvailabilityParticipation;
    }
  | {
      kind: 'admin';
      matchId: string;
      playerId: string;
      expectedVersion: number;
      participation: MatchAvailabilityParticipation;
    };

export class MatchAvailabilityRefreshError extends Error {
  constructor(
    readonly mutationError: unknown,
    readonly refreshError: unknown
  ) {
    super('Match availability failed and the latest match could not be loaded');
    this.name = 'MatchAvailabilityRefreshError';
  }
}

function updateCommittedMatch(
  queryClient: QueryClient,
  response: MatchApi.MatchResponse | MatchApi.MatchDetailResponse
): void {
  if ('lineupWarnings' in response) {
    const current = queryClient.getQueryData<MatchView.MatchDetails>(
      matchKeys.detail(response.id)
    );
    queryClient.setQueryData(
      matchKeys.detail(response.id),
      MatchViewTransformers.toMatchDetails(
        response,
        current?.clubTeamName ?? ''
      )
    );
  } else {
    const current = queryClient.getQueryData<MatchView.MatchDetails>(
      matchKeys.detail(response.id)
    );
    if (current) {
      queryClient.setQueryData(
        matchKeys.detail(response.id),
        MatchViewTransformers.toMatchDetails(
          {
            ...response,
            lineupWarnings: current.lineupWarnings,
          },
          current.clubTeamName
        )
      );
    }
    void queryClient.invalidateQueries({
      queryKey: matchKeys.detail(response.id),
      exact: true,
    });
  }
  queryClient.setQueriesData<MatchView.MatchCard[]>(
    { queryKey: matchKeys.lists() },
    (matches) =>
      matches?.map((match) =>
        match.id === response.id
          ? MatchViewTransformers.toMatchCard(response, match.clubTeamName)
          : match
      )
  );
  void queryClient.invalidateQueries({ queryKey: matchKeys.lists() });
}

export function getNextMatchBoundary(
  matches: MatchView.MatchCard[] | undefined,
  view: MatchListView,
  now = Date.now()
): number | undefined {
  if (view === MatchListView.HISTORY || !matches?.length) return undefined;
  const futureTimes = matches
    .map((match) => Date.parse(match.startAt))
    .filter((startAt) => Number.isFinite(startAt) && startAt > now);
  return futureTimes.length > 0 ? Math.min(...futureTimes) : undefined;
}

export function useMatchBoundaryRefresh(
  matches: MatchView.MatchCard[] | undefined,
  view: MatchListView
): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const boundary = getNextMatchBoundary(matches, view);
    if (boundary === undefined) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const schedule = () => {
      const remaining = boundary - Date.now();
      if (remaining <= 0) {
        void queryClient.invalidateQueries({ queryKey: matchKeys.lists() });
        return;
      }
      timer = setTimeout(schedule, Math.min(remaining + 25, 2_147_483_647));
    };
    if (!cancelled) schedule();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [matches, queryClient, view]);
}

export class MatchService {
  static async getMatches(
    view: MatchListView
  ): Promise<MatchApi.MatchResponse[]> {
    return matchApi.getMatches(view);
  }

  static async getMatchCards(
    view: MatchListView
  ): Promise<MatchView.MatchCard[]> {
    const [matches, teams] = await Promise.all([
      matchApi.getMatches(view),
      TeamService.getTeamCards(),
    ]);
    return matches.map((match) => {
      const team = teams.find((candidate) => candidate.id === match.teamId);
      return MatchViewTransformers.toMatchCard(
        match,
        team?.shortName ?? 'Unknown Team'
      );
    });
  }

  static async getMatchDetails(id: string): Promise<MatchView.MatchDetails> {
    const match = await matchApi.getMatch(id);
    return MatchViewTransformers.toMatchDetails(match);
  }

  static useMatchList(view: MatchListView = MatchListView.ALL) {
    const query = useQuery({
      queryKey: matchKeys.list(view),
      queryFn: () => MatchService.getMatchCards(view),
      staleTime: view === MatchListView.HISTORY ? 5 * 60_000 : 2 * 60_000,
    });
    useMatchBoundaryRefresh(query.data, view);
    return query;
  }

  static useMatchListRaw(view: MatchListView = MatchListView.ALL) {
    return useQuery({
      queryKey: [...matchKeys.list(view), 'raw'],
      queryFn: () => MatchService.getMatches(view),
      staleTime: 2 * 60_000,
    });
  }

  static useUpcomingMatches() {
    return MatchService.useMatchList(MatchListView.UPCOMING);
  }

  static useHistoryMatches(yearFilter = 'all') {
    const query = MatchService.useMatchList(MatchListView.HISTORY);
    const availableYears = [
      ...new Set(
        query.data?.map((match) => match.localStart.date.slice(0, 4)) ?? []
      ),
    ].sort((left, right) => right.localeCompare(left));
    return {
      ...query,
      availableYears,
      data:
        yearFilter === 'all'
          ? query.data
          : query.data?.filter(
              (match) => match.localStart.date.slice(0, 4) === yearFilter
            ),
    };
  }

  static useMatchDetails(id: string) {
    return useQuery({
      queryKey: matchKeys.detail(id),
      queryFn: () => MatchService.getMatchDetails(id),
      enabled: Boolean(id),
      staleTime: 0,
    });
  }

  static useLineupContext(id: string) {
    return useQuery({
      queryKey: matchKeys.lineupContext(id),
      queryFn: () => matchApi.getMatchLineupContext(id),
      enabled: Boolean(id),
      staleTime: 0,
    });
  }

  static useCreateMatch() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (formData: MatchView.MatchFormData) =>
        matchApi.createMatch(MatchViewTransformers.toCreateRequest(formData)),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: matchKeys.lists() });
      },
    });
  }

  static useUpdateMatch() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({
        id,
        formData,
        expectedVersion,
      }: {
        id: string;
        formData: MatchView.MatchFormData;
        expectedVersion: number;
      }) =>
        matchApi.updateMatch(
          id,
          MatchViewTransformers.toUpdateRequest(formData, expectedVersion)
        ),
      onSuccess: (response) => {
        updateCommittedMatch(queryClient, response);
        void queryClient.invalidateQueries({
          queryKey: matchKeys.lineupContext(response.id),
          exact: true,
        });
      },
      onError: (_error, variables) => {
        void queryClient.invalidateQueries({
          queryKey: matchKeys.detail(variables.id),
          exact: true,
        });
        void queryClient.invalidateQueries({ queryKey: matchKeys.lists() });
      },
    });
  }

  static useDeleteMatch() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({
        id,
        expectedVersion,
      }: {
        id: string;
        expectedVersion: number;
      }) => matchApi.deleteMatch(id, { expectedVersion }),
      onSuccess: (_, variables) => {
        queryClient.removeQueries({
          queryKey: matchKeys.detail(variables.id),
          exact: true,
        });
        queryClient.removeQueries({
          queryKey: matchKeys.lineupContext(variables.id),
          exact: true,
        });
        void queryClient.invalidateQueries({ queryKey: matchKeys.lists() });
      },
      onError: (_error, variables) => {
        void queryClient.invalidateQueries({
          queryKey: matchKeys.detail(variables.id),
          exact: true,
        });
        void queryClient.invalidateQueries({ queryKey: matchKeys.lists() });
      },
    });
  }

  static useSetResult() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({
        id,
        result,
      }: {
        id: string;
        result: MatchApi.SetMatchResultRequest;
      }) => matchApi.setMatchResult(id, result),
      onSuccess: (response) => {
        updateCommittedMatch(queryClient, response);
        void queryClient.invalidateQueries({
          queryKey: matchKeys.lineupContext(response.id),
          exact: true,
        });
      },
    });
  }

  static useUpdateLineup() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({
        matchId,
        request,
      }: {
        matchId: string;
        request: MatchApi.SetMatchLineupRequest;
      }) => matchApi.updateMatchLineup(matchId, request),
      onSuccess: (response) => {
        updateCommittedMatch(queryClient, response);
        void queryClient.invalidateQueries({
          queryKey: matchKeys.lineupContext(response.id),
          exact: true,
        });
      },
      onError: (_error, variables) => {
        void queryClient.invalidateQueries({
          queryKey: matchKeys.detail(variables.matchId),
          exact: true,
        });
        void queryClient.invalidateQueries({
          queryKey: matchKeys.lineupContext(variables.matchId),
          exact: true,
        });
      },
    });
  }

  static useSetMatchAvailability() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (command: MatchAvailabilityMutation) => {
        try {
          return command.kind === 'self'
            ? await matchApi.setOwnMatchAvailability(command.matchId, {
                expectedVersion: command.expectedVersion,
                participation: command.participation,
              })
            : await matchApi.setPlayerMatchAvailability(
                command.matchId,
                command.playerId,
                {
                  expectedVersion: command.expectedVersion,
                  participation: command.participation,
                }
              );
        } catch (mutationError) {
          void queryClient.invalidateQueries({
            queryKey: matchKeys.lists(),
          });
          try {
            void queryClient.invalidateQueries({
              queryKey: matchKeys.lineupContext(command.matchId),
              exact: true,
            });
            await queryClient.invalidateQueries(
              {
                queryKey: matchKeys.detail(command.matchId),
                exact: true,
              },
              { throwOnError: true }
            );
          } catch (refreshError) {
            throw new MatchAvailabilityRefreshError(
              mutationError,
              refreshError
            );
          }
          throw mutationError;
        }
      },
      onSuccess: (response) => {
        updateCommittedMatch(queryClient, response);
        void queryClient.invalidateQueries({
          queryKey: matchKeys.lineupContext(response.id),
          exact: true,
        });
      },
      retry: false,
    });
  }
}
