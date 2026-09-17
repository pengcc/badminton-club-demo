import DiscoveryHeader from '@app/components/DiscoveryHeader';
import Footer from '@app/components/Footer';
import ActivitiesPageContent from '@app/components/ActivitiesPageContent';
import { setRequestLocale } from 'next-intl/server';
import { getPublicActivities } from '@app/lib/data/getActivitiesPageData';
import { isContentLanguage } from '@club/shared-types/api/localizedContent';
import { notFound } from 'next/navigation';
import { normalizeActivitiesPage } from '@app/lib/activitiesPagination';
import { buildPublicMetadata } from '@app/lib/publicSeo';

interface ActivitiesPageProps {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: ActivitiesPageProps) {
  const [{ lang }, { page }] = await Promise.all([params, searchParams]);
  if (!isContentLanguage(lang)) notFound();
  return buildPublicMetadata({
    locale: lang,
    route: 'activities',
    activitiesPage: normalizeActivitiesPage(page),
  });
}

export default async function ActivitiesPage({
  params,
  searchParams,
}: ActivitiesPageProps) {
  const { lang } = await params;
  const { page: pageParam } = await searchParams;
  if (!isContentLanguage(lang)) notFound();

  // Enable static rendering
  setRequestLocale(lang);

  const currentPage = normalizeActivitiesPage(pageParam);
  const result = await getPublicActivities(lang, currentPage);
  if (result.status === 'disabled') notFound();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DiscoveryHeader lang={lang} />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <ActivitiesPageContent result={result} lang={lang} />
      </main>
      <Footer />
    </div>
  );
}
