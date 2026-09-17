import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { getDemoRuntimeStatus } from '@app/lib/data/getDemoRuntimeStatus';
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import Header from '@app/components/Header';
import MembershipApplicantEmailEntry from '@app/components/MembershipApplicantEmailEntry';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ApplicationAccessPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  setRequestLocale(lang);
  await connection();
  if ((await getDemoRuntimeStatus()) !== 'disabled') {
    redirect(`/${lang}/membership`);
  }
  return (
    <div className="container mx-auto px-4 py-8 sm:py-12">
      <Header intent="focused" lang={lang} />
      <main className="mx-auto max-w-4xl pt-8">
        <MembershipApplicantEmailEntry mode="access" />
      </main>
    </div>
  );
}
