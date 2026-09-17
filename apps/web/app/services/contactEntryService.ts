import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@app/lib/api/contactEntryApi';
import type { ContactEntryRequest } from '@app/lib/api/contactEntryApi';

const contactEntriesKey = ['contact-entries'] as const;

export const ContactEntryService = {
  useEntries() {
    return useQuery({
      queryKey: [...contactEntriesKey, 'administration'],
      queryFn: api.getAdminContactEntries,
    });
  },
  useCreate() {
    const client = useQueryClient();
    return useMutation({
      mutationFn: api.createContactEntry,
      onSuccess: () =>
        client.invalidateQueries({ queryKey: contactEntriesKey }),
    });
  },
  useUpdate() {
    const client = useQueryClient();
    return useMutation({
      mutationFn: ({
        id,
        request,
      }: {
        id: string;
        request: ContactEntryRequest;
      }) => api.updateContactEntry(id, request),
      onSuccess: () =>
        client.invalidateQueries({ queryKey: contactEntriesKey }),
    });
  },
  useDelete() {
    const client = useQueryClient();
    return useMutation({
      mutationFn: api.deleteContactEntry,
      onSuccess: () =>
        client.invalidateQueries({ queryKey: contactEntriesKey }),
    });
  },
};
