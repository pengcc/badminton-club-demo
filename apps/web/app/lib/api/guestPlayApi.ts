import type {
  CreateGuestPlayRequest,
  GuestPlayAdminResponse,
  GuestPlayCorrectionCommand,
  GuestPlayDecisionCommand,
  GuestPlayListQuery,
  GuestPlayListResponse,
  GuestPlayLocale,
  GuestPlayMemberResponse,
  GuestPlayNotificationKind,
  GuestPlayOpportunity,
  GuestPlayStatsResponse,
} from '@club/shared-types/api/guestPlay';
import apiClient from './client';

const data = <T>(response: { data: { data: T } }): T => response.data.data;

export const guestPlayApi = {
  async getOpportunities(
    locale: GuestPlayLocale
  ): Promise<GuestPlayOpportunity[]> {
    return data(
      await apiClient.get('/guest-play/opportunities', { params: { locale } })
    );
  },
  async createRequest(
    command: CreateGuestPlayRequest
  ): Promise<GuestPlayMemberResponse> {
    return data(await apiClient.post('/guest-play', command));
  },
  async getMyRequests(): Promise<GuestPlayMemberResponse[]> {
    return data(await apiClient.get('/guest-play/my-requests'));
  },
  async cancelRequest(
    id: string,
    expectedVersion: number
  ): Promise<GuestPlayMemberResponse> {
    return data(
      await apiClient.post(`/guest-play/${id}/cancel`, { expectedVersion })
    );
  },
  async getAllRequests(
    query: Partial<GuestPlayListQuery>
  ): Promise<GuestPlayListResponse> {
    return data(await apiClient.get('/guest-play', { params: query }));
  },
  async getStats(): Promise<GuestPlayStatsResponse> {
    return data(await apiClient.get('/guest-play/stats'));
  },
  async getRequestById(id: string): Promise<GuestPlayAdminResponse> {
    return data(await apiClient.get(`/guest-play/${id}`));
  },
  async decide(
    id: string,
    command: GuestPlayDecisionCommand
  ): Promise<GuestPlayAdminResponse> {
    return data(await apiClient.post(`/guest-play/${id}/decision`, command));
  },
  async correct(
    id: string,
    command: GuestPlayCorrectionCommand
  ): Promise<GuestPlayAdminResponse> {
    return data(await apiClient.post(`/guest-play/${id}/correction`, command));
  },
  async archive(
    id: string,
    expectedVersion: number
  ): Promise<GuestPlayAdminResponse> {
    return data(
      await apiClient.post(`/guest-play/${id}/archive`, { expectedVersion })
    );
  },
  async restore(
    id: string,
    expectedVersion: number
  ): Promise<GuestPlayAdminResponse> {
    return data(
      await apiClient.post(`/guest-play/${id}/restore`, { expectedVersion })
    );
  },
  async retryNotification(
    id: string,
    notification: GuestPlayNotificationKind,
    expectedVersion: number
  ): Promise<GuestPlayAdminResponse> {
    return data(
      await apiClient.post(`/guest-play/${id}/notifications/retry`, {
        notification,
        expectedVersion,
      })
    );
  },
};
