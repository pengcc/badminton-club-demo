import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { guestPlayApi } from '@app/lib/api/guestPlayApi';
import type {
  CreateGuestPlayRequest,
  GuestPlayCorrectionCommand,
  GuestPlayDecisionCommand,
  GuestPlayListQuery,
  GuestPlayLocale,
  GuestPlayNotificationKind,
} from '@club/shared-types/api/guestPlay';

const keys = {
  all: ['guestPlay'] as const,
  opportunities: (locale: GuestPlayLocale) =>
    ['guestPlay', 'opportunities', locale] as const,
  mine: ['guestPlay', 'mine'] as const,
  list: (query: Partial<GuestPlayListQuery>) =>
    ['guestPlay', 'list', query] as const,
  stats: ['guestPlay', 'stats'] as const,
  detail: (id: string | null) => ['guestPlay', 'detail', id] as const,
};

function useGuestPlayMutation<T>(mutationFn: (value: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.all }),
  });
}

export class GuestPlayService {
  static useOpportunities(locale: GuestPlayLocale) {
    return useQuery({
      queryKey: keys.opportunities(locale),
      queryFn: () => guestPlayApi.getOpportunities(locale),
      staleTime: 60_000,
    });
  }
  static useCreateRequest() {
    return useGuestPlayMutation((command: CreateGuestPlayRequest) =>
      guestPlayApi.createRequest(command)
    );
  }
  static useMyRequests() {
    return useQuery({
      queryKey: keys.mine,
      queryFn: guestPlayApi.getMyRequests,
      staleTime: 30_000,
    });
  }
  static useCancelRequest() {
    return useGuestPlayMutation(
      ({ id, expectedVersion }: { id: string; expectedVersion: number }) =>
        guestPlayApi.cancelRequest(id, expectedVersion)
    );
  }
  static useRequestList(query: Partial<GuestPlayListQuery>) {
    return useQuery({
      queryKey: keys.list(query),
      queryFn: () => guestPlayApi.getAllRequests(query),
      staleTime: 30_000,
    });
  }
  static useStats() {
    return useQuery({
      queryKey: keys.stats,
      queryFn: guestPlayApi.getStats,
      staleTime: 30_000,
    });
  }
  static useRequestById(id: string | null) {
    return useQuery({
      queryKey: keys.detail(id),
      queryFn: () => guestPlayApi.getRequestById(id as string),
      enabled: Boolean(id),
      staleTime: 30_000,
    });
  }
  static useDecision() {
    return useGuestPlayMutation(
      ({ id, command }: { id: string; command: GuestPlayDecisionCommand }) =>
        guestPlayApi.decide(id, command)
    );
  }
  static useCorrection() {
    return useGuestPlayMutation(
      ({ id, command }: { id: string; command: GuestPlayCorrectionCommand }) =>
        guestPlayApi.correct(id, command)
    );
  }
  static useArchive() {
    return useGuestPlayMutation(
      ({ id, expectedVersion }: { id: string; expectedVersion: number }) =>
        guestPlayApi.archive(id, expectedVersion)
    );
  }
  static useRestore() {
    return useGuestPlayMutation(
      ({ id, expectedVersion }: { id: string; expectedVersion: number }) =>
        guestPlayApi.restore(id, expectedVersion)
    );
  }
  static useRetryNotification() {
    return useGuestPlayMutation(
      ({
        id,
        notification,
        expectedVersion,
      }: {
        id: string;
        notification: GuestPlayNotificationKind;
        expectedVersion: number;
      }) => guestPlayApi.retryNotification(id, notification, expectedVersion)
    );
  }
}
