/**
 * Local Dashboard Matches Page
 * Client-side only, uses LocalAdapter
 */

'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { DashboardLoading, DashboardErrorBoundary } from '@app/components/Dashboard/DashboardComponents';

const MatchCenter = dynamic(() => import('@app/components/Dashboard/MatchCenter'), {
  loading: () => <DashboardLoading message="Loading match center..." />,
  ssr: false
});

export default function LocalMatchesPage() {
  return (
    <DashboardErrorBoundary>
      <Suspense fallback={<DashboardLoading message="Loading match center..." />}>
        <MatchCenter />
      </Suspense>
    </DashboardErrorBoundary>
  );
}
