import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import TasterSessionRequestCenter from '@app/components/Dashboard/TasterSessionRequestCenter';

export default async function TasterSessionsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  setRequestLocale(lang);
  return <TasterSessionsPageContent />;
}

function TasterSessionsPageContent() {
  const t = useTranslations('common.tasterSession.admin');
  return (
    <div>
      <div className="mb-6">
        <h1 className="mb-2 text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>
      <TasterSessionRequestCenter />
    </div>
  );
}
