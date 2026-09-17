import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RecruitmentPublicContentValues } from '@club/shared-types/api/recruitmentPublicContent';
import * as api from '@app/lib/api/recruitmentPublicContentApi';

const key = ['recruitment-public-content', 'administration'] as const;

export const RecruitmentPublicContentService = {
  useContent() {
    return useQuery({
      queryKey: key,
      queryFn: api.getRecruitmentPublicContentAdministration,
    });
  },
  useUpdateContent() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (content: RecruitmentPublicContentValues) =>
        api.updateRecruitmentPublicContent(content),
      onSuccess: (data) => queryClient.setQueryData(key, data),
    });
  },
};
