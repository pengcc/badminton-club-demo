/**
 * Local Mode Dashboard Page
 * Client-only dashboard without SSR auth
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStorage } from '@app/lib/storage';
import { AuthService } from '@app/services/authService';
import DashboardLayout from '@app/components/Dashboard/DashboardLayout';

export default function LocalDashboardPage() {
  const router = useRouter();
  const { mode } = useStorage();
  const { data: user, isLoading } = AuthService.useSession(null);

  // Redirect to regular dashboard if not in local mode
  useEffect(() => {
    if (!isLoading && mode === 'server') {
      router.push('/en/dashboard');
    }
  }, [mode, isLoading, router]);

  // Redirect to login if no user
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/en/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout initialUser={user} lang="en">
      <div className="space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h2 className="text-lg font-semibold text-green-900">✓ Local Mode Active</h2>
          <p className="text-sm text-green-700 mt-1">
            Welcome! You're running in local mode with IndexedDB storage. All data is stored in your browser.
          </p>
        </div>
        <div>
          <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
          <p className="text-gray-600">
            Navigate using the sidebar to manage users, matches, teams, and players.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
