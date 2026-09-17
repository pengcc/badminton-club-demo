import DiscoveryHeader from '@app/components/DiscoveryHeader';
import Footer from '@app/components/Footer';
import TeamsPageContent from '@app/components/TeamsPageContent';
import { setRequestLocale } from 'next-intl/server';
import {
  getPublicTeams,
  getTeamPublicContent,
} from '@app/lib/data/getTeamsPageData';
import { isContentLanguage } from '@club/shared-types/api/localizedContent';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { buildPublicMetadata } from '@app/lib/publicSeo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isContentLanguage(lang)) notFound();
  return buildPublicMetadata({ locale: lang, route: 'teams' });
}

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isContentLanguage(lang)) notFound();

  setRequestLocale(lang);
  await connection();

  const [teams, content] = await Promise.all([
    getPublicTeams(),
    getTeamPublicContent(lang),
  ]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DiscoveryHeader lang={lang} />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <TeamsPageContent teams={teams} content={content} />
      </main>
      <Footer />
    </div>
  );
}
