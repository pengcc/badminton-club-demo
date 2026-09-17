import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { setRequestLocale } from 'next-intl/server';
import { isContentLanguage } from '@club/shared-types/api/localizedContent';
import Footer from '@app/components/Footer';
import DiscoveryHeader from '@app/components/DiscoveryHeader';
import RecruitmentPageContent from '@app/components/RecruitmentPageContent';
import { getLocations } from '@app/lib/data/getHomepageContent';
import { getPublicContactEntries } from '@app/lib/data/getPublicContactEntries';
import { getRecruitmentPublicContent } from '@app/lib/data/getRecruitmentPublicContent';
import { getPublicTeams } from '@app/lib/data/getTeamsPageData';
import { buildPublicMetadata } from '@app/lib/publicSeo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isContentLanguage(lang)) notFound();
  return buildPublicMetadata({ locale: lang, route: 'recruitment' });
}

export default async function RecruitmentPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isContentLanguage(lang)) notFound();
  setRequestLocale(lang);
  await connection();

  const [recruitment, teams, locations, contacts] = await Promise.all([
    getRecruitmentPublicContent(lang),
    getPublicTeams(),
    getLocations(lang),
    getPublicContactEntries(lang),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <DiscoveryHeader lang={lang} />
      <main id="main-content" tabIndex={-1}>
        <RecruitmentPageContent
          locale={lang}
          recruitment={recruitment}
          teams={teams}
          locations={locations}
          contacts={contacts}
        />
      </main>
      <Footer />
    </div>
  );
}
