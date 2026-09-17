'use client';

import { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import { AuthService } from '@app/services/authService';
import { isSessionInvalidError } from '@app/lib/api/client';
import type { Api } from '@club/shared-types/api/auth';
import {
  navigateToDocument,
  reloadCurrentDocument,
} from '@app/lib/navigation/documentNavigation';

interface AuthContextType {
  user: Api.User;
  sessionRefreshFailed: boolean;
  retrySession: () => Promise<unknown>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function ProtectedAuthProvider({
  children,
  initialUser,
}: {
  children: ReactNode;
  initialUser: Api.User;
}) {
  const params = useParams();
  const lang = (params?.lang as string) || 'en';
  const sessionQuery = AuthService.useSession(initialUser);
  const logoutMutation = AuthService.useLogout();

  useEffect(() => {
    if (
      !sessionQuery.isBootstrapPending &&
      sessionQuery.isError &&
      isSessionInvalidError(sessionQuery.error)
    ) {
      reloadCurrentDocument();
    }
  }, [
    sessionQuery.error,
    sessionQuery.isBootstrapPending,
    sessionQuery.isError,
  ]);

  const logout = async () => {
    await logoutMutation.mutateAsync();
    navigateToDocument(`/${lang}/login`);
  };

  return (
    <AuthContext.Provider
      value={{
        user: sessionQuery.data ?? initialUser,
        sessionRefreshFailed:
          !sessionQuery.isBootstrapPending && sessionQuery.isRefetchError,
        retrySession: sessionQuery.refetch,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within a ProtectedAuthProvider');
  }
  return context;
}

/** Optional access for reusable dashboard content that also renders in isolation. */
export function useOptionalAuth() {
  return useContext(AuthContext);
}
