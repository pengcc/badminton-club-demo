/**
 * Membership Application Service
 *
 * Handles membership application submissions and management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as membershipApplicationApi from '@app/lib/api/membershipApplicationApi';
import { BaseService } from './baseService';

export class MembershipApplicationService {
  /**
   * Get all applications
   */
  static async getApplications(): Promise<any[]> {
    const response = await membershipApplicationApi.getMembershipApplications();
    return response.data;
  }

  /**
   * Hook: Get list of applications
   */
  static useApplicationList() {
    return useQuery({
      queryKey: BaseService.queryKey('applications', 'list'),
      queryFn: () => MembershipApplicationService.getApplications(),
      staleTime: 5 * 60 * 1000,
    });
  }

  /**
   * Hook: Submit application mutation
   */
  static useSubmitApplication() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (formData: any) => {
        const response = await membershipApplicationApi.submitMembershipApplication(formData);
        return response;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['applications', 'list'] });
      },
    });
  }
}


