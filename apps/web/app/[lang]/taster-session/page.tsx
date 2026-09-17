import { getDemoRuntimeStatus } from '@app/lib/data/getDemoRuntimeStatus';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { isContentLanguage } from '@club/shared-types/api/localizedContent';
import DiscoveryHeader from '@app/components/DiscoveryHeader';
import Footer from '@app/components/Footer';
import TasterSessionFormClient from '@app/components/TasterSessionFormClient';
import { getTasterSessionPublicContent } from '@app/lib/data/getParticipationPublicContent';
import { buildPublicMetadata } from '@app/lib/publicSeo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isContentLanguage(lang)) notFound();
  return buildPublicMetadata({ locale: lang, route: 'tasterSession' });
}

export default async function TasterSessionPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isContentLanguage(lang)) notFound();
  setRequestLocale(lang);
  await connection();

  const [result, t, demoStatus] = await Promise.all([
    getTasterSessionPublicContent(lang),
    getTranslations({ locale: lang, namespace: 'common' }),
    getDemoRuntimeStatus(),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DiscoveryHeader lang={lang} />
      <main
        id="main-content"
        tabIndex={-1}
        className="container mx-auto flex-1 px-4 py-12"
      >
        <div className="mx-auto max-w-3xl space-y-10">
          <section>
            <h1 className="mb-6 text-center text-3xl font-bold">
              {t('pages.tasterSession')}
            </h1>
            {result.status === 'unavailable' ? (
              <p className="rounded-lg border bg-card p-6 text-muted-foreground">
                {t('participation.informationUnavailable')}
              </p>
            ) : (
              <div className="space-y-5 rounded-lg border bg-card p-6 shadow-sm">
                <p className="text-lg">{result.content.introduction}</p>
                {result.content.preparation && (
                  <div>
                    <h2 className="font-semibold">
                      {t('participation.taster.preparation')}
                    </h2>
                    <p className="text-muted-foreground">
                      {result.content.preparation}
                    </p>
                  </div>
                )}
                {result.content.participationGuidance && (
                  <div>
                    <h2 className="font-semibold">
                      {t('participation.taster.guidance')}
                    </h2>
                    <p className="text-muted-foreground">
                      {result.content.participationGuidance}
                    </p>
                  </div>
                )}
                {result.content.followUpGuidance && (
                  <div>
                    <h2 className="font-semibold">
                      {t('participation.taster.followUp')}
                    </h2>
                    <p className="text-muted-foreground">
                      {result.content.followUpGuidance}
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
          <section aria-labelledby="taster-request-heading">
            <h2 id="taster-request-heading" className="mb-6 text-2xl font-bold">
              {t('tasterSession.title')}
            </h2>
            {demoStatus === 'disabled' ? (
              <TasterSessionFormClient />
            ) : (
              <p className="rounded-lg border bg-card p-6 text-muted-foreground">
                {t(
                  demoStatus === 'enabled'
                    ? 'participation.taster.demoUnavailable'
                    : 'participation.taster.requestUnavailable'
                )}
              </p>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
