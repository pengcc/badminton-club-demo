/**
 * Membership Application Service
 *
 * Handles membership application submissions and management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as membershipApplicationApi from '@app/lib/api/membershipApplicationApi';
import { retryAmbiguousLifecycleMutation } from './lifecycleMutationRetry';
import type { MembershipApplicationResponse } from '@club/shared-types/api/membershipApplication';

export class MembershipApplicationService {
  /**
   * Get all applications
   */
  static async getApplications(): Promise<any[]> {
    const response = await membershipApplicationApi.getMembershipApplications();
    return response.data;
  }

  static async getApplication(
    id: string
  ): Promise<MembershipApplicationResponse> {
    const response =
      await membershipApplicationApi.getMembershipApplication(id);
    return response.data;
  }

  /**
   * Hook: Get list of applications
   */
  static useApplicationList() {
    return useQuery({
      queryKey: ['applications', 'list'],
      queryFn: () => MembershipApplicationService.getApplications(),
      staleTime: 5 * 60 * 1000,
    });
  }

  /**
   * Hook: Contact applicant mutation
   */
  static useContactApplicant() {
    return useMutation({
      mutationFn: async ({ id, message }: { id: string; message: string }) => {
        return await membershipApplicationApi.contactApplicant(id, { message });
      },
    });
  }

  /**
   * Hook: Approve application mutation
   */
  static useApproveApplication() {
    const queryClient = useQueryClient();

    return useMutation({
      retry: retryAmbiguousLifecycleMutation,
      mutationFn: async (variables: {
        id: string;
        reviewNote?: string;
        approvalMessage?: string;
        idempotencyKey?: string;
      }) => {
        variables.idempotencyKey ??= crypto.randomUUID();
        const response =
          await membershipApplicationApi.approveMembershipApplication(
            variables.id,
            variables.reviewNote,
            variables.approvalMessage,
            variables.idempotencyKey
          );
        return response;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['applications'] });
        queryClient.invalidateQueries({ queryKey: ['users'] });
        queryClient.invalidateQueries({ queryKey: ['members'] });
      },
    });
  }

  /**
   * Hook: Reject application mutation
   */
  static useRejectApplication() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async ({
        id,
        reason,
        reviewNote,
      }: {
        id: string;
        reason: string;
        reviewNote?: string;
      }) => {
        const response =
          await membershipApplicationApi.rejectMembershipApplication(
            id,
            reason,
            reviewNote
          );
        return response;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['applications'] });
      },
    });
  }

  static useReissuePasswordSetup() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: ({ id }: { id: string }) =>
        membershipApplicationApi.reissuePasswordSetup(id),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['applications'] });
        queryClient.invalidateQueries({ queryKey: ['users'] });
      },
    });
  }
}
