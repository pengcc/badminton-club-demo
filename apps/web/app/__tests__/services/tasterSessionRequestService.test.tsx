import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  list: vi.fn(),
  disposition: vi.fn(),
  preferenceOptions: vi.fn(),
}));

vi.mock('../../lib/api/tasterSessionRequestApi', () => ({
  tasterSessionRequestApi: {
    list: api.list,
    disposition: api.disposition,
    preferenceOptions: api.preferenceOptions,
    create: vi.fn(),
    stats: vi.fn(),
    archive: vi.fn(),
    retryDelivery: vi.fn(),
  },
}));

import { TasterSessionRequestService } from '../../services/tasterSessionRequestService';

function wrapper(queryClient: QueryClient) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('Taster Session Query boundary', () => {
  beforeEach(() => {
    api.list.mockReset();
    api.disposition.mockReset();
    api.preferenceOptions.mockReset();
  });

  it('includes visitor level and locale in the preference-option key and request', async () => {
    api.preferenceOptions.mockResolvedValue([]);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(
      () => TasterSessionRequestService.usePreferenceOptions('beginner', 'zh'),
      { wrapper: wrapper(client) }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.preferenceOptions).toHaveBeenCalledWith('beginner', 'zh');
    expect(
      client.getQueryData([
        'tasterSessionRequests',
        'preferenceOptions',
        'beginner',
        'zh',
      ])
    ).toEqual([]);
  });

  it('includes every server filter in the list key', async () => {
    api.list.mockResolvedValue({
      requests: [],
      total: 0,
      limit: 20,
      offset: 5,
    });
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const query = {
      status: 'pending',
      playerLevel: 'beginner',
      archived: 'include',
      limit: 20,
      offset: 5,
    } as const;
    const { result } = renderHook(
      () => TasterSessionRequestService.useList(query),
      { wrapper: wrapper(client) }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(
      client.getQueryData(['tasterSessionRequests', 'list', query])
    ).toEqual({ requests: [], total: 0, limit: 20, offset: 5 });
  });

  it('sends a versioned terminal command and refreshes the capability family', async () => {
    api.disposition.mockResolvedValue({ id: 'request', status: 'invited' });
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(
      () => TasterSessionRequestService.useDisposition(),
      { wrapper: wrapper(client) }
    );
    const command = {
      expectedVersion: 3,
      disposition: 'invited' as const,
      sendEmail: true,
    };
    await act(() => result.current.mutateAsync({ id: 'request', command }));
    expect(api.disposition).toHaveBeenCalledWith('request', command);
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['tasterSessionRequests'],
    });
  });

  it('refreshes the capability family after a stale command conflict', async () => {
    api.disposition.mockRejectedValue(
      Object.assign(new Error('conflict'), {
        response: {
          status: 409,
          data: { code: 'TASTER_SESSION_STATE_CONFLICT' },
        },
      })
    );
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(
      () => TasterSessionRequestService.useDisposition(),
      { wrapper: wrapper(client) }
    );

    await expect(
      act(() =>
        result.current.mutateAsync({
          id: 'request',
          command: {
            expectedVersion: 3,
            disposition: 'invited',
            sendEmail: true,
          },
        })
      )
    ).rejects.toThrow('conflict');
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['tasterSessionRequests'],
    });
  });
});
