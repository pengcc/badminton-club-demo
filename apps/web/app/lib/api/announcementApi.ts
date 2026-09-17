import apiClient from './client';
import type { ApiResponse } from './types';
import {
  AnnouncementType,
  type AnnouncementAdministrationDetail,
  type AnnouncementAdministrationListItem,
  type AnnouncementMutation,
  type AnnouncementPublicResponse,
} from '@club/shared-types/api/announcement';
import { Language } from '@club/shared-types/core/enums';

export { AnnouncementType };

/**
 * Announcement API module
 * Handles homepage announcement operations
 */

export type AnnouncementRequest = AnnouncementMutation;

/**
 * Get the public announcement projection
 */
export const getAnnouncements = async (
  language: Language = Language.ENGLISH
): Promise<AnnouncementPublicResponse[]> => {
  const response = await apiClient.get<
    ApiResponse<AnnouncementPublicResponse[]>
  >('/announcements', { params: { language } });
  return response.data.data;
};

/**
 * Get the administration announcement projection (admin only)
 */
export const getAdminAnnouncements = async (
  language: Language = Language.ENGLISH
): Promise<AnnouncementAdministrationListItem[]> => {
  const response = await apiClient.get<
    ApiResponse<AnnouncementAdministrationListItem[]>
  >('/announcements/admin', { params: { language } });
  return response.data.data;
};

/**
 * Get single announcement with all translations (admin only)
 */
export const getAnnouncement = async (
  id: string
): Promise<AnnouncementAdministrationDetail> => {
  const response = await apiClient.get<
    ApiResponse<AnnouncementAdministrationDetail>
  >(`/announcements/${id}`);
  return response.data.data;
};

/**
 * Create new announcement (admin only)
 */
export const createAnnouncement = async (
  data: AnnouncementRequest
): Promise<AnnouncementAdministrationDetail> => {
  const response = await apiClient.post<
    ApiResponse<AnnouncementAdministrationDetail>
  >('/announcements', data);
  return response.data.data;
};

/**
 * Update announcement (admin only)
 */
export const updateAnnouncement = async (
  id: string,
  data: AnnouncementRequest
): Promise<AnnouncementAdministrationDetail> => {
  const response = await apiClient.put<
    ApiResponse<AnnouncementAdministrationDetail>
  >(`/announcements/${id}`, data);
  return response.data.data;
};

/**
 * Toggle announcement visibility (admin only)
 */
export const toggleAnnouncement = async (
  id: string
): Promise<{ id: string; isActive: boolean }> => {
  const response = await apiClient.patch<
    ApiResponse<{ id: string; isActive: boolean }>
  >(`/announcements/${id}/toggle`);
  return response.data.data;
};

/**
 * Delete announcement (admin only)
 */
export const deleteAnnouncement = async (id: string): Promise<void> => {
  await apiClient.delete(`/announcements/${id}`);
};
