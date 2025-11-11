/**
 * Local Dashboard Members Page
 * Client-side only, uses LocalAdapter
 */

'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import { DashboardLoading, DashboardErrorBoundary } from '@app/components/Dashboard/DashboardComponents';

const MemberCenter = dynamic(() => import('@app/components/Dashboard/MemberCenter'), {
  loading: () => <DashboardLoading message="Loading member center..." />,
  ssr: false
});

export default function LocalMembersPage() {
  return (
    <DashboardErrorBoundary>
      <Suspense fallback={<DashboardLoading message="Loading member center..." />}>
        <MemberCenter />
      </Suspense>
    </DashboardErrorBoundary>
  );
}
