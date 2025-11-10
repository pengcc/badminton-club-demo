import React from 'react';
import { cookies } from 'next/headers';
import DashboardLayout from '@app/components/Dashboard/DashboardLayout';

interface DashboardLayoutPageProps {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}

async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get('token')?.value;

  if (!token) return null;

  try {
    // Verify token with backend
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3003'}/api/auth/verify`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store', // Always fetch fresh user data
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    // Backend returns { success, user }, extract just the user
    return data.user || data;
  } catch (error) {
    return null;
  }
}

export default async function DashboardLayoutPage({
  children,
  params,
}: DashboardLayoutPageProps) {
  const { lang } = await params;
  const initialUser = await getUser();

  return (
    <DashboardLayout lang={lang} initialUser={initialUser}>
      {children}
    </DashboardLayout>
  );
}

export const metadata = {
  title: 'Dashboard - DemoClub',
  description: 'Member dashboard for Demo Badminton Club',
};
