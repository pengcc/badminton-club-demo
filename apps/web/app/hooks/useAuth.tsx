'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { AuthService } from '@app/services/authService';
import type { Api } from '@club/shared-types/api/auth';
import { SkeletonAuthForm } from '@app/components/ui/SkeletonAuthForm';

interface AuthContextType {
  user: Api.User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: Api.LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  loginError: Error | null;
  logoutError: Error | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const lang = (params?.lang as string) || 'en';

  // Use AuthService hooks
  const { data: user, isLoading } = AuthService.useSession();
  const loginMutation = AuthService.useLogin();
  const logoutMutation = AuthService.useLogout();

  const login = async (credentials: Api.LoginRequest) => {
    await loginMutation.mutateAsync(credentials);
    router.push(`/${lang}/dashboard`);
  };

  const logout = async () => {
    await logoutMutation.mutateAsync();
    router.push(`/${lang}/login`);
  };

  const value: AuthContextType = {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    loginError: loginMutation.error,
    logoutError: logoutMutation.error,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// HOC for protecting routes
export function withAuth<T extends object>(Component: React.ComponentType<T>) {
  return function AuthenticatedComponent(props: T) {
    const { isAuthenticated, isLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const lang = (params?.lang as string) || 'en';

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <SkeletonAuthForm />
        </div>
      );
    }

    if (!isAuthenticated) {
      router.push(`/${lang}/login`);
      return null;
    }

    return <Component {...props} />;
  };
}