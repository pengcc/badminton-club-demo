import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TasterSessionPublicContentValues } from '@club/shared-types/api/tasterSessionPublicContent';
import * as api from '@app/lib/api/tasterSessionPublicContentApi';

const key = ['taster-session-public-content', 'administration'] as const;

export const TasterSessionPublicContentService = {
  useContent() {
    return useQuery({
      queryKey: key,
      queryFn: api.getTasterSessionPublicContentAdministration,
    });
  },
  useUpdateContent() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (content: TasterSessionPublicContentValues) =>
        api.updateTasterSessionPublicContent(content),
      onSuccess: (data) => queryClient.setQueryData(key, data),
    });
  },
};
