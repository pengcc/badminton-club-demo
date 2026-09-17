import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as announcementApi from '@app/lib/api/announcementApi';
import type { AnnouncementRequest } from '@app/lib/api/announcementApi';
import { Language } from '@club/shared-types/core/enums';

/**
 * Announcement Service
 * React Query hooks for announcement management
 */

export class AnnouncementService {
  /**
   * Get announcements for homepage (public)
   */
  static useAnnouncements(language: Language = Language.ENGLISH) {
    return useQuery({
      queryKey: ['announcements', 'list', { language, projection: 'public' }],
      queryFn: () => announcementApi.getAnnouncements(language),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  }

  /**
   * Get announcements for administration
   */
  static useAdminAnnouncements(language: Language = Language.ENGLISH) {
    return useQuery({
      queryKey: ['announcements', 'list', { language, projection: 'admin' }],
      queryFn: () => announcementApi.getAdminAnnouncements(language),
      staleTime: 5 * 60 * 1000,
    });
  }

  /**
   * Get single announcement with all translations (admin)
   */
  static useAnnouncement(id: string) {
    return useQuery({
      queryKey: ['announcements', 'detail', id],
      queryFn: () => announcementApi.getAnnouncement(id),
      enabled: !!id,
    });
  }

  /**
   * Create announcement mutation (admin)
   */
  static useCreateAnnouncement() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: (data: AnnouncementRequest) =>
        announcementApi.createAnnouncement(data),
      onSuccess: () => {
        // Invalidate all announcement lists
        queryClient.invalidateQueries({ queryKey: ['announcements', 'list'] });
      },
    });
  }

  /**
   * Update announcement mutation (admin)
   */
  static useUpdateAnnouncement() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: ({ id, data }: { id: string; data: AnnouncementRequest }) =>
        announcementApi.updateAnnouncement(id, data),
      onSuccess: (_, variables) => {
        // Invalidate specific announcement and lists
        queryClient.invalidateQueries({
          queryKey: ['announcements', 'detail', variables.id],
        });
        queryClient.invalidateQueries({ queryKey: ['announcements', 'list'] });
      },
    });
  }

  /**
   * Toggle announcement visibility mutation (admin)
   */
  static useToggleAnnouncement() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: (id: string) => announcementApi.toggleAnnouncement(id),
      onSuccess: () => {
        // Invalidate all lists to reflect visibility change
        queryClient.invalidateQueries({ queryKey: ['announcements', 'list'] });
      },
    });
  }

  /**
   * Delete announcement mutation (admin)
   */
  static useDeleteAnnouncement() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: (id: string) => announcementApi.deleteAnnouncement(id),
      onSuccess: () => {
        // Invalidate all announcement queries
        queryClient.invalidateQueries({ queryKey: ['announcements'] });
      },
    });
  }
}
