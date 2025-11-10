'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@app/hooks/useAuth';

export default function DashboardPage() {
  const router = useRouter();
  const { lang } = useParams();
  const { user, isLoading } = useAuth();

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!isLoading && user) {
      // Redirect to appropriate default page based on role
      const defaultPath = isAdmin ? `/${lang}/dashboard/members` : `/${lang}/dashboard/matches`;
      router.replace(defaultPath);
    } else if (!isLoading && !user) {
      router.replace(`/${lang}/login`);
    }
  }, [user, isLoading, router, lang, isAdmin]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    </div>
  );
}