import type { Metadata } from 'next';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import Header from '@app/components/Header';
import PasswordSetupClient from '@app/components/Login/PasswordSetupClient';
import { Suspense } from 'react';
import {
  CLIENT_MESSAGE_NAMESPACES,
  selectClientMessages,
} from '@app/lib/clientMessages';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function SetPasswordPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  setRequestLocale(lang);
  const messages = await getMessages();
  return (
    <NextIntlClientProvider
      messages={selectClientMessages(
        messages,
        CLIENT_MESSAGE_NAMESPACES.passwordSetup
      )}
    >
      <div className="container mx-auto px-4 py-10">
        <Header intent="focused" lang={lang} showLanguageSwitcher={false} />
        <Suspense
          fallback={
            <div
              aria-busy="true"
              className="mx-auto h-64 max-w-md animate-pulse rounded-lg bg-muted"
            />
          }
        >
          <PasswordSetupClient />
        </Suspense>
      </div>
    </NextIntlClientProvider>
  );
}
