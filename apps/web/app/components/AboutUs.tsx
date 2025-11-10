import { useTranslations } from 'next-intl';

export default function AboutUs() {
  const t = useTranslations('common');

  return (
    <section id="about-us" className="py-16 bg-card">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{t('about.title')}</h2>
          <div className="text-xl text-muted-foreground max-w-full mx-auto mb-8">
            {t('club_introduction')}
          </div>
        </div>
      </div>
    </section>
  );
}