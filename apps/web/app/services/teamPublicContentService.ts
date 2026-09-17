import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TeamPublicContentValues } from '@club/shared-types/api/teamPublicContent';
import { settingsApi } from '@app/lib/api/settingsApi';

export const teamPublicContentKey = [
  'team-public-content',
  'administration',
] as const;

export const TeamPublicContentService = {
  useContent() {
    return useQuery({
      queryKey: teamPublicContentKey,
      queryFn: async () => (await settingsApi.getTeamPublicContent()).data,
    });
  },

  useUpdateContent() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: async (content: TeamPublicContentValues) =>
        (await settingsApi.updateTeamPublicContent(content)).data,
      onSuccess: (data) => queryClient.setQueryData(teamPublicContentKey, data),
    });
  },
};
