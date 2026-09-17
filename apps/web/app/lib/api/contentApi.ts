import type {
  HomepageContentAdministrationResponse,
  HomepageContentPublicResponse,
  HomepageContentValues,
} from '@club/shared-types/api/homepageContent';
import apiClient from './client';
import type { ApiResponse } from './types';

export async function getHomepageContentAdministration(): Promise<HomepageContentAdministrationResponse> {
  const response =
    await apiClient.get<ApiResponse<HomepageContentAdministrationResponse>>(
      '/content/admin'
    );
  return response.data.data;
}

export async function updateHomepageContent(
  content: HomepageContentValues
): Promise<HomepageContentAdministrationResponse> {
  const response = await apiClient.put<
    ApiResponse<HomepageContentAdministrationResponse>
  >('/content/admin', { content });
  return response.data.data;
}

export type {
  HomepageContentAdministrationResponse,
  HomepageContentPublicResponse,
  HomepageContentValues,
};
