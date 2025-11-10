import AuthWrapper from '@app/components/AuthWrapper';
import QueryProvider from '@app/providers/QueryProvider';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import '@app/globals.css';

const languages = ['de', 'en', 'zh'];

export async function generateStaticParams() {
  return languages.map((lang) => ({ lang }));
}

interface RootLayoutProps {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}

export default async function RootLayout({ children, params }: RootLayoutProps) {
  const { lang } = await params;

  // Validate language parameter
  if (!languages.includes(lang)) {
    notFound();
  }

  // Enable static rendering
  setRequestLocale(lang);

  // Load messages for the locale
  const messages = await getMessages();

  return (
    <html lang={lang}>
      <body>
        <QueryProvider>
          <NextIntlClientProvider messages={messages}>
            <AuthWrapper>
              {children}
            </AuthWrapper>
          </NextIntlClientProvider>
        </QueryProvider>
      </body>
    </html>
  );
}