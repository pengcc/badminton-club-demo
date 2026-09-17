import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as locationApi from '@app/lib/api/locationApi';
import type { LocationRequest } from '@app/lib/api/locationApi';
import { Language } from '@club/shared-types/core/enums';

/**
 * Location Service
 * React Query hooks for location management
 */

export class LocationService {
  /**
   * Get locations for homepage (public)
   */
  static useLocations(language: Language = Language.ENGLISH) {
    return useQuery({
      queryKey: ['locations', 'list', { language, projection: 'public' }],
      queryFn: () => locationApi.getLocations(language),
      staleTime: 5 * 60 * 1000, // 5 minutes
    });
  }

  /**
   * Get locations for administration
   */
  static useAdminLocations(language: Language = Language.ENGLISH) {
    return useQuery({
      queryKey: ['locations', 'list', { language, projection: 'admin' }],
      queryFn: () => locationApi.getAdminLocations(language),
      staleTime: 5 * 60 * 1000,
    });
  }

  /**
   * Get single location with all translations (admin)
   */
  static useLocation(id: string) {
    return useQuery({
      queryKey: ['locations', 'detail', id],
      queryFn: () => locationApi.getLocation(id),
      enabled: !!id,
    });
  }

  /**
   * Create location mutation (admin)
   */
  static useCreateLocation() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: (data: LocationRequest) => locationApi.createLocation(data),
      onSuccess: () => {
        // Invalidate all location lists
        queryClient.invalidateQueries({ queryKey: ['locations', 'list'] });
      },
    });
  }

  /**
   * Update location mutation (admin)
   */
  static useUpdateLocation() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: ({
        id,
        data,
      }: {
        id: string;
        data: Partial<LocationRequest>;
      }) => locationApi.updateLocation(id, data),
      onSuccess: (_, variables) => {
        // Invalidate specific location and lists
        queryClient.invalidateQueries({
          queryKey: ['locations', 'detail', variables.id],
        });
        queryClient.invalidateQueries({ queryKey: ['locations', 'list'] });
      },
    });
  }

  /**
   * Toggle location visibility mutation (admin)
   */
  static useToggleLocation() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: (id: string) => locationApi.toggleLocation(id),
      onSuccess: () => {
        // Invalidate all lists to reflect visibility change
        queryClient.invalidateQueries({ queryKey: ['locations', 'list'] });
      },
    });
  }

  /**
   * Delete location mutation (admin)
   */
  static useDeleteLocation() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: (id: string) => locationApi.deleteLocation(id),
      onSuccess: () => {
        // Invalidate all location queries
        queryClient.invalidateQueries({ queryKey: ['locations'] });
      },
    });
  }
}
