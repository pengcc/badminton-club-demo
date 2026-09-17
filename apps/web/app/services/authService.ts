/**
 * AuthService - Service Layer for Authentication
 *
 * Provides React Query hooks for all auth operations with
 * automatic caching, optimistic updates, and state management.
 */

'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryResult,
  type UseMutationResult,
} from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import * as authApi from '@app/lib/api/authApi';
import type { Api } from '@club/shared-types/api/auth';

export const SESSION_KEY = ['auth', 'session'] as const;

export type LoginFailureKind = authApi.LoginFailureKind;
export type LoginFailure = Error & { readonly kind: LoginFailureKind };

export type ProtectedSessionQueryResult = UseQueryResult<Api.User, Error> & {
  isBootstrapPending: boolean;
};

export class AuthService {
  /**
   * Get current authenticated user session
   *
   * Cached for 5 minutes, automatically refetches on window focus
   * @param initialData - Optional initial user data from server-side fetch
   */
  static useSession(initialData: Api.User): ProtectedSessionQueryResult {
    const queryClient = useQueryClient();
    const [appliedBootstrap, setAppliedBootstrap] = useState<Api.User | null>(
      null
    );
    const query = useQuery({
      queryKey: SESSION_KEY,
      queryFn: ({ signal }) => authApi.verifySession(signal),
      initialData,
      staleTime: 5 * 60 * 1000,
      refetchOnMount: false,
      refetchOnWindowFocus: 'always',
      retry: false,
    });
    const isBootstrapPending = appliedBootstrap !== initialData;

    useEffect(() => {
      queryClient.setQueryData(SESSION_KEY, initialData);
      setAppliedBootstrap(initialData);
    }, [initialData, queryClient]);

    return {
      ...query,
      data: isBootstrapPending ? initialData : query.data,
      isBootstrapPending,
    };
  }

  /**
   * Login mutation
   *
   * On success, the server has established the cookie session.
   */
  static useLogin(): UseMutationResult<
    Api.LoginResponse,
    LoginFailure,
    Api.LoginRequest
  > {
    return useMutation({
      mutationKey: ['auth', 'login'],
      mutationFn: authApi.login,
    });
  }

  /**
   * Logout mutation
   *
   * Clears authenticated cache only after server termination succeeds.
   */
  static useLogout(): UseMutationResult<void, Error, void> {
    return useMutation({
      mutationKey: ['auth', 'logout'],
      mutationFn: authApi.logout,
    });
  }

  /**
   * Change password mutation
   */
  static useChangePassword(): UseMutationResult<
    void,
    Error,
    Api.ChangePasswordRequest
  > {
    return useMutation({
      mutationKey: ['auth', 'changePassword'],
      mutationFn: authApi.changePassword,
    });
  }
}
