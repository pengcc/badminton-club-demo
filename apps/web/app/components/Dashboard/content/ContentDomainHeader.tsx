'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@app/components/ui/button';

export type ContentDomain =
  | 'homepage'
  | 'communication'
  | 'clubInformation'
  | 'membershipParticipation'
  | 'recruitment'
  | 'documents';

export function ContentDomainHeader({ domain }: { domain: ContentDomain }) {
  const locale = useLocale();
  const t = useTranslations('dashboard.cms.content');

  return (
    <header className="mb-6 space-y-3">
      <Button asChild variant="ghost" size="sm" className="-ml-3">
        <Link href={`/${locale}/dashboard/content`}>
          <ArrowLeft aria-hidden="true" />
          {t('backToOverview')}
        </Link>
      </Button>
      <div>
        <p className="mb-1 text-sm font-medium text-primary">
          {t(`domains.${domain}.group`)}
        </p>
        <h1 className="text-2xl font-bold text-foreground">
          {t(`domains.${domain}.title`)}
        </h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          {t(`domains.${domain}.description`)}
        </p>
      </div>
    </header>
  );
}
