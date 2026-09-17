'use client';

import Link from 'next/link';
import type { ComponentType } from 'react';
import {
  Building2,
  ChevronRight,
  FileText,
  Home,
  Megaphone,
  UserPlus,
  Users,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { useOptionalAuth } from '@app/hooks/useAuth';

type DomainLink = {
  key:
    | 'homepage'
    | 'communication'
    | 'clubInformation'
    | 'membershipParticipation'
    | 'recruitment'
    | 'documents';
  path: string;
  icon: ComponentType<{ className?: string }>;
};

const groups: Array<{
  key: 'websiteCommunication' | 'membershipRecruitment' | 'governance';
  domains: DomainLink[];
}> = [
  {
    key: 'websiteCommunication',
    domains: [
      { key: 'homepage', path: 'homepage', icon: Home },
      { key: 'communication', path: 'communication', icon: Megaphone },
      {
        key: 'clubInformation',
        path: 'club-information',
        icon: Building2,
      },
    ],
  },
  {
    key: 'membershipRecruitment',
    domains: [
      {
        key: 'membershipParticipation',
        path: 'membership-participation',
        icon: Users,
      },
      { key: 'recruitment', path: 'recruitment', icon: UserPlus },
    ],
  },
  {
    key: 'governance',
    domains: [{ key: 'documents', path: 'documents', icon: FileText }],
  },
];

export default function ContentOverview() {
  const locale = useLocale();
  const t = useTranslations('dashboard.cms.content');
  const demoMode = Boolean(useOptionalAuth()?.user.demoMode);
  const visibleGroups = demoMode
    ? [
        {
          key: 'websiteCommunication' as const,
          domains: groups[0].domains.filter(
            (domain) => domain.key === 'communication'
          ),
        },
      ]
    : groups;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          {t('description')}
        </p>
      </header>

      {visibleGroups.map((group) => (
        <section key={group.key} aria-labelledby={`content-${group.key}`}>
          <div className="mb-4">
            <h2
              id={`content-${group.key}`}
              className="text-lg font-semibold text-foreground"
            >
              {t(`groups.${group.key}.title`)}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(`groups.${group.key}.description`)}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {group.domains.map((domain) => {
              const Icon = domain.icon;
              return (
                <Link
                  key={domain.key}
                  href={`/${locale}/dashboard/content/${domain.path}`}
                  className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Card className="h-full gap-4 py-5 transition-colors group-hover:border-primary/50 group-hover:bg-accent/30">
                    <CardHeader className="grid grid-cols-[auto_1fr_auto] items-start gap-3 px-5">
                      <span className="rounded-md bg-primary/10 p-2 text-primary">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <CardTitle className="leading-snug">
                          {t(`domains.${domain.key}.title`)}
                        </CardTitle>
                      </div>
                      <ChevronRight
                        aria-hidden="true"
                        className="mt-1 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      />
                    </CardHeader>
                    <CardContent className="px-5">
                      <CardDescription>
                        {t(`domains.${domain.key}.description`)}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
