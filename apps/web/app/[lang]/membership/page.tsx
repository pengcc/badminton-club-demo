import { getDemoRuntimeStatus } from '@app/lib/data/getDemoRuntimeStatus';
import Link from 'next/link';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { isContentLanguage } from '@club/shared-types/api/localizedContent';
import DiscoveryHeader from '@app/components/DiscoveryHeader';
import Footer from '@app/components/Footer';
import Documents from '@app/components/Documents';
import {
  getMembershipAvailability,
  getMembershipPublicContent,
} from '@app/lib/data/getParticipationPublicContent';
import { buildPublicMetadata } from '@app/lib/publicSeo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isContentLanguage(lang)) notFound();
  return buildPublicMetadata({ locale: lang, route: 'membership' });
}

export default async function MembershipPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isContentLanguage(lang)) notFound();
  setRequestLocale(lang);
  await connection();

  const [result, membershipOpen, t, demoStatus] = await Promise.all([
    getMembershipPublicContent(lang),
    getMembershipAvailability(),
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
        <div className="mx-auto max-w-3xl space-y-8">
          <h1 className="text-center text-3xl font-bold">
            {t('pages.membershipInformation')}
          </h1>

          <div className="rounded-lg border bg-card p-5 text-center shadow-sm">
            <p className="font-semibold">
              {membershipOpen === null
                ? t('membershipInformation.statusUnavailable')
                : membershipOpen
                  ? t('membershipInformation.open')
                  : t('membershipInformation.closed')}
            </p>
          </div>

          {result.status === 'unavailable' ? (
            <p className="rounded-lg border bg-card p-6 text-muted-foreground">
              {t('participation.informationUnavailable')}
            </p>
          ) : (
            <div className="space-y-6 rounded-lg border bg-card p-6 shadow-sm">
              <p className="text-lg">{result.content.introduction}</p>
              <section>
                <h2 className="mb-2 text-xl font-semibold">
                  {t('membershipInformation.types')}
                </h2>
                <p className="text-muted-foreground">
                  {result.content.membershipTypes}
                </p>
              </section>
              <section>
                <h2 className="mb-2 text-xl font-semibold">
                  {t('membershipInformation.path')}
                </h2>
                <p className="text-muted-foreground">
                  {result.content.membershipPath}
                </p>
              </section>
              {result.content.applicationPreparation && (
                <section>
                  <h2 className="mb-2 text-xl font-semibold">
                    {t('membershipInformation.preparation')}
                  </h2>
                  <p className="text-muted-foreground">
                    {result.content.applicationPreparation}
                  </p>
                </section>
              )}
              {result.content.studentProof && (
                <section>
                  <h2 className="mb-2 text-xl font-semibold">
                    {t('membershipInformation.studentProof')}
                  </h2>
                  <p className="text-muted-foreground">
                    {result.content.studentProof}
                  </p>
                </section>
              )}
            </div>
          )}

          <div className="rounded-lg border border-primary/30 bg-primary/5 p-5">
            <p>{t('membershipInformation.controlledApplication')}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {demoStatus === 'disabled' && (
                <Link
                  className="font-medium text-primary hover:underline"
                  href={`/${lang}/apply/access`}
                >
                  {t('membershipInformation.recoveryLink')}
                </Link>
              )}
              <Link
                className="font-medium text-primary hover:underline"
                href={`/${lang}/taster-session`}
              >
                {t('membershipInformation.tasterLink')}
              </Link>
              <Link
                className="font-medium text-primary hover:underline"
                href={`/${lang}#contact`}
              >
                {t('membershipInformation.contactLink')}
              </Link>
            </div>
          </div>
        </div>
        <Documents locale={lang} />
      </main>
      <Footer />
    </div>
  );
}
