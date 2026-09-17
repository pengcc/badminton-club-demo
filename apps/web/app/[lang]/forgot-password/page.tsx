import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { getDemoRuntimeStatus } from '@app/lib/data/getDemoRuntimeStatus';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import Header from '@app/components/Header';
import PasswordRecoveryRequestClient from '@app/components/Login/PasswordRecoveryRequestClient';
import {
  CLIENT_MESSAGE_NAMESPACES,
  selectClientMessages,
} from '@app/lib/clientMessages';

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  setRequestLocale(lang);
  await connection();
  if ((await getDemoRuntimeStatus()) !== 'disabled') {
    redirect(`/${lang}/login`);
  }
  const messages = await getMessages();
  return (
    <NextIntlClientProvider
      messages={selectClientMessages(
        messages,
        CLIENT_MESSAGE_NAMESPACES.passwordRecovery
      )}
    >
      <div className="container mx-auto px-4 py-10">
        <Header intent="focused" lang={lang} />
        <PasswordRecoveryRequestClient />
      </div>
    </NextIntlClientProvider>
  );
}
