import React from 'react';
import DashboardLayout from '@app/components/Dashboard/DashboardLayout';

interface DashboardLayoutPageProps {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}

export default async function DashboardLayoutPage({ children, params }: DashboardLayoutPageProps) {
  const { lang } = await params;

  // No SSR user fetch - let client-side handle authentication
  // This prevents blocking page render on Render API cold starts
  return (
    <DashboardLayout lang={lang} initialUser={null}>
      {children}
    </DashboardLayout>
  );
}

export const metadata = {
  title: 'Dashboard - DCBEV',
  description: 'Member dashboard for German-Chinese Badminton Club',
};