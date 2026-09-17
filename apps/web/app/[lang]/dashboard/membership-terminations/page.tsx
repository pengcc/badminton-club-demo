'use client';

import MembershipTerminationCenter from '@app/components/Dashboard/MembershipTerminationCenter';
import { DashboardErrorBoundary } from '@app/components/Dashboard/DashboardComponents';

export default function MembershipTerminationsPage() {
  return (
    <DashboardErrorBoundary>
      <MembershipTerminationCenter />
    </DashboardErrorBoundary>
  );
}
