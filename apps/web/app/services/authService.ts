/**
 * AuthService - Service Layer for Authentication
 *
 * Provides React Query hooks for all auth operations with
 * automatic caching, optimistic updates, and state management.
 */

'use client';

import { useEffect } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useStorage } from '@app/lib/storage';
import { TokenManager } from '@app/lib/auth/tokenManager';
import type { Api } from '@club/shared-types/api/auth';

const SESSION_KEY = ['auth', 'session'];

export class AuthService {
  /**
   * Get current authenticated user session
   *
   * Cached for 5 minutes, automatically refetches on window focus
   * @param initialData - Optional initial user data from server-side fetch
   */
  static useSession(initialData?: Api.User | null): UseQueryResult<Api.User | null, Error> {
    const { adapter } = useStorage();
    const queryClient = useQueryClient();

    // If we have server-provided initial data AND there's NO token in storage,
    // set it in cache. This prevents overwriting valid local/server auth.
    useEffect(() => {
      const token = TokenManager.getToken();
      // Only seed cache with initialData if there's no token and we have actual user data
      if (initialData !== undefined && !token && initialData !== null) {
        queryClient.setQueryData(SESSION_KEY, initialData);
      }
    }, [initialData, queryClient]);

    return useQuery({
      queryKey: SESSION_KEY,
      queryFn: async () => {
        if (!adapter) return null;

        const token = TokenManager.getToken();
        if (!token) return null;

        // Check if token is expired
        if (TokenManager.isTokenExpired(token)) {
          TokenManager.clearToken();
          return null;
        }

        // Verify token with backend
        try {
          const user = await adapter.verifyToken();
          return user;
        } catch (_error) {
          // Token invalid, clear it
          TokenManager.clearToken();
          return null;
        }
      },
      enabled: !!adapter,
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: false,
    });
  }

  /**
   * Login mutation
   *
   * On success, stores token and updates session cache
   */
  static useLogin(): UseMutationResult<
    Api.LoginResponse,
    Error,
    Api.LoginRequest
  > {
    const { adapter } = useStorage();
    const queryClient = useQueryClient();

    return useMutation({
      mutationKey: ['auth', 'login'],
      mutationFn: async (credentials: Api.LoginRequest) => {
        if (!adapter) {
          throw new Error('Storage adapter not available');
        }
        return await adapter.login(credentials);
      },
      onSuccess: async (data) => {
        // Store token in both cookies and localStorage
        TokenManager.setToken(data.token, (data as any).refreshToken);

        // Update cache with user data immediately
        // DO NOT invalidate - cache should persist during navigation
        queryClient.setQueryData(SESSION_KEY, data.user);
      },
      onError: () => {
        // Clear any stale tokens on login error
        TokenManager.clearToken();
      },
    });
  }

  /**
   * Logout mutation
   *
   * Clears tokens and all cached data
   */
  static useLogout(): UseMutationResult<void, Error, void> {
    const { adapter } = useStorage();
    const queryClient = useQueryClient();

    return useMutation({
      mutationKey: ['auth', 'logout'],
      mutationFn: async () => {
        if (!adapter) throw new Error('Storage adapter not available');
        // Call backend logout endpoint
        await adapter.logout();
      },
      onSuccess: async () => {
        // Clear tokens first
        TokenManager.clearToken();

        // Proactively null out session query to prevent disabled query retaining stale user
        // removeQueries ensures query is fully removed, not just marked stale
        await queryClient.setQueryData(SESSION_KEY, null);
        queryClient.removeQueries({ queryKey: SESSION_KEY });

        // Clear remaining queries (user-specific data like matches, teams, etc.)
        queryClient.clear();
      },
      onError: async () => {
        // Even if backend fails, clear client-side tokens & session cache
        TokenManager.clearToken();
        await queryClient.setQueryData(SESSION_KEY, null);
        queryClient.removeQueries({ queryKey: SESSION_KEY });
        queryClient.clear();
      },
    });
  }

  /**
   * Change password mutation (Server mode only)
   */
  static useChangePassword(): UseMutationResult<
    void,
    Error,
    Api.ChangePasswordRequest
  > {
    return useMutation({
      mutationKey: ['auth', 'changePassword'],
      mutationFn: async (data: Api.ChangePasswordRequest) => {
        const authApi = await import('@app/lib/api/authApi');
        return await authApi.changePassword(data);
      },
    });
  }

  /**
   * Refresh token mutation (Server mode only)
   *
   * Updates access token using refresh token
   */
  static useRefreshToken(): UseMutationResult<
    Api.LoginResponse,
    Error,
    void
  > {
    return useMutation({
      mutationKey: ['auth', 'refresh'],
      mutationFn: async () => {
        const refreshToken = TokenManager.getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }
        const authApi = await import('@app/lib/api/authApi');
        return await authApi.refreshToken(refreshToken);
      },
      onSuccess: (data) => {
        // Update tokens
        TokenManager.setToken(data.token, data.refreshToken);
      },
    });
  }
}
