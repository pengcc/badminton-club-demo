import { getTranslations } from 'next-intl/server';
import { setRequestLocale } from 'next-intl/server';
import MembershipFormClient from '@app/components/MembershipFormClient';
import Header from '@app/components/Header';

export default async function MembershipPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;

  // Enable static rendering
  setRequestLocale(lang);

  const t = await getTranslations('common');

  return (
    <div className="container mx-auto px-4 py-8 sm:py-12">
      <Header lang={lang} />
      <div className="max-w-4xl mx-auto pt-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-4">
            {t('pages.membership')}
          </h1>
        </div>
        <MembershipFormClient lang={lang} />
      </div>
    </div>
  );
}