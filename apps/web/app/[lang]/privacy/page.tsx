import { getTranslations, setRequestLocale } from 'next-intl/server';
import Header from '@app/components/Header';

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  setRequestLocale(lang);
  const t = await getTranslations('common');
  return (
    <div className="min-h-screen bg-background">
      <Header intent="neutral" lang={lang} />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-12">
        <h1 className="text-3xl font-bold">{t('privacy_policy')}</h1>
        <h2 className="text-xl font-semibold">Badminton Club Demo</h2>
        <p>{t('showcase.identity')}</p>
        <p>{t('showcase.disclosure')}</p>
        <p className="text-muted-foreground">{t('showcase.legalPending')}</p>
      </main>
    </div>
  );
}
