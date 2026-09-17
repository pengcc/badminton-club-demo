'use client';

import React, { useMemo, useState } from 'react';
import { FormLabel } from '@app/components/FormLabel';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@app/components/ui/popover';
import { Button } from '@app/components/ui/button';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@app/lib/utils';
import { useLocale, useTranslations } from 'next-intl';

interface BirthdayPickerProps {
  value: string; // YYYY-MM-DD format
  onChange: (value: string) => void;
  onBlur?: () => void;
  required?: boolean;
  error?: string[];
  label?: string;
  maxYear?: number; // default: current year
  minAge?: number; // default: 14
  disabled?: boolean;
}

export const BirthdayPicker: React.FC<BirthdayPickerProps> = ({
  value,
  onChange,
  onBlur,
  required = false,
  error,
  label,
  maxYear,
  minAge = 14,
  disabled = false,
}) => {
  const locale = useLocale();
  const t = useTranslations('common.birthdayPicker');
  const hasError = error && error.length > 0;
  const fieldId = React.useId();
  const errorId = `${fieldId}-error`;

  // Parse current value
  const [year, month, day] = value ? value.split('-') : ['', '', ''];

  // Year picker state
  const [yearPickerOpen, setYearPickerOpen] = useState(false);
  const [yearPage, setYearPage] = useState(0);

  // Generate year options (current year - minAge down to 100 years ago)
  const currentYear = new Date().getFullYear();
  const maxSelectableYear = maxYear || currentYear - minAge;
  const minSelectableYear = currentYear - 100;

  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = maxSelectableYear; y >= minSelectableYear; y--) {
      years.push(y);
    }
    return years;
  }, [maxSelectableYear, minSelectableYear]);

  // Paginate years for grid display (20 years per page)
  const yearsPerPage = 20;
  const totalPages = Math.ceil(yearOptions.length / yearsPerPage);
  const paginatedYears = useMemo(() => {
    const start = yearPage * yearsPerPage;
    return yearOptions.slice(start, start + yearsPerPage);
  }, [yearOptions, yearPage]);

  // Month options
  const monthOptions = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => ({
        value: String(index + 1).padStart(2, '0'),
        label: new Intl.DateTimeFormat(locale, {
          month: 'long',
          timeZone: 'UTC',
        }).format(new Date(Date.UTC(2024, index, 1))),
      })),
    [locale]
  );

  // Calculate days in month (accounting for leap years)
  const daysInMonth = useMemo(() => {
    if (!year || !month) return 31;
    const y = parseInt(year);
    const m = parseInt(month);
    return new Date(y, m, 0).getDate();
  }, [year, month]);

  // Day options
  const dayOptions = useMemo(() => {
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(d.toString().padStart(2, '0'));
    }
    return days;
  }, [daysInMonth]);

  const handleYearChange = (newYear: string) => {
    if (!newYear) {
      onChange('');
      return;
    }
    // Keep month and day if valid for new year
    const newDate = `${newYear}-${month || '01'}-${day || '01'}`;
    onChange(newDate);
    setYearPickerOpen(false);
  };

  const handleMonthChange = (newMonth: string) => {
    if (!year) return;
    if (!newMonth) {
      onChange(`${year}--`);
      return;
    }
    // Adjust day if it exceeds days in new month
    const maxDays = new Date(parseInt(year), parseInt(newMonth), 0).getDate();
    const adjustedDay =
      day && parseInt(day) > maxDays
        ? maxDays.toString().padStart(2, '0')
        : day || '01';
    onChange(`${year}-${newMonth}-${adjustedDay}`);
  };

  const handleDayChange = (newDay: string) => {
    if (!year || !month) return;
    if (!newDay) {
      onChange(`${year}-${month}-`);
      return;
    }
    onChange(`${year}-${month}-${newDay}`);
  };

  const handlePrevPage = () => {
    if (yearPage < totalPages - 1) {
      setYearPage(yearPage + 1);
    }
  };

  const handleNextPage = () => {
    if (yearPage > 0) {
      setYearPage(yearPage - 1);
    }
  };

  return (
    <div className={cn('space-y-2')}>
      {label && (
        <FormLabel htmlFor={fieldId} required={required}>
          {label ?? t('label')}
        </FormLabel>
      )}

      <div className="grid grid-cols-3 gap-3">
        {/* Year Selector with Grid Popover */}
        <Popover
          open={disabled ? false : yearPickerOpen}
          onOpenChange={(open) => {
            if (!disabled) setYearPickerOpen(open);
          }}
        >
          <PopoverTrigger asChild>
            <Button
              id={fieldId}
              variant="outline"
              role="combobox"
              aria-expanded={yearPickerOpen}
              aria-invalid={Boolean(hasError)}
              aria-describedby={hasError ? errorId : undefined}
              className={cn(
                'w-full justify-between font-normal',
                !year && 'text-muted-foreground'
              )}
              onBlur={onBlur}
              disabled={disabled}
            >
              {year || t('year')}
              <CalendarIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
            <div className="flex items-center justify-between border-b px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrevPage}
                disabled={disabled || yearPage >= totalPages - 1}
                className="h-7 w-7 p-0"
                aria-label={t('olderYears')}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium">
                {paginatedYears[paginatedYears.length - 1]} -{' '}
                {paginatedYears[0]}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextPage}
                disabled={disabled || yearPage <= 0}
                className="h-7 w-7 p-0"
                aria-label={t('newerYears')}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-4 gap-1 p-3 max-h-[280px] overflow-y-auto">
              {paginatedYears.map((y) => (
                <Button
                  key={y}
                  variant={year === y.toString() ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleYearChange(y.toString())}
                  disabled={disabled}
                  className={cn(
                    'h-9 font-normal',
                    year === y.toString() &&
                      'bg-primary text-primary-foreground'
                  )}
                >
                  {y}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Month Selector */}
        <select
          value={month}
          onChange={(event) => handleMonthChange(event.target.value)}
          disabled={disabled || !year}
          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={t('month')}
          aria-invalid={Boolean(hasError)}
          aria-describedby={hasError ? errorId : undefined}
          onBlur={onBlur}
        >
          <option value="">{t('month')}</option>
          {monthOptions.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>

        {/* Day Selector */}
        <select
          value={day}
          onChange={(event) => handleDayChange(event.target.value)}
          disabled={disabled || !year || !month}
          className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label={t('day')}
          aria-invalid={Boolean(hasError)}
          aria-describedby={hasError ? errorId : undefined}
          onBlur={onBlur}
        >
          <option value="">{t('day')}</option>
          {dayOptions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {hasError && (
        <p className="text-sm text-destructive mt-1" id={errorId}>
          {error[0]}
        </p>
      )}
    </div>
  );
};
