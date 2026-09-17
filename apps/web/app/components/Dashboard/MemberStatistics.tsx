'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Api } from '@club/shared-types/api/user';
import { Button } from '@app/components/ui/button';
import { ChevronDown, ChevronUp, Mars, Venus } from 'lucide-react';

export interface MemberStatisticsProps {
  statistics: Api.MemberListStatistics;
  cohortLabel: string;
}

export function MemberStatistics({
  statistics,
  cohortLabel,
}: MemberStatisticsProps) {
  const t = useTranslations('dashboard.memberList');
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setIsExpanded((expanded) => !expanded)}
        className="w-full justify-between"
        aria-expanded={isExpanded}
      >
        <span>
          {t('statistics', { count: statistics.total, cohort: cohortLabel })}
        </span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        )}
      </Button>

      {isExpanded && (
        <div className="space-y-6">
          <section>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-sm font-medium text-muted-foreground">
                {t('genderDistribution')}
              </h3>
              {statistics.gender.missing > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('missingGender', { count: statistics.gender.missing })}
                </p>
              )}
            </div>
            <dl className="mt-2 grid grid-cols-3 gap-2">
              <div className="flex min-w-0 items-baseline gap-1 whitespace-nowrap">
                <dt className="text-xs text-muted-foreground">
                  {t('genderValues.male')}
                </dt>
                <dd className="font-semibold tabular-nums">
                  {statistics.gender.male}
                </dd>
              </div>
              <div className="flex min-w-0 items-baseline gap-1 whitespace-nowrap">
                <dt className="text-xs text-muted-foreground">
                  {t('genderValues.female')}
                </dt>
                <dd className="font-semibold tabular-nums">
                  {statistics.gender.female}
                </dd>
              </div>
              <div className="flex min-w-0 items-baseline gap-1 whitespace-nowrap">
                <dt className="text-xs text-muted-foreground">
                  {t('genderValues.non-binary')}
                </dt>
                <dd className="font-semibold tabular-nums">
                  {statistics.gender.other}
                </dd>
              </div>
            </dl>
          </section>

          <section>
            <h3 className="text-base font-semibold">
              {t('birthYearDistribution')}
            </h3>
            {statistics.missingBirthDate > 0 && (
              <p className="mt-2 text-sm text-muted-foreground">
                {t('missingBirthDate', {
                  count: statistics.missingBirthDate,
                })}
              </p>
            )}
            <ul className="mt-3 grid grid-cols-2 gap-1 min-[300px]:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
              {statistics.birthYears.map(
                ({ year, male, female, other, missing }) => {
                  const total = male + female + other + missing;

                  return (
                    <li
                      key={year}
                      className="rounded-md border bg-card px-1 py-1.5"
                    >
                      <span className="sr-only">
                        {t('statistics', {
                          count: total,
                          cohort: String(year),
                        })}
                      </span>
                      <div className="flex items-center justify-between gap-0 text-xs tabular-nums">
                        <span className="font-semibold">{year}</span>
                        <div className="flex shrink-0 items-center gap-0.5 font-medium">
                          <span className="flex items-center gap-0">
                            <span className="sr-only">
                              {t('genderValues.male')}:{' '}
                            </span>
                            <Mars
                              className="h-2.5 w-2.5 text-blue-600"
                              aria-hidden="true"
                            />
                            <span>{male}</span>
                          </span>
                          <span className="flex items-center gap-0">
                            <span className="sr-only">
                              {t('genderValues.female')}:{' '}
                            </span>
                            <Venus
                              className="h-2.5 w-2.5 text-pink-600"
                              aria-hidden="true"
                            />
                            <span>{female}</span>
                          </span>
                        </div>
                      </div>
                      {(other > 0 || missing > 0) && (
                        <div className="mt-1 flex flex-wrap gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
                          {other > 0 && (
                            <span>
                              {t('genderValues.non-binary')}: {other}
                            </span>
                          )}
                          {missing > 0 && (
                            <span>
                              {t('missingGender', { count: missing })}
                            </span>
                          )}
                        </div>
                      )}
                    </li>
                  );
                }
              )}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
