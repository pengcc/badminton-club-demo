import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import Header from '@app/components/Header';
import MembershipApplicantAccessConsumer from '@app/components/MembershipApplicantAccessConsumer';

export const metadata: Metadata = {
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export default async function ContinueApplicationPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  setRequestLocale(lang);
  return (
    <div className="container mx-auto px-4 py-8 sm:py-12">
      <Header intent="focused" lang={lang} showLanguageSwitcher={false} />
      <main className="mx-auto max-w-4xl pt-8">
        <MembershipApplicantAccessConsumer />
      </main>
    </div>
  );
}
