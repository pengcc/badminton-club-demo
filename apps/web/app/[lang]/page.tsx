import Header from '@app/components/Header';
import HeroSection from '@app/components/HeroSection';
import VisitUsSection from '@app/components/VisitUs';
import LatestUpdatesSection from '@app/components/LatestUpdates';
import AboutUs from '@app/components/AboutUs';
import ContactSection from '@app/components/ContactSection';
import Footer from '@app/components/Footer';
import Documents from '@app/components/Documents';
import { StorageModeBannerWrapper } from '@app/components/Storage';
import { setRequestLocale } from 'next-intl/server';

// Main page component (server component)
export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;

  // Enable static rendering
  setRequestLocale(lang);

  return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header withMainNav={true} lang={lang} />
        <main className="flex-1">
          <div className="container mx-auto px-4 py-6">
            <StorageModeBannerWrapper />
          </div>
          <HeroSection />
          <LatestUpdatesSection />
          <VisitUsSection />
          <ContactSection />
          <AboutUs />
          <Documents />
        </main>
        <Footer />
      </div>
    );
}
