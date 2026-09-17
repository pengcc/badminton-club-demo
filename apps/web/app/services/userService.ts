/**
 * User Service
 *
 * Handles all user-related data fetching and mutations
 */

import {
  keepPreviousData,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import type { UserView } from '@club/shared-types/view/user';
import type { Api } from '@club/shared-types/api/user';
import { UserViewTransformers } from '@club/shared-types/view/transformers/user';
import * as userApi from '@app/lib/api/userApi';
import { retryAmbiguousLifecycleMutation } from './lifecycleMutationRetry';
import { MembershipStatus } from '@club/shared-types/core/enums';
import type { AccountEstablishmentRequest } from '@club/shared-types/api/accountOnboarding';
import type {
  EmailChangeRequestInput,
  UpdateUserInput,
} from '@club/shared-types/schemas/user';

const userKeys = {
  all: ['users'] as const,
  lists: ['users', 'list'] as const,
  list: (query?: Api.MemberListQuery) =>
    query ? ([...userKeys.lists, query] as const) : userKeys.lists,
  profile: (id: string) => ['users', 'profile', { id }] as const,
};

export interface MemberListViewResponse
  extends Omit<Api.MemberListResponse, 'items'> {
  items: UserView.UserCard[];
}

function isMemberListResponse(value: unknown): value is Api.MemberListResponse {
  if (!value || typeof value !== 'object') return false;
  const response = value as Partial<Api.MemberListResponse>;
  const pagination = response.pagination;
  const statistics = response.statistics;
  const genderFilterCounts = response.genderFilterCounts;

  return (
    response.success === true &&
    typeof response.appliedFilter === 'string' &&
    Array.isArray(response.items) &&
    !!pagination &&
    typeof pagination.page === 'number' &&
    typeof pagination.pageSize === 'number' &&
    typeof pagination.total === 'number' &&
    typeof pagination.totalPages === 'number' &&
    typeof pagination.returned === 'number' &&
    !!statistics &&
    typeof statistics.total === 'number' &&
    !!statistics.gender &&
    Array.isArray(statistics.birthYears) &&
    !!genderFilterCounts &&
    typeof genderFilterCounts.male === 'number' &&
    typeof genderFilterCounts.female === 'number' &&
    typeof genderFilterCounts.other === 'number' &&
    typeof genderFilterCounts.missing === 'number'
  );
}

export class UserService {
  static usePreviewMemberCsv() {
    return useMutation({
      mutationFn: userApi.previewMemberCsv,
      retry: false,
      gcTime: 0,
    });
  }
  static useApplyMemberCsv() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({
        file,
        previewContext,
      }: {
        file: File;
        previewContext: string;
      }) => userApi.applyMemberCsv(file, previewContext),
      retry: false,
      gcTime: 0,
      onSettled: () => {
        // An interrupted apply may already have committed independent rows.
        void queryClient.invalidateQueries({ queryKey: userKeys.all });
        void queryClient.invalidateQueries({ queryKey: ['players'] });
        void queryClient.invalidateQueries({
          queryKey: ['matches', 'lineup-context'],
        });
      },
    });
  }

  /**
   * Hook: start the authenticated User-owned email-change workflow.
   */
  static useRequestEmailChange() {
    return useMutation({
      mutationFn: (request: EmailChangeRequestInput) =>
        userApi.requestEmailChange(request),
    });
  }

  static useRequestPasswordRecovery() {
    return useMutation({
      mutationFn: (variables: { id: string; locale: 'de' | 'en' | 'zh' }) =>
        userApi.requestPasswordRecovery(variables.id, variables.locale),
    });
  }

  /**
   * Get all users as cards (for list views)
   */
  static async getMemberList(
    query?: Api.MemberListQuery
  ): Promise<MemberListViewResponse> {
    const response = await userApi.getMemberList(query);
    if (!isMemberListResponse(response)) {
      throw new Error('Invalid member list response');
    }

    return {
      ...response,
      items: response.items.map((user) =>
        UserViewTransformers.toUserCard(user)
      ),
    };
  }

  /**
   * Get single user profile (for detail views)
   */
  static async getUserProfile(id: string): Promise<Api.UserResponse> {
    return userApi.getUser(id);
  }

  /**
   * Hook: Get list of users
   */
  static useMemberList(query?: Api.MemberListQuery, enabled = true) {
    return useQuery({
      queryKey: userKeys.list(query),
      queryFn: () => UserService.getMemberList(query),
      enabled,
      placeholderData: keepPreviousData,
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  }

  static async getRichMemberExport(query: Api.MemberExportQuery) {
    return userApi.getRichMemberExport(query);
  }

  /**
   * Hook: Get single user profile
   */
  static useUserProfile(id: string) {
    return useQuery({
      queryKey: userKeys.profile(id),
      queryFn: () => UserService.getUserProfile(id),
      enabled: !!id,
      staleTime: 5 * 60 * 1000,
    });
  }

  /**
   * Hook: establish or compatibly reuse a canonical account.
   */
  static useEstablishAccount() {
    const queryClient = useQueryClient();

    return useMutation({
      retry: retryAmbiguousLifecycleMutation,
      mutationFn: async (variables: {
        request: AccountEstablishmentRequest;
        idempotencyKey: string;
      }) => {
        return userApi.establishAccount(
          variables.request,
          variables.idempotencyKey
        );
      },
      onSuccess: (_data, variables) => {
        if (variables.request.targetKind === 'member') {
          queryClient.invalidateQueries({ queryKey: userKeys.all });
        }
        if (variables.request.establishPlayer) {
          queryClient.invalidateQueries({ queryKey: ['players'] });
          queryClient.invalidateQueries({
            queryKey: ['matches', 'lineup-context'],
          });
        }
      },
    });
  }

  /**
   * Hook: Update user mutation
   */
  static useUpdateUser() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (variables: {
        id: string;
        formData: UpdateUserInput;
      }) => {
        const response = await userApi.updateUser(
          variables.id,
          variables.formData
        );
        return UserViewTransformers.toUserCard(response);
      },
      onSuccess: (_data, variables) => {
        queryClient.invalidateQueries({ queryKey: userKeys.lists });
        queryClient.invalidateQueries({
          queryKey: userKeys.profile(variables.id),
          exact: true,
        });
        const changedFields = Object.keys(variables.formData);
        if (
          changedFields.some(
            (field) => field === 'firstName' || field === 'lastName'
          )
        ) {
          queryClient.invalidateQueries({ queryKey: ['players'] });
        }
        if (changedFields.includes('gender')) {
          queryClient.invalidateQueries({ queryKey: ['players'] });
          queryClient.invalidateQueries({
            queryKey: ['matches', 'lineup-context'],
          });
        }
      },
    });
  }

  static useSetAdministratorDesignation() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (variables: { id: string; designated: boolean }) =>
        UserViewTransformers.toUserCard(
          await userApi.setAdministratorDesignation(
            variables.id,
            variables.designated
          )
        ),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: userKeys.all });
      },
    });
  }

  static useTransitionMembershipActivity() {
    const queryClient = useQueryClient();
    return useMutation({
      retry: retryAmbiguousLifecycleMutation,
      mutationFn: async (variables: {
        id: string;
        targetStatus: MembershipStatus.ACTIVE | MembershipStatus.PASSIVE;
        reason: string;
        idempotencyKey?: string;
      }) => {
        variables.idempotencyKey ??= crypto.randomUUID();
        return UserViewTransformers.toUserCard(
          await userApi.transitionMembershipActivity(
            variables.id,
            variables.targetStatus,
            variables.reason,
            variables.idempotencyKey
          )
        );
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: userKeys.all });
      },
    });
  }

  /**
   * Hook: Delete user mutation
   */
  static useDeleteUser() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
        await userApi.deleteUser(id, reason);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: userKeys.all });
        // Invalidate player queries since deleting user could affect Player entity
        queryClient.invalidateQueries({ queryKey: ['players'] });
        queryClient.invalidateQueries({ queryKey: ['matches', 'detail'] });
        queryClient.invalidateQueries({
          queryKey: ['matches', 'lineup-context'],
        });
      },
    });
  }

  static useSuspendAccount() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (variables: { id: string; reason: string }) => {
        return UserViewTransformers.toUserCard(
          await userApi.suspendAccount(variables.id, variables.reason)
        );
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: userKeys.all });
      },
    });
  }

  static useUnsuspendAccount() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (variables: { id: string }) => {
        return UserViewTransformers.toUserCard(
          await userApi.unsuspendAccount(variables.id)
        );
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: userKeys.all });
      },
    });
  }

  /**
   * Hook: Send invitation
   */
  static useReissueAccountSetup() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        return await userApi.reissueAccountSetup(id);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: userKeys.all });
        queryClient.invalidateQueries({ queryKey: ['players'] });
      },
    });
  }
}
