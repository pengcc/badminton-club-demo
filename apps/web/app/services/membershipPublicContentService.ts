import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MembershipPublicContentValues } from '@club/shared-types/api/membershipPublicContent';
import * as api from '@app/lib/api/membershipPublicContentApi';

const key = ['membership-public-content', 'administration'] as const;

export const MembershipPublicContentService = {
  useContent() {
    return useQuery({
      queryKey: key,
      queryFn: api.getMembershipPublicContentAdministration,
    });
  },
  useUpdateContent() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (content: MembershipPublicContentValues) =>
        api.updateMembershipPublicContent(content),
      onSuccess: (data) => queryClient.setQueryData(key, data),
    });
  },
};
