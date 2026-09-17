import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { HomepageContentValues } from '@club/shared-types/api/homepageContent';
import * as contentApi from '@app/lib/api/contentApi';

const homepageContentKey = ['homepage-content', 'administration'] as const;

export const HomepageContentService = {
  useContent() {
    return useQuery({
      queryKey: homepageContentKey,
      queryFn: contentApi.getHomepageContentAdministration,
    });
  },

  useUpdateContent() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (content: HomepageContentValues) =>
        contentApi.updateHomepageContent(content),
      onSuccess: (data) => {
        queryClient.setQueryData(homepageContentKey, data);
      },
    });
  },
};
