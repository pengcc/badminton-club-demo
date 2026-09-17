export const notificationRecipientTypes = [
  'applicationAlerts',
  'tasterSessionAlerts',
  'guestPlayAlerts',
] as const;

export type NotificationRecipientType =
  (typeof notificationRecipientTypes)[number];

export type NotificationRecipientSettings = Record<
  NotificationRecipientType,
  string[]
>;

export interface NotificationRecipientUpdateRequest {
  emails: string[];
}

export interface NotificationRecipientSettingsResponse {
  data: NotificationRecipientSettings;
}
