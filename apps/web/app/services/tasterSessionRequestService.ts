import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreateTasterSessionRequest,
  TasterSessionDispositionCommand,
  TasterSessionListQuery,
} from '@club/shared-types/api/tasterSessionRequest';
import { tasterSessionRequestApi } from '@app/lib/api/tasterSessionRequestApi';

const keys = {
  all: ['tasterSessionRequests'] as const,
  list: (query: TasterSessionListQuery) =>
    [...keys.all, 'list', query] as const,
  stats: () => [...keys.all, 'stats'] as const,
  options: (
    level: 'beginner' | 'experienced' | undefined,
    locale: 'de' | 'en' | 'zh'
  ) => [...keys.all, 'preferenceOptions', level, locale] as const,
};

function useRefreshAfterMutation() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: keys.all });
}

export class TasterSessionRequestService {
  static usePreferenceOptions(
    level: 'beginner' | 'experienced' | undefined,
    locale: 'de' | 'en' | 'zh'
  ) {
    return useQuery({
      queryKey: keys.options(level, locale),
      queryFn: () => tasterSessionRequestApi.preferenceOptions(level!, locale),
      enabled: level !== undefined,
      staleTime: 60_000,
    });
  }

  static useCreate() {
    const refresh = useRefreshAfterMutation();
    return useMutation({
      mutationFn: (input: CreateTasterSessionRequest) =>
        tasterSessionRequestApi.create(input),
      onSuccess: refresh,
    });
  }

  static useList(query: TasterSessionListQuery) {
    return useQuery({
      queryKey: keys.list(query),
      queryFn: () => tasterSessionRequestApi.list(query),
      staleTime: 30_000,
    });
  }

  static useStats() {
    return useQuery({
      queryKey: keys.stats(),
      queryFn: tasterSessionRequestApi.stats,
      staleTime: 30_000,
    });
  }

  static useDisposition() {
    const refresh = useRefreshAfterMutation();
    return useMutation({
      mutationFn: ({
        id,
        command,
      }: {
        id: string;
        command: TasterSessionDispositionCommand;
      }) => tasterSessionRequestApi.disposition(id, command),
      onSuccess: refresh,
      onError: refresh,
    });
  }

  static useArchive() {
    const refresh = useRefreshAfterMutation();
    return useMutation({
      mutationFn: ({
        id,
        expectedVersion,
        archived,
      }: {
        id: string;
        expectedVersion: number;
        archived: boolean;
      }) => tasterSessionRequestApi.archive(id, expectedVersion, archived),
      onSuccess: refresh,
      onError: refresh,
    });
  }

  static useRetryDelivery() {
    const refresh = useRefreshAfterMutation();
    return useMutation({
      mutationFn: ({
        id,
        expectedVersion,
      }: {
        id: string;
        expectedVersion: number;
      }) => tasterSessionRequestApi.retryDelivery(id, expectedVersion),
      onSuccess: refresh,
      onError: refresh,
    });
  }
}
