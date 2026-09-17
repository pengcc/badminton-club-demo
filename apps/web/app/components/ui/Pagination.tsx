/**
 * Pagination Component
 *
 * Reusable pagination controls with page size selector
 */

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button } from './button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
}

export function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50],
}: PaginationProps) {
  const t = useTranslations('common.pagination');
  const totalPages = Math.ceil(totalItems / pageSize);
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  if (totalItems === 0) {
    return null;
  }

  return (
    <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-3 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
      {/* Items info */}
      <div className="min-w-0 text-sm text-muted-foreground">
        <span className="sm:hidden" aria-hidden="true">
          {t('rangeCompact', {
            start: startItem,
            end: endItem,
            total: totalItems,
          })}
        </span>
        <span className="sr-only sm:not-sr-only">
          {t('range', { start: startItem, end: endItem, total: totalItems })}
        </span>
      </div>

      <div className="contents sm:flex sm:items-center sm:gap-4">
        {/* Page size selector */}
        <div className="flex shrink-0 items-center gap-2">
          <span
            className="text-sm text-muted-foreground sm:hidden"
            aria-hidden="true"
          >
            {t('perPageCompact')}
          </span>
          <span
            className="hidden text-sm text-muted-foreground sm:inline"
            aria-hidden="true"
          >
            {t('perPage')}
          </span>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger className="w-[68px]" aria-label={t('perPageLabel')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {/* Page controls */}
        <div className="col-span-2 flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevious}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="sr-only">{t('previous')}</span>
          </Button>

          <div className="text-sm font-medium tabular-nums">
            <span className="sm:hidden" aria-hidden="true">
              {t('pageCompact', { current: currentPage, total: totalPages })}
            </span>
            <span className="sr-only sm:not-sr-only">
              {t('page', { current: currentPage, total: totalPages })}
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
            <span className="sr-only">{t('next')}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
