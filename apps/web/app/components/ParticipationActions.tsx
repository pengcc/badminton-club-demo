import { ArrowRight, Trophy, UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import type { Language } from '@club/shared-types/core/enums';
import { Button } from '@app/components/ui/button';
import {
  getMembershipPublicContent,
  getTasterSessionPublicContent,
} from '@app/lib/data/getParticipationPublicContent';

export default async function ParticipationActions({
  locale,
}: {
  locale: Language;
}) {
  const [taster, membership, t] = await Promise.all([
    getTasterSessionPublicContent(locale),
    getMembershipPublicContent(locale),
    getTranslations({ locale, namespace: 'common' }),
  ]);

  const cards = [
    {
      key: 'taster',
      title: t('participation.taster.title'),
      summary: taster.status === 'ready' ? taster.content.homepageSummary : '',
      href: `/${locale}/taster-session`,
      action: t('participation.taster.action'),
      icon: Users,
    },
    {
      key: 'membership',
      title: t('participation.membership.title'),
      summary:
        membership.status === 'ready' ? membership.content.homepageSummary : '',
      href: `/${locale}/membership`,
      action: t('participation.membership.action'),
      icon: UserPlus,
    },
    {
      key: 'recruitment',
      title: t('participation.recruitment.title'),
      summary: t('participation.recruitment.summary'),
      href: `/${locale}/recruitment`,
      action: t('participation.recruitment.action'),
      icon: Trophy,
    },
  ];

  return (
    <section id="participation" className="scroll-mt-28 bg-muted/30 py-16">
      <div className="container mx-auto px-4">
        <h2 className="mb-10 text-center text-3xl font-bold text-foreground md:text-4xl">
          {t('participation.title')}
        </h2>
        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.key}
                className="rounded-xl border bg-card p-6 shadow-sm"
              >
                <Icon
                  className="mb-4 h-8 w-8 text-primary"
                  aria-hidden="true"
                />
                <h3 className="mb-3 text-xl font-semibold">{card.title}</h3>
                {card.summary ? (
                  <p className="mb-6 text-muted-foreground">{card.summary}</p>
                ) : (
                  <p className="mb-6 text-muted-foreground">
                    {t('participation.unavailable')}
                  </p>
                )}
                <Button asChild className="h-auto min-h-9 whitespace-normal">
                  <Link href={card.href}>
                    {card.action}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </Button>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
