import DiscoveryHeader from '@app/components/DiscoveryHeader';
import HeroSection from '@app/components/HeroSection';
import VisitUsSection from '@app/components/VisitUs';
import LatestUpdatesSection from '@app/components/LatestUpdates';
import AboutUs from '@app/components/AboutUs';
import ContactSection from '@app/components/ContactSection';
import ParticipationActions from '@app/components/ParticipationActions';
import Footer from '@app/components/Footer';
import Documents from '@app/components/Documents';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { isContentLanguage } from '@club/shared-types/api/localizedContent';
import { buildPublicMetadata } from '@app/lib/publicSeo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isContentLanguage(lang)) notFound();
  return buildPublicMetadata({ locale: lang, route: 'home' });
}

// Main page component (server component)
export default async function Home({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  if (!isContentLanguage(lang)) {
    notFound();
  }

  setRequestLocale(lang);
  await connection();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <DiscoveryHeader lang={lang} />
      <main id="main-content" tabIndex={-1} className="flex-1">
        <HeroSection locale={lang} />
        <VisitUsSection locale={lang} />
        <ParticipationActions locale={lang} />
        <LatestUpdatesSection locale={lang} />
        <ContactSection locale={lang} />
        <AboutUs locale={lang} />
        <Documents locale={lang} />
      </main>
      <Footer />
    </div>
  );
}
