import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, Trophy } from 'lucide-react';
import Link from 'next/link';
import type { Language } from '@club/shared-types/core/enums';
import { Button } from '@app/components/ui/button';
import type {
  PublicTeam,
  TeamPublicContent,
} from '@app/lib/data/getTeamsPageData';
import type { PublicProjectionResult } from '@app/lib/data/publicProjection';
import { formatTeamClass } from '@app/lib/teamClass';

interface TeamsPageContentProps {
  teams: PublicProjectionResult<PublicTeam[]>;
  content: PublicProjectionResult<TeamPublicContent>;
}

export default function TeamsPageContent({
  teams,
  content,
}: TeamsPageContentProps) {
  const t = useTranslations('common');
  const locale = useLocale() as Language;

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        {/* Page Title */}
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {content.status === 'ready' &&
            content.data.enabled &&
            content.data.title
              ? content.data.title
              : t('teams.pageTitle')}
          </h1>
        </div>

        {/* Global Content Section */}
        {content.status === 'unavailable' ? (
          <p className="mx-auto mb-12 max-w-3xl text-center text-muted-foreground">
            {t('teams.introductionUnavailable')}
          </p>
        ) : content.data.enabled && content.data.description ? (
          <div className="max-w-3xl mx-auto mb-12">
            <div className="bg-card rounded-lg border border-border p-6 md:p-8 shadow-sm">
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
                {content.data.description}
              </p>
            </div>
          </div>
        ) : null}

        {/* Team List */}
        {teams.status === 'unavailable' ? (
          <p className="text-center text-muted-foreground">
            {t('teams.unavailable')}
          </p>
        ) : teams.data.length === 0 ? (
          <p className="text-center text-muted-foreground">
            {t('teams.noTeams')}
          </p>
        ) : (
          <div className="flex flex-wrap justify-center gap-6 max-w-5xl mx-auto">
            {teams.data.map((team) => (
              <div
                key={team.shortName}
                className="bg-card rounded-lg border border-border p-6 shadow-sm hover:shadow-md transition-shadow w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)] min-w-[260px]"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Trophy className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {team.shortName}
                  </h3>
                </div>

                <div className="space-y-2">
                  <p className="text-muted-foreground text-sm">
                    {team.leagueTeamName}
                  </p>
                  {team.matchLevel && (
                    <span className="inline-block text-xs font-medium bg-muted px-2.5 py-1 rounded-full text-muted-foreground">
                      {t('teams.matchLevel')}:{' '}
                      {formatTeamClass(team.matchLevel)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <aside className="mx-auto mt-12 max-w-3xl rounded-xl border bg-muted/30 p-6 text-center">
          <h2 className="text-xl font-semibold">
            {t('teams.recruitment.title')}
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
            {t('teams.recruitment.description')}
          </p>
          <Button asChild className="mt-5 h-auto min-h-9 whitespace-normal">
            <Link href={`/${locale}/recruitment`}>
              {t('teams.recruitment.action')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </aside>
      </div>
    </section>
  );
}
