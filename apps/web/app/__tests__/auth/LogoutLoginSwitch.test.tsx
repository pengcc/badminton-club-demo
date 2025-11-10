import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react';
import { AuthService } from '@app/services/authService';
import { TokenManager } from '@app/lib/auth/tokenManager';

// Mock authApi module
jest.mock('@app/lib/api/authApi', () => ({
  login: jest.fn(),
  verifyToken: jest.fn(),
  logout: jest.fn(),
}));

import * as authApi from '@app/lib/api/authApi';

// Simple in-memory token storage mock
jest.spyOn(TokenManager, 'setToken').mockImplementation((token: string) => {
  (TokenManager as any)._token = token;
});
jest.spyOn(TokenManager, 'getToken').mockImplementation(() => (TokenManager as any)._token || null);
jest.spyOn(TokenManager, 'clearToken').mockImplementation(() => {
  (TokenManager as any)._token = null;
});
jest.spyOn(TokenManager, 'isTokenExpired').mockImplementation(() => false);

const userA = { id: 'uA', fullName: 'User A', role: 'admin' } as any;
const userB = { id: 'uB', fullName: 'User B', role: 'member' } as any;

// Setup mock implementations
beforeEach(() => {
  (authApi.login as jest.Mock).mockImplementation(async (credentials: any) => {
    if (credentials.email.includes('userA')) {
      return { token: 'tokenA', user: userA };
    }
    return { token: 'tokenB', user: userB };
  });

  (authApi.verifyToken as jest.Mock).mockImplementation(async () => {
    const t = TokenManager.getToken();
    if (t === 'tokenA') return userA;
    if (t === 'tokenB') return userB;
    return null;
  });

  (authApi.logout as jest.Mock).mockResolvedValue(undefined);
});

function createWrapper() {
  const queryClient = new QueryClient();
  return {
    queryClient,
    wrapper: ({ children }: any) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

describe('AuthService logout/login user switch', () => {
  it('clears previous user and sets new user after switching accounts', async () => {
    const { queryClient, wrapper } = createWrapper();

    // Initial session should be undefined (no token, query disabled)
    const { result: session1 } = renderHook(() => AuthService.useSession(), { wrapper });
    expect(session1.current.data).toBeUndefined();

    // Login as user A
    const { result: loginA } = renderHook(() => AuthService.useLogin(), { wrapper });
    await act(async () => {
      await loginA.current.mutateAsync({ email: 'userA@example.com', password: 'x' } as any);
    });
    expect(queryClient.getQueryData(['auth', 'session'])).toEqual(userA);

    // Logout
    const { result: logoutHook } = renderHook(() => AuthService.useLogout(), { wrapper });
    await act(async () => {
      await logoutHook.current.mutateAsync();
    });
    expect(TokenManager.getToken()).toBeNull();
    expect(queryClient.getQueryData(['auth', 'session'])).toBeUndefined(); // removed

    // Login as user B
    const { result: loginB } = renderHook(() => AuthService.useLogin(), { wrapper });
    await act(async () => {
      await loginB.current.mutateAsync({ email: 'userB@example.com', password: 'x' } as any);
    });
    const sessionData = queryClient.getQueryData(['auth', 'session']);
    expect(sessionData).toEqual(userB);
    expect(sessionData).not.toEqual(userA);
  });
});
