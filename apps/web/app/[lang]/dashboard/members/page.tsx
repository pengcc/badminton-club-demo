'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import {
  DashboardLoading,
  DashboardErrorBoundary,
} from '@app/components/Dashboard/DashboardComponents';

// Lazy load the MemberCenter component
const MemberCenter = dynamic(
  () => import('@app/components/Dashboard/MemberCenter'),
  {
    loading: () => <DashboardLoading />,
    ssr: false,
  }
);

export default function MembersPage() {
  return (
    <DashboardErrorBoundary>
      <Suspense fallback={<DashboardLoading />}>
        <MemberCenter />
      </Suspense>
    </DashboardErrorBoundary>
  );
}
