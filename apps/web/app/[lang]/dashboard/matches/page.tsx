'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { DashboardLoading, DashboardErrorBoundary } from '@app/components/Dashboard/DashboardComponents';

// Lazy load the MatchCenter component
const MatchCenter = dynamic(() => import('@app/components/Dashboard/MatchCenter'), {
  loading: () => <DashboardLoading message="Loading match center..." />,
  ssr: false
});

export default function MatchesPage() {
  return (
    <DashboardErrorBoundary>
      <Suspense fallback={<DashboardLoading message="Loading match center..." />}>
        <MatchCenter />
      </Suspense>
    </DashboardErrorBoundary>
  );
}