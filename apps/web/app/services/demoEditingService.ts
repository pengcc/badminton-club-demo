'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as demoEditingApi from '@app/lib/api/demoEditingApi';

export const demoEditingKey = ['demo-editing', 'status'] as const;

function invalidateDemoViews(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: ['announcements'] });
  void queryClient.invalidateQueries({ queryKey: ['matches'] });
}

export class DemoEditingService {
  static useStatus(enabled = true) {
    return useQuery({
      queryKey: demoEditingKey,
      queryFn: demoEditingApi.getDemoEditingStatus,
      enabled,
      staleTime: 15_000,
      retry: false,
      refetchInterval: (query) =>
        query.state.data?.mode === 'active' ? 15_000 : false,
    });
  }

  static useStart() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: demoEditingApi.startDemoEditing,
      onSuccess: (status) => {
        queryClient.setQueryData(demoEditingKey, status);
        invalidateDemoViews(queryClient);
      },
    });
  }

  static useFinish() {
    const queryClient = useQueryClient();
    return useMutation({
      mutationFn: demoEditingApi.finishDemoEditing,
      onSuccess: (status) => {
        queryClient.setQueryData(demoEditingKey, status);
        invalidateDemoViews(queryClient);
      },
    });
  }
}
