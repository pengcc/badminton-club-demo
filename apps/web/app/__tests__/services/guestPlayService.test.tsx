import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ getOpportunities: vi.fn(), decide: vi.fn() }));
vi.mock('@app/lib/api/guestPlayApi', () => ({
  guestPlayApi: {
    ...api,
    getMyRequests: vi.fn(),
    createRequest: vi.fn(),
    cancelRequest: vi.fn(),
    getAllRequests: vi.fn(),
    getStats: vi.fn(),
    getRequestById: vi.fn(),
    correct: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
    retryNotification: vi.fn(),
  },
}));

import { GuestPlayService } from '@app/services/guestPlayService';

const wrapper =
  (client: QueryClient) =>
  ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

describe('Guest Play Query boundary', () => {
  beforeEach(() => {
    api.getOpportunities.mockReset();
    api.decide.mockReset();
  });

  it('keys authoritative opportunities by locale', async () => {
    api.getOpportunities.mockResolvedValue([]);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(
      () => GuestPlayService.useOpportunities('zh'),
      { wrapper: wrapper(client) }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.getOpportunities).toHaveBeenCalledWith('zh');
    expect(client.getQueryData(['guestPlay', 'opportunities', 'zh'])).toEqual(
      []
    );
  });

  it('sends a versioned named decision and refreshes the feature family', async () => {
    api.decide.mockResolvedValue({ id: 'request' });
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => GuestPlayService.useDecision(), {
      wrapper: wrapper(client),
    });
    const command = { expectedVersion: 4, decision: 'approved' as const };
    await act(() => result.current.mutateAsync({ id: 'request', command }));
    expect(api.decide).toHaveBeenCalledWith('request', command);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['guestPlay'] });
  });
});
