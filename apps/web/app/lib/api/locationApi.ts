import apiClient from './client';
import type { ApiResponse } from './types';
import type {
  LocationTimeSlot,
  LocationTimeSlotInput,
} from '@club/shared-types/api/location';

/**
 * Location API module
 * Handles training venue operations
 */

export interface LocationTranslation {
  name: string;
  address: string;
}

export interface LocationRequest {
  translations: {
    de: LocationTranslation;
    en: LocationTranslation;
    zh: LocationTranslation;
  };
  timeSlots: LocationTimeSlotInput[];
  imageUrl?: string;
  isActive?: boolean;
  order?: number;
}

export interface LocationResponse {
  id: string;
  name: string;
  address: string;
  timeSlots: LocationTimeSlot[];
  imageUrl: string;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: {
    id: string;
    name: string;
  };
}

export interface LocationDetailResponse {
  id: string;
  translations: {
    de: LocationTranslation;
    en: LocationTranslation;
    zh: LocationTranslation;
  };
  timeSlots: LocationTimeSlot[];
  imageUrl: string;
  isActive: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    name: string;
  };
  updatedBy: {
    id: string;
    name: string;
  };
}

/**
 * Get the public Location projection
 */
export const getLocations = async (
  language?: string
): Promise<LocationResponse[]> => {
  const params: Record<string, any> = {};
  if (language) params.language = language;

  const response = await apiClient.get<ApiResponse<LocationResponse[]>>(
    '/locations',
    { params }
  );
  return response.data.data;
};

/**
 * Get the administration Location projection (admin only)
 */
export const getAdminLocations = async (
  language?: string
): Promise<LocationResponse[]> => {
  const params: Record<string, any> = {};
  if (language) params.language = language;

  const response = await apiClient.get<ApiResponse<LocationResponse[]>>(
    '/locations/admin',
    {
      params,
    }
  );
  return response.data.data;
};

/**
 * Get single location with all translations (admin only)
 */
export const getLocation = async (
  id: string
): Promise<LocationDetailResponse> => {
  const response = await apiClient.get<ApiResponse<LocationDetailResponse>>(
    `/locations/${id}`
  );
  return response.data.data;
};

/**
 * Create location (admin only)
 */
export const createLocation = async (
  data: LocationRequest
): Promise<LocationDetailResponse> => {
  const response = await apiClient.post<ApiResponse<LocationDetailResponse>>(
    '/locations',
    data
  );
  return response.data.data;
};

/**
 * Update location (admin only)
 */
export const updateLocation = async (
  id: string,
  data: Partial<LocationRequest>
): Promise<LocationDetailResponse> => {
  const response = await apiClient.put<ApiResponse<LocationDetailResponse>>(
    `/locations/${id}`,
    data
  );
  return response.data.data;
};

/**
 * Toggle location visibility (admin only)
 */
export const toggleLocation = async (
  id: string
): Promise<{ id: string; isActive: boolean }> => {
  const response = await apiClient.patch<
    ApiResponse<{ id: string; isActive: boolean }>
  >(`/locations/${id}/toggle`);
  return response.data.data;
};

/**
 * Delete location (admin only)
 */
export const deleteLocation = async (id: string): Promise<void> => {
  await apiClient.delete(`/locations/${id}`);
};
