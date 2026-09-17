import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as activityApi from '@app/lib/api/activityApi';
import type { ActivityRequest } from '@app/lib/api/activityApi';
import { Language } from '@club/shared-types/core/enums';

/**
 * Activity Service
 * React Query hooks for activity management
 */

export class ActivityService {
  static readonly availabilityQueryKey = [
    'activities',
    'availability',
  ] as const;

  static useAvailability() {
    return useQuery({
      queryKey: this.availabilityQueryKey,
      queryFn: activityApi.getActivityAvailability,
      staleTime: 5 * 60 * 1000,
    });
  }

  static useUpdateAvailability() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: (enabled: boolean) =>
        activityApi.updateActivityAvailability(enabled),
      onSuccess: (availability) => {
        queryClient.setQueryData(this.availabilityQueryKey, availability);
      },
    });
  }

  /**
   * Get activities (public)
   */
  static useActivities(language: Language = Language.ENGLISH) {
    return useQuery({
      queryKey: ['activities', 'list', { language, projection: 'public' }],
      queryFn: () => activityApi.getActivities(language),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  }

  /**
   * Get activities for administration
   */
  static useAdminActivities(language: Language = Language.ENGLISH) {
    return useQuery({
      queryKey: ['activities', 'list', { language, projection: 'admin' }],
      queryFn: () => activityApi.getAdminActivities(language),
      staleTime: 5 * 60 * 1000,
    });
  }

  /**
   * Get single activity with all translations (admin)
   */
  static useActivity(id: string) {
    return useQuery({
      queryKey: ['activities', 'detail', id],
      queryFn: () => activityApi.getActivity(id),
      enabled: !!id,
    });
  }

  /**
   * Create activity mutation (admin)
   */
  static useCreateActivity() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: (data: ActivityRequest) => activityApi.createActivity(data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['activities'] });
      },
    });
  }

  /**
   * Update activity mutation (admin)
   */
  static useUpdateActivity() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: ({ id, data }: { id: string; data: ActivityRequest }) =>
        activityApi.updateActivity(id, data),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['activities'] });
      },
    });
  }

  /**
   * Toggle activity visibility mutation (admin)
   */
  static useToggleActivity() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: (id: string) => activityApi.toggleActivity(id),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['activities'] });
      },
    });
  }

  /**
   * Delete activity mutation (admin)
   */
  static useDeleteActivity() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: (id: string) => activityApi.deleteActivity(id),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['activities'] });
      },
    });
  }
}
