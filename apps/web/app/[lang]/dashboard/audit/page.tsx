'use client';

import dynamic from 'next/dynamic';
import { Suspense } from 'react';
import {
  DashboardLoading,
  DashboardErrorBoundary,
} from '@app/components/Dashboard/DashboardComponents';

// Lazy load the AuditLogCenter component
const AuditLogCenter = dynamic(
  () => import('@app/components/Dashboard/AuditLogCenter'),
  {
    loading: () => <DashboardLoading />,
    ssr: false,
  }
);

export default function AuditPage() {
  return (
    <DashboardErrorBoundary>
      <Suspense fallback={<DashboardLoading />}>
        <AuditLogCenter />
      </Suspense>
    </DashboardErrorBoundary>
  );
}
