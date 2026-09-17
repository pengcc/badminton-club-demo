import apiClient from './client';
import type {
  TeamPublicContentAdministrationResponse,
  TeamPublicContentValues,
} from '@club/shared-types/api/teamPublicContent';
import type {
  NotificationRecipientSettings,
  NotificationRecipientSettingsResponse,
  NotificationRecipientType,
  NotificationRecipientUpdateRequest,
} from '@club/shared-types/api/notificationSettings';

export const settingsApi = {
  /**
   * Get the bounded capability-owned administrator alert projection.
   */
  async getNotificationRecipients(): Promise<NotificationRecipientSettings> {
    const response = await apiClient.get<NotificationRecipientSettingsResponse>(
      '/settings/notifications'
    );
    return response.data.data;
  },

  /**
   * Update notification recipients
   */
  async updateNotificationRecipients(
    type: NotificationRecipientType,
    emails: string[]
  ): Promise<NotificationRecipientSettings> {
    const request: NotificationRecipientUpdateRequest = { emails };
    const response = await apiClient.put<NotificationRecipientSettingsResponse>(
      `/settings/notifications/${type}`,
      request
    );
    return response.data.data;
  },

  /**
   * Get membership configuration (public)
   */
  async getMembershipConfig(): Promise<{ data: { membershipOpen: boolean } }> {
    const response = await apiClient.get('/settings/membership');
    return response.data;
  },

  /**
   * Update membership configuration (admin)
   */
  async updateMembershipConfig(
    membershipOpen: boolean
  ): Promise<{ data: { membershipOpen: boolean } }> {
    const response = await apiClient.put('/settings/membership', {
      membershipOpen,
    });
    return response.data;
  },

  /**
   * Get team public content (admin)
   */
  async getTeamPublicContent(): Promise<{
    data: TeamPublicContentAdministrationResponse;
  }> {
    const response = await apiClient.get('/team-public-content/admin');
    return response.data;
  },

  /**
   * Update team public content (admin)
   */
  async updateTeamPublicContent(content: TeamPublicContentValues): Promise<{
    data: TeamPublicContentAdministrationResponse;
  }> {
    const response = await apiClient.put('/team-public-content/admin', {
      content,
    });
    return response.data;
  },
};
