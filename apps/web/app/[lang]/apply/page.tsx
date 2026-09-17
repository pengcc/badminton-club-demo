import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import Header from '@app/components/Header';
import ControlledMembershipApplication from '@app/components/ControlledMembershipApplication';

export const metadata: Metadata = {
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};

export default async function ApplyPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const [{ lang }, { k }] = await Promise.all([params, searchParams]);
  setRequestLocale(lang);
  const t = await getTranslations('common');

  return (
    <div className="container mx-auto px-4 py-8 sm:py-12">
      <Header intent="focused" lang={lang} />
      <main className="mx-auto max-w-4xl pt-8">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-foreground sm:text-4xl">
            {t('pages.membership')}
          </h1>
        </div>
        <ControlledMembershipApplication accessToken={k} />
      </main>
    </div>
  );
}
