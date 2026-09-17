import apiClient from './client';
import type {
  TasterSessionPublicContentAdministrationResponse,
  TasterSessionPublicContentValues,
} from '@club/shared-types/api/tasterSessionPublicContent';

export async function getTasterSessionPublicContentAdministration(): Promise<TasterSessionPublicContentAdministrationResponse> {
  const response = await apiClient.get('/taster-session-content/admin');
  return response.data.data;
}

export async function updateTasterSessionPublicContent(
  content: TasterSessionPublicContentValues
): Promise<TasterSessionPublicContentAdministrationResponse> {
  const response = await apiClient.put('/taster-session-content/admin', {
    content,
  });
  return response.data.data;
}
