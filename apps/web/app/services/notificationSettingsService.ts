import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  NotificationRecipientSettings,
  NotificationRecipientType,
} from '@club/shared-types/api/notificationSettings';
import { settingsApi } from '@app/lib/api/settingsApi';

export const notificationRecipientsQueryKey = [
  'settings',
  'notification-recipients',
] as const;

export const NotificationSettingsService = {
  useNotificationRecipients() {
    return useQuery({
      queryKey: notificationRecipientsQueryKey,
      queryFn: settingsApi.getNotificationRecipients,
    });
  },

  useUpdateNotificationRecipients() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: (variables: {
        type: NotificationRecipientType;
        emails: string[];
      }) =>
        settingsApi.updateNotificationRecipients(
          variables.type,
          variables.emails
        ),
      onSuccess: (data: NotificationRecipientSettings) => {
        queryClient.setQueryData(notificationRecipientsQueryKey, data);
      },
    });
  },
};
