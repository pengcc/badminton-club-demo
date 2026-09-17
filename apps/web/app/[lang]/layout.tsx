import type { Metadata } from 'next';
import QueryProvider from '@app/providers/QueryProvider';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Toaster } from '@app/components/ui/toaster';
import {
  CLIENT_MESSAGE_NAMESPACES,
  selectClientMessages,
} from '@app/lib/clientMessages';
import {
  CONTENT_LANGUAGES,
  isContentLanguage,
} from '@club/shared-types/api/localizedContent';
import '@app/globals.css';

export const metadata: Metadata = {
  title: 'Badminton Club Demo',
  icons: { icon: '/images/badminton-favicon-64.png' },
  robots: { index: false },
};

export async function generateStaticParams() {
  return CONTENT_LANGUAGES.map((lang) => ({ lang }));
}

interface RootLayoutProps {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}

export default async function RootLayout({
  children,
  params,
}: RootLayoutProps) {
  const { lang } = await params;

  if (!isContentLanguage(lang)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(lang);

  // Load messages for the locale
  const messages = await getMessages();

  return (
    <html lang={lang} data-scroll-behavior="smooth">
      <body>
        <QueryProvider>
          <NextIntlClientProvider
            messages={selectClientMessages(
              messages,
              CLIENT_MESSAGE_NAMESPACES.public
            )}
          >
            {children}
          </NextIntlClientProvider>
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
