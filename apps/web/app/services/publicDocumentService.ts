import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@app/lib/api/publicDocumentApi';

const key = ['public-documents', 'administration'] as const;

function useInvalidatingMutation<Variables, Result>(
  mutationFn: (variables: Variables) => Promise<Result>
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => client.invalidateQueries({ queryKey: key }),
  });
}

export const PublicDocumentService = {
  useDocuments() {
    return useQuery({ queryKey: key, queryFn: api.getAdminPublicDocuments });
  },
  useCreate() {
    return useInvalidatingMutation(api.createPublicDocument);
  },
  useUpdate() {
    return useInvalidatingMutation(
      ({
        id,
        request,
      }: {
        id: string;
        request: api.PublicDocumentUpdateRequest;
      }) => api.updatePublicDocument(id, request)
    );
  },
  useReorder() {
    return useInvalidatingMutation(api.reorderPublicDocuments);
  },
  useDelete() {
    return useInvalidatingMutation(api.deletePublicDocument);
  },
};
