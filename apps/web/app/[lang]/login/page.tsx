import LoginForm from '@app/components/Login/LoginClient';
import Header from '@app/components/Header';
import { setRequestLocale } from 'next-intl/server';
import React from 'react';

const DemoCredentialsBanner = () => {
  const show = process.env.NEXT_PUBLIC_SHOW_DEMO_HINTS === 'true';
  if (!show) return null;
  return (
    <div className="mb-6 rounded-md border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900 shadow-sm">
      <p className="font-semibold mb-1">Demo Mode</p>
      <p>Use one of these accounts to explore features:</p>
      <ul className="list-disc ml-5 mt-2 space-y-1">
        <li><span className="font-medium">Admin:</span> <code>admin@club.dev</code> / <code>admin123</code></li>
        <li><span className="font-medium">Member sample:</span> <code>lisa.schmidt53@club.dev</code> / <code>member123</code></li>
      </ul>
      <p className="mt-2 text-xs text-yellow-800">Registrations may be capped or disabled to protect the demo database.</p>
    </div>
  );
};

export default async function LoginPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;

  // Enable static rendering
  setRequestLocale(lang);

  return (
    <div className="container mx-auto px-4 py-10">
      <Header lang={lang} />
      <DemoCredentialsBanner />
      <LoginForm lang={lang} />
    </div>
  );
}




