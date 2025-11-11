import LoginForm from '@app/components/Login/LoginClient';
import Header from '@app/components/Header';
import { DemoCredentialsBanner } from '@app/components/Login/DemoCredentialsBanner';
import { StorageModeBannerWrapper } from '@app/components/Storage';
import { setRequestLocale } from 'next-intl/server';
import React from 'react';

export default async function LoginPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;

  // Enable static rendering
  setRequestLocale(lang);

  return (
    <div className="container mx-auto px-4 py-10">
      <Header lang={lang} />
      <div className="mb-6">
        <StorageModeBannerWrapper />
      </div>
      <DemoCredentialsBanner />
      <LoginForm />
    </div>
  );
}




