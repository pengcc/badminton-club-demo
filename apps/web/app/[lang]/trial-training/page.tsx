import TrialTrainingFormClient from '@app/components/TrialTrainingFormClient';
import Header from '@app/components/Header';
import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';

export default async function TrialTrainingPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;

  // Enable static rendering
  setRequestLocale(lang);

  return (
    <div className="container mx-auto px-4 py-8">
      <Header lang={lang} />
      <div className="max-w-2xl mx-auto pt-8">
        <TrialTrainingPageContent />
      </div>
    </div>
  );
}

function TrialTrainingPageContent() {
  const t = useTranslations('common');

  return (
    <>
      <h1 className="text-3xl font-bold mb-6 text-center">{t('pages.trialTraining')}</h1>
      <TrialTrainingFormClient />
    </>
  );
}
