import type { Metadata } from 'next';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import Header from '@app/components/Header';
import ResetPasswordClient from '@app/components/Login/ResetPasswordClient';
import {
  CLIENT_MESSAGE_NAMESPACES,
  selectClientMessages,
} from '@app/lib/clientMessages';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function ResetPasswordPage({
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
        CLIENT_MESSAGE_NAMESPACES.passwordRecovery
      )}
    >
      <div className="container mx-auto px-4 py-10">
        <Header intent="focused" lang={lang} showLanguageSwitcher={false} />
        <ResetPasswordClient />
      </div>
    </NextIntlClientProvider>
  );
}
