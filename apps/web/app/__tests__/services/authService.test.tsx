import type { ReactNode } from 'react';
import { AxiosError } from 'axios';
import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const authApi = vi.hoisted(() => ({
  verifySession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
}));

vi.mock('@app/lib/api/authApi', () => authApi);

import { AuthService, SESSION_KEY } from '@app/services/authService';

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function sessionInvalidError() {
  return new AxiosError('invalid', 'ERR_BAD_RESPONSE', undefined, undefined, {
    data: { code: 'SESSION_INVALID' },
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config: {} as never,
  });
}

function user(id: string) {
  return { id } as never;
}

describe('AuthService protected session projection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authApi.verifySession.mockResolvedValue(user('verified-user'));
    focusManager.setFocused(false);
  });

  afterEach(() => {
    focusManager.setFocused(undefined);
  });

  it('starts from the verified server user without an immediate duplicate request', () => {
    const initialUser = user('server-user');
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result } = renderHook(() => AuthService.useSession(initialUser), {
      wrapper: wrapper(client),
    });

    expect(result.current.data).toEqual(initialUser);
    expect(authApi.verifySession).not.toHaveBeenCalled();
  });

  it('replaces a stale shared projection with the fresh server bootstrap', async () => {
    const staleUser = user('stale-user');
    const freshUser = user('fresh-user');
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    client.setQueryData(SESSION_KEY, staleUser);

    const { result } = renderHook(() => AuthService.useSession(freshUser), {
      wrapper: wrapper(client),
    });

    expect(result.current.data).toEqual(freshUser);
    expect(authApi.verifySession).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(client.getQueryData(SESSION_KEY)).toEqual(freshUser)
    );
    expect(result.current.isBootstrapPending).toBe(false);
  });

  it('preserves the verified user when focus revalidation is unavailable', async () => {
    const initialUser = user('server-user');
    authApi.verifySession.mockRejectedValue(new Error('mongo unavailable'));
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => AuthService.useSession(initialUser), {
      wrapper: wrapper(client),
    });

    act(() => focusManager.setFocused(true));

    await waitFor(() => expect(result.current.isRefetchError).toBe(true));
    expect(result.current.data).toEqual(initialUser);
  });

  it('keeps session invalidity request-local for the protected owner to resolve', async () => {
    const initialUser = user('server-user');
    const invalid = sessionInvalidError();
    authApi.verifySession.mockRejectedValue(invalid);
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => AuthService.useSession(initialUser), {
      wrapper: wrapper(client),
    });

    act(() => focusManager.setFocused(true));

    await waitFor(() => expect(result.current.error).toBe(invalid));
    expect(result.current.data).toEqual(initialUser);
    expect(client.getQueryData(SESSION_KEY)).toEqual(initialUser);
  });

  it('uses plain credential mutations without session-cache choreography', async () => {
    const nextUser = user('next-user');
    authApi.login.mockResolvedValue({ user: nextUser });
    authApi.logout.mockResolvedValue(undefined);
    authApi.changePassword.mockResolvedValue(undefined);
    const client = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const cancelSpy = vi.spyOn(client, 'cancelQueries');
    const setSpy = vi.spyOn(client, 'setQueryData');
    const refetchSpy = vi.spyOn(client, 'refetchQueries');
    const { result } = renderHook(
      () => ({
        login: AuthService.useLogin(),
        logout: AuthService.useLogout(),
        changePassword: AuthService.useChangePassword(),
      }),
      { wrapper: wrapper(client) }
    );

    await act(async () => {
      await result.current.login.mutateAsync({
        email: 'member@example.test',
        password: 'TestPassword1!',
      });
      await result.current.logout.mutateAsync();
      await result.current.changePassword.mutateAsync({
        currentPassword: 'TestPassword1!',
        newPassword: 'TestPassword2!',
      });
    });

    expect(cancelSpy).not.toHaveBeenCalled();
    expect(setSpy).not.toHaveBeenCalled();
    expect(refetchSpy).not.toHaveBeenCalled();
  });
});
