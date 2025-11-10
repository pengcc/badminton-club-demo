import LoginForm from '@app/components/Login/LoginClient';
import Header from '@app/components/Header';
import { setRequestLocale } from 'next-intl/server';

export default async function LoginPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;

  // Enable static rendering
  setRequestLocale(lang);

  return (
      <div className="container mx-auto px-4 py-10">
        <Header lang={lang} />
        <LoginForm />
      </div>
  );
}




