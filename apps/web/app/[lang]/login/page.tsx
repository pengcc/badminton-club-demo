import { connection } from 'next/server';
import { getDemoRuntimeStatus } from '@app/lib/data/getDemoRuntimeStatus';
import LoginForm from '@app/components/Login/LoginClient';
import Header from '@app/components/Header';
import { setRequestLocale } from 'next-intl/server';
import { getMessages } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import {
  CLIENT_MESSAGE_NAMESPACES,
  selectClientMessages,
} from '@app/lib/clientMessages';

export default async function LoginPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  setRequestLocale(lang);
  await connection();
  const [messages, demoStatus] = await Promise.all([
    getMessages(),
    getDemoRuntimeStatus(),
  ]);

  return (
    <NextIntlClientProvider
      messages={selectClientMessages(messages, CLIENT_MESSAGE_NAMESPACES.login)}
    >
      <div className="container mx-auto px-4 py-10">
        <Header intent="focused" lang={lang} showHomeLink={false} />
        <LoginForm showPasswordRecovery={demoStatus === 'disabled'} />
      </div>
    </NextIntlClientProvider>
  );
}
