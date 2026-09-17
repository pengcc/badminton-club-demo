import AccountClient from '@app/components/Account/AccountClient';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import {
  CLIENT_MESSAGE_NAMESPACES,
  selectClientMessages,
} from '@app/lib/clientMessages';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getServerSession } from '@app/lib/auth/getServerSessionUser';
import { SessionUnavailable } from '@app/components/Dashboard/SessionUnavailable';
import { ProtectedAuthProvider } from '@app/hooks/useAuth';

// Prevent static generation for this page since it requires authentication
export const dynamic = 'force-dynamic';
// Ensures /account page is always fresh and server-rendered, never cached or reused.
export const revalidate = 0;

interface AccountPageProps {
  params: Promise<{
    lang: string;
  }>;
}

export default async function Account({ params }: AccountPageProps) {
  const { lang } = await params;

  // Enable static rendering
  setRequestLocale(lang);
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
  if (verification.user.demoMode) {
    redirect(`/${lang}/dashboard`);
  }
  const messages = await getMessages();

  return (
    <NextIntlClientProvider
      messages={selectClientMessages(
        messages,
        CLIENT_MESSAGE_NAMESPACES.account
      )}
    >
      <ProtectedAuthProvider initialUser={verification.user}>
        <AccountClient />
      </ProtectedAuthProvider>
    </NextIntlClientProvider>
  );
}
