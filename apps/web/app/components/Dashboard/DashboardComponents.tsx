'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import ErrorBoundary from '@app/components/ErrorBoundary';

// Optimized loading component
export function DashboardLoading({ message }: { message?: string }) {
  const t = useTranslations('dashboard.shell');
  return (
    <div className="flex items-center justify-center p-8 min-h-[200px]">
      <div className="text-center">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"
          aria-hidden="true"
        />
        <p className="text-muted-foreground" role="status">
          {message ?? t('loading')}
        </p>
      </div>
    </div>
  );
}

// Error boundary component
export function DashboardErrorBoundary({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return <ErrorBoundary fallback={fallback}>{children}</ErrorBoundary>;
}
