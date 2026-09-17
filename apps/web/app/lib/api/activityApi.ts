import apiClient from './client';
import type { ApiResponse } from './types';
import { Language } from '@club/shared-types/core/enums';
import type {
  ActivityAvailability,
  ActivityCompleteness,
  ActivityMutationValues,
  ActivityTranslations,
} from '@club/shared-types/api/activity';
import type { LocalizedText } from '@club/shared-types/api/localizedContent';

/**
 * Activity API module
 * Handles activity CRUD operations
 */

/**
 * Activity response (single language — public)
 */
export interface ActivityResponse {
  id: string;
  name: string;
  description: string;
  images: string[];
  videoLink: string;
  videoDescription: string;
  isVisible: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
  updatedBy: {
    id: string;
    name: string;
  };
  completeness?: ActivityCompleteness;
}

/**
 * Full activity with all translations (admin only)
 */
export interface ActivityFull {
  id: string;
  translations: ActivityTranslations;
  images: string[];
  videoLink: string;
  videoDescription: LocalizedText;
  isVisible: boolean;
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
  completeness: ActivityCompleteness;
}

export interface ActivityMediaCleanupWarning {
  code: 'ACTIVITY_MEDIA_CLEANUP_FAILED';
  message: string;
}

export interface ActivityUpdateOutcome {
  activity: ActivityFull;
  mediaCleanupWarning: ActivityMediaCleanupWarning | null;
}

export interface ActivityDeleteOutcome {
  deleted: true;
  mediaCleanupWarning: ActivityMediaCleanupWarning | null;
}

/**
 * Create/Update activity request
 */
export type ActivityRequest = ActivityMutationValues & { newImages: File[] };

export const getActivityAvailability =
  async (): Promise<ActivityAvailability> => {
    const response = await apiClient.get<ApiResponse<ActivityAvailability>>(
      '/activities/availability'
    );
    return response.data.data;
  };

export const updateActivityAvailability = async (
  enabled: boolean
): Promise<ActivityAvailability> => {
  const response = await apiClient.put<ApiResponse<ActivityAvailability>>(
    '/activities/availability',
    { enabled }
  );
  return response.data.data;
};

function activityFormData(data: ActivityRequest): FormData {
  const { newImages, ...activity } = data;
  const formData = new FormData();
  formData.append('payload', JSON.stringify({ activity }));
  for (const image of newImages) formData.append('images', image);
  return formData;
}

/**
 * Get the public activity projection
 */
export const getActivities = async (
  language: Language = Language.ENGLISH
): Promise<ActivityResponse[]> => {
  const response = await apiClient.get<ApiResponse<ActivityResponse[]>>(
    '/activities',
    {
      params: { language },
    }
  );
  return response.data.data;
};

/**
 * Get the administration activity projection (admin only)
 */
export const getAdminActivities = async (
  language: Language = Language.ENGLISH
): Promise<ActivityResponse[]> => {
  const response = await apiClient.get<ApiResponse<ActivityResponse[]>>(
    '/activities/admin',
    { params: { language } }
  );
  return response.data.data;
};

/**
 * Get single activity with all translations (admin only)
 */
export const getActivity = async (id: string): Promise<ActivityFull> => {
  const response = await apiClient.get<ApiResponse<ActivityFull>>(
    `/activities/${id}`
  );
  return response.data.data;
};

/**
 * Create new activity (admin only)
 */
export const createActivity = async (
  data: ActivityRequest
): Promise<ActivityFull> => {
  const response = await apiClient.post<ApiResponse<ActivityFull>>(
    '/activities',
    activityFormData(data),
    { headers: { 'Content-Type': undefined } }
  );
  return response.data.data;
};

/**
 * Update activity (admin only)
 */
export const updateActivity = async (
  id: string,
  data: ActivityRequest
): Promise<ActivityUpdateOutcome> => {
  const response = await apiClient.put<ApiResponse<ActivityUpdateOutcome>>(
    `/activities/${id}`,
    activityFormData(data),
    { headers: { 'Content-Type': undefined } }
  );
  return response.data.data;
};

/**
 * Toggle activity visibility (admin only)
 */
export const toggleActivity = async (
  id: string
): Promise<{ id: string; isVisible: boolean }> => {
  const response = await apiClient.patch<
    ApiResponse<{ id: string; isVisible: boolean }>
  >(`/activities/${id}/toggle`);
  return response.data.data;
};

/**
 * Delete activity (admin only)
 */
export const deleteActivity = async (
  id: string
): Promise<ActivityDeleteOutcome> => {
  const response = await apiClient.delete<ApiResponse<ActivityDeleteOutcome>>(
    `/activities/${id}`
  );
  return response.data.data;
};
