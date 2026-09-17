import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClubInformationValues } from '@club/shared-types/api/clubInformation';
import * as api from '@app/lib/api/clubInformationApi';

const clubInformationKey = ['club-information', 'administration'] as const;

export const ClubInformationService = {
  useContent() {
    return useQuery({
      queryKey: clubInformationKey,
      queryFn: api.getClubInformationAdministration,
    });
  },

  useUpdateContent() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: (content: ClubInformationValues) =>
        api.updateClubInformation(content),
      onSuccess: (data) => queryClient.setQueryData(clubInformationKey, data),
    });
  },
};
