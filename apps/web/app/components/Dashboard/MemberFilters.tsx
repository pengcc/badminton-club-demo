'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { MemberListFilter } from '@club/shared-types/core/enums';
import { Gender } from '@club/shared-types/core/enums';
import type { Api } from '@club/shared-types/api/user';
import { Input } from '@app/components/ui/input';
import { Button } from '@app/components/ui/button';
import { Search } from 'lucide-react';

export interface MemberFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filter: MemberListFilter;
  onFilterChange: (filter: MemberListFilter) => void;
  administratorOnly: boolean;
  onAdministratorOnlyChange: (administratorOnly: boolean) => void;
  gender?: Api.MemberGenderFilter;
  genderCounts: Api.MemberListStatistics['gender'];
  onGenderChange: (gender?: Api.MemberGenderFilter) => void;
  showMembershipFilters?: boolean;
}

const FILTERS = [
  MemberListFilter.CURRENT,
  MemberListFilter.ACTIVE,
  MemberListFilter.PASSIVE,
  MemberListFilter.INACTIVE,
  MemberListFilter.ALL,
] as const;

export function MemberFilters({
  searchTerm,
  onSearchChange,
  filter,
  onFilterChange,
  administratorOnly,
  onAdministratorOnlyChange,
  gender,
  genderCounts,
  onGenderChange,
  showMembershipFilters = true,
}: MemberFiltersProps) {
  const t = useTranslations('dashboard.memberList');

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-xl">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          aria-label={t('searchLabel')}
          placeholder={t('searchPlaceholder')}
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          className="pl-10"
        />
      </div>

      {showMembershipFilters && (
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label={t('filterLabel')}
        >
          {FILTERS.map((option) => (
            <Button
              key={option}
              type="button"
              variant={filter === option ? 'default' : 'outline'}
              size="sm"
              onClick={() => onFilterChange(option)}
              aria-pressed={filter === option}
            >
              {t(`filters.${option}`)}
            </Button>
          ))}
        </div>
      )}

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t('administratorFilterLabel')}
      >
        <Button
          type="button"
          variant={administratorOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => onAdministratorOnlyChange(!administratorOnly)}
          aria-pressed={administratorOnly}
        >
          {t('administratorsOnly')}
        </Button>
      </div>

      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label={t('genderFilterLabel')}
      >
        {[
          {
            value: undefined,
            label: 'all',
            count:
              genderCounts.male +
              genderCounts.female +
              genderCounts.other +
              genderCounts.missing,
          },
          { value: Gender.MALE, label: 'male', count: genderCounts.male },
          {
            value: Gender.FEMALE,
            label: 'female',
            count: genderCounts.female,
          },
          {
            value: Gender.NON_BINARY,
            label: 'other',
            count: genderCounts.other,
          },
          { value: 'missing', label: 'missing', count: genderCounts.missing },
        ]
          .filter(
            (option) =>
              (option.label !== 'other' && option.label !== 'missing') ||
              option.count > 0 ||
              gender === option.value
          )
          .map((option) => (
            <Button
              key={option.label}
              type="button"
              variant={gender === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() =>
                onGenderChange(
                  option.value as Api.MemberGenderFilter | undefined
                )
              }
              aria-pressed={gender === option.value}
            >
              {t(`genderFilters.${option.label}`, { count: option.count })}
            </Button>
          ))}
      </div>
    </div>
  );
}
