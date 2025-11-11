/**
 * Local Dashboard Wrapper
 * Client-side wrapper for local mode dashboard
 * Handles authentication check and layout
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { AuthService } from '@app/services/authService';
import { TokenManager } from '@app/lib/auth/tokenManager';
import DashboardLayout from './DashboardLayout';

interface LocalDashboardWrapperProps {
  children: React.ReactNode;
}

export function LocalDashboardWrapper({ children }: LocalDashboardWrapperProps) {
  const router = useRouter();
  const params = useParams();
  const lang = (params?.lang as string) || 'en';
  const { data: user, isLoading } = AuthService.useSession(null);

  useEffect(() => {
    // Check if user is authenticated
    const token = TokenManager.getToken();

    if (!isLoading && !user && !token) {
      // No user and no token - redirect to login
      router.push(`/${lang}/login`);
    }
  }, [user, isLoading, router, lang]);

  // Show loading while checking auth
  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Render dashboard with layout
  return (
    <DashboardLayout initialUser={user} lang={lang}>
      {children}
    </DashboardLayout>
  );
}
