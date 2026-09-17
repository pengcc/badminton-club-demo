import apiClient from './client';
import {
  tasterSessionPreferenceOptionSchema,
  tasterSessionRequestListResponseSchema,
  tasterSessionRequestResponseSchema,
  tasterSessionRequestStatsResponseSchema,
} from '@club/shared-types/api/tasterSessionRequest';
import type {
  CreateTasterSessionRequest,
  TasterSessionDispositionCommand,
  TasterSessionListQuery,
  TasterSessionPreferenceOption,
  TasterSessionRequestListResponse,
  TasterSessionRequestResponse,
  TasterSessionRequestStatsResponse,
} from '@club/shared-types/api/tasterSessionRequest';

export const tasterSessionRequestApi = {
  async preferenceOptions(
    playerLevel: 'beginner' | 'experienced',
    locale: 'de' | 'en' | 'zh'
  ): Promise<TasterSessionPreferenceOption[]> {
    const response = await apiClient.get(
      '/taster-session-requests/preference-options',
      { params: { playerLevel, locale } }
    );
    return tasterSessionPreferenceOptionSchema
      .array()
      .parse(response.data.data);
  },

  async create(
    input: CreateTasterSessionRequest
  ): Promise<TasterSessionRequestResponse> {
    const response = await apiClient.post('/taster-session-requests', input);
    return tasterSessionRequestResponseSchema.parse(response.data.data);
  },

  async list(
    query: TasterSessionListQuery
  ): Promise<TasterSessionRequestListResponse> {
    const response = await apiClient.get('/taster-session-requests', {
      params: query,
    });
    return tasterSessionRequestListResponseSchema.parse(response.data.data);
  },

  async stats(): Promise<TasterSessionRequestStatsResponse> {
    const response = await apiClient.get('/taster-session-requests/stats');
    return tasterSessionRequestStatsResponseSchema.parse(response.data.data);
  },

  async disposition(
    id: string,
    command: TasterSessionDispositionCommand
  ): Promise<TasterSessionRequestResponse> {
    const response = await apiClient.post(
      `/taster-session-requests/${id}/disposition`,
      command
    );
    return tasterSessionRequestResponseSchema.parse(response.data.data);
  },

  async archive(
    id: string,
    expectedVersion: number,
    archived: boolean
  ): Promise<TasterSessionRequestResponse> {
    const response = await apiClient.post(
      `/taster-session-requests/${id}/${archived ? 'archive' : 'unarchive'}`,
      { expectedVersion }
    );
    return tasterSessionRequestResponseSchema.parse(response.data.data);
  },

  async retryDelivery(
    id: string,
    expectedVersion: number
  ): Promise<TasterSessionRequestResponse> {
    const response = await apiClient.post(
      `/taster-session-requests/${id}/delivery/retry`,
      { expectedVersion }
    );
    return tasterSessionRequestResponseSchema.parse(response.data.data);
  },
};
