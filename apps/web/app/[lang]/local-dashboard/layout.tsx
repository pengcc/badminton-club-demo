/**
 * Local Mode Dashboard Layout
 * Simpler layout without SSR auth checks
 * Uses only client-side authentication
 */

import type { Metadata } from 'next';
import { LocalDashboardWrapper } from '@app/components/Dashboard/LocalDashboardWrapper';

export const metadata: Metadata = {
  title: 'Dashboard - Local Mode',
  description: 'Badminton Club Management Dashboard (Local Mode)',
};

export default function LocalDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <LocalDashboardWrapper>
      {children}
    </LocalDashboardWrapper>
  );
}
