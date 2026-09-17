import React from 'react';
import { getMessages, getTranslations } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import DashboardLayout from '@app/components/Dashboard/DashboardLayout';
import { SessionUnavailable } from '@app/components/Dashboard/SessionUnavailable';
import { getServerSession } from '@app/lib/auth/getServerSessionUser';
import {
  CLIENT_MESSAGE_NAMESPACES,
  selectClientMessages,
} from '@app/lib/clientMessages';
import { redirect } from 'next/navigation';
import { ProtectedAuthProvider } from '@app/hooks/useAuth';

interface DashboardLayoutPageProps {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}

export default async function DashboardLayoutPage({
  children,
  params,
}: DashboardLayoutPageProps) {
  const { lang } = await params;
  const verification = await getServerSession();
  if (verification.kind === 'unauthenticated') {
    redirect(`/${lang}/login`);
  }
  if (verification.kind === 'unavailable') {
    const t = await getTranslations({
      locale: lang,
      namespace: 'dashboard.shell',
    });
    return (
      <SessionUnavailable
        title={t('sessionUnavailableTitle')}
        description={t('sessionUnavailableDescription')}
        retryLabel={t('retrySession')}
      />
    );
  }
  const messages = await getMessages();

  return (
    <NextIntlClientProvider
      messages={selectClientMessages(
        messages,
        CLIENT_MESSAGE_NAMESPACES.dashboard
      )}
    >
      <ProtectedAuthProvider initialUser={verification.user}>
        <DashboardLayout lang={lang}>{children}</DashboardLayout>
      </ProtectedAuthProvider>
    </NextIntlClientProvider>
  );
}

export const metadata = {
  title: 'Dashboard - Badminton Club Demo',
  description: 'Portfolio demo dashboard with synthetic club data',
};
