import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApproveMembershipTerminationInput,
  BatchRecordMembershipTerminationInput,
  RecordMembershipTerminationInput,
  RejectMembershipTerminationInput,
  RequestMembershipTerminationInput,
} from '@club/shared-types/schemas';
import { MembershipTerminationStatus } from '@club/shared-types/core/enums';
import * as api from '@app/lib/api/membershipTerminationApi';
import { retryAmbiguousLifecycleMutation } from './lifecycleMutationRetry';

const queryKey = ['membership-terminations'] as const;

function invalidateLifecycleProjections(
  client: ReturnType<typeof useQueryClient>
) {
  client.invalidateQueries({ queryKey: ['users'] });
  client.invalidateQueries({ queryKey: ['players'] });
  client.invalidateQueries({ queryKey: ['matches'] });
}

export class MembershipTerminationService {
  static useMine(enabled = true) {
    return useQuery({
      queryKey: [...queryKey, 'me'],
      queryFn: api.getMyTermination,
      enabled,
    });
  }

  static useList(status?: MembershipTerminationStatus) {
    return useQuery({
      queryKey: [...queryKey, 'list', status ?? 'open'],
      queryFn: () => api.listTerminations(status),
    });
  }

  static useRequest() {
    const client = useQueryClient();
    return useMutation({
      retry: retryAmbiguousLifecycleMutation,
      mutationFn: (variables: {
        request: RequestMembershipTerminationInput;
        idempotencyKey?: string;
      }) => {
        variables.idempotencyKey ??= crypto.randomUUID();
        return api.requestTermination(
          variables.request,
          variables.idempotencyKey
        );
      },
      onSuccess: () => client.invalidateQueries({ queryKey }),
    });
  }

  static useApprove() {
    const client = useQueryClient();
    return useMutation({
      retry: retryAmbiguousLifecycleMutation,
      mutationFn: (variables: {
        id: string;
        request: ApproveMembershipTerminationInput;
        idempotencyKey?: string;
      }) => {
        variables.idempotencyKey ??= crypto.randomUUID();
        return api.approveTermination(
          variables.id,
          variables.request,
          variables.idempotencyKey
        );
      },
      onSuccess: (_data, variables) => {
        client.invalidateQueries({ queryKey });
        if (variables.request.effectiveTiming === 'today') {
          invalidateLifecycleProjections(client);
        }
      },
    });
  }

  static useReject() {
    const client = useQueryClient();
    return useMutation({
      retry: retryAmbiguousLifecycleMutation,
      mutationFn: (variables: {
        id: string;
        request: RejectMembershipTerminationInput;
        idempotencyKey?: string;
      }) => {
        variables.idempotencyKey ??= crypto.randomUUID();
        return api.rejectTermination(
          variables.id,
          variables.request,
          variables.idempotencyKey
        );
      },
      onSuccess: () => client.invalidateQueries({ queryKey }),
    });
  }

  static useRecordOffline() {
    const client = useQueryClient();
    return useMutation({
      retry: retryAmbiguousLifecycleMutation,
      mutationFn: (variables: {
        request: RecordMembershipTerminationInput;
        idempotencyKey?: string;
      }) => {
        variables.idempotencyKey ??= crypto.randomUUID();
        return api.recordOfflineTermination(
          variables.request,
          variables.idempotencyKey
        );
      },
      onSuccess: (_data, variables) => {
        client.invalidateQueries({ queryKey });
        if (variables.request.effectiveTiming === 'today') {
          invalidateLifecycleProjections(client);
        }
      },
    });
  }

  static useRecordBatch() {
    const client = useQueryClient();
    return useMutation({
      retry: retryAmbiguousLifecycleMutation,
      mutationFn: (variables: {
        request: BatchRecordMembershipTerminationInput;
        idempotencyKey?: string;
      }) => {
        variables.idempotencyKey ??= crypto.randomUUID();
        return api.recordTerminationBatch(
          variables.request,
          variables.idempotencyKey
        );
      },
      onSuccess: (_data, variables) => {
        client.invalidateQueries({ queryKey });
        if (variables.request.effectiveTiming === 'today') {
          invalidateLifecycleProjections(client);
        }
      },
    });
  }
}
