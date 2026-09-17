import { getTranslations } from 'next-intl/server';
import { getClubInformation } from '@app/lib/data/getHomepageContent';
import type { Language } from '@club/shared-types/core/enums';

interface AboutUsProps {
  locale: Language;
}

export default async function AboutUs({ locale }: AboutUsProps) {
  const [club, t] = await Promise.all([
    getClubInformation(locale),
    getTranslations('common'),
  ]);

  return (
    <section id="about-us" className="scroll-mt-28 bg-card py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {t('about.title')}
          </h2>
          {club.status === 'unavailable' ? (
            <p className="text-muted-foreground">{t('about.unavailable')}</p>
          ) : (
            <>
              {club.data.localizedName && (
                <div className="mb-4 text-lg font-medium text-foreground">
                  <p>
                    {club.data.localizedName}
                    {club.data.shortName && ` (${club.data.shortName})`}
                  </p>
                  {club.data.foundingYear && (
                    <p className="text-sm font-normal text-muted-foreground">
                      {t('about.founded', { year: club.data.foundingYear })}
                    </p>
                  )}
                </div>
              )}
              <div className="text-xl text-muted-foreground max-w-full mx-auto mb-8">
                {club.data.introduction}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
