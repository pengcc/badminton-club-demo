'use client';

import { AuditEventType, EntityType } from '@club/shared-types/core/enums';
import React, { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import { Input } from '@app/components/ui/input';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  RefreshCw,
  Search,
  Shield,
} from 'lucide-react';
import { AuditService } from '@app/services/auditService';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@app/components/ui/select';
import AuditDetailsModal from './modals/AuditDetailsModal';

const formatFilterLabel = (value: string) =>
  value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

const EVENT_LABEL_OVERRIDES: Partial<Record<AuditEventType, string>> = {
  [AuditEventType.USER_PLAYER_STATUS_CHANGED]: 'Player Status Changed',
  [AuditEventType.USER_INVITATION_SENT]: 'Invitation Sent',
  [AuditEventType.USER_EMAIL_CHANGED]: 'Email Changed',
  [AuditEventType.TEAM_PLAYER_ADDED]: 'Player Added to Team',
  [AuditEventType.TEAM_PLAYER_REMOVED]: 'Player Removed from Team',
  [AuditEventType.APPLICATION_CONTACTED]: 'Applicant Contacted',
};

export const AUDIT_EVENT_FILTER_OPTIONS = Object.values(AuditEventType).map(
  (value) => ({
    value,
    label: EVENT_LABEL_OVERRIDES[value] ?? formatFilterLabel(value),
  })
);

export const AUDIT_ENTITY_FILTER_OPTIONS = Object.values(EntityType).map(
  (value) => ({ value, label: formatFilterLabel(value) })
);

export default function AuditLogCenter() {
  const t = useTranslations('dashboard.auditLog');
  const locale = useLocale();
  const [searchTerm, setSearchTerm] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const pageSize = 50;

  // Build filters
  const filters = {
    eventType: eventTypeFilter !== 'all' ? eventTypeFilter : undefined,
    entityType: entityTypeFilter !== 'all' ? entityTypeFilter : undefined,
    limit: pageSize,
    offset: page * pageSize,
  };

  // Fetch audit logs
  const {
    data,
    isLoading,
    isLoadingError,
    isRefetchError,
    isFetching,
    refetch,
  } = AuditService.useAuditLogs(filters);
  const logs = data?.data || [];
  const pagination = data?.pagination || { total: 0, hasMore: false };

  // Current-page search uses only the privacy-safe read projection.
  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredLogs = logs.filter(
    (log: any) =>
      normalizedSearchTerm === '' ||
      log.actorDisplayName.toLowerCase().includes(normalizedSearchTerm) ||
      log.entityId?.toLowerCase().includes(normalizedSearchTerm)
  );
  const hasServerFilter =
    eventTypeFilter !== 'all' || entityTypeFilter !== 'all';
  const hasPageSearch = normalizedSearchTerm !== '';

  const handleEventTypeChange = (value: string) => {
    setPage(0);
    setEventTypeFilter(value);
  };

  const handleEntityTypeChange = (value: string) => {
    setPage(0);
    setEntityTypeFilter(value);
  };

  const formatEventType = (eventType: string) => t(`events.${eventType}`);
  const formatEntityType = (entityType: string) => t(`entities.${entityType}`);

  // Handle view details
  const handleViewDetails = (log: any) => {
    setSelectedLog(log);
    setDetailsModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (isLoadingError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('title')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="flex flex-col items-center gap-3 py-8 text-center"
            role="alert"
            aria-live="polite"
          >
            <AlertCircle
              className="h-10 w-10 text-destructive"
              aria-hidden="true"
            />
            <div>
              <h3 className="font-semibold">{t('loadErrorTitle')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('loadErrorDescription')}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void refetch()}
              disabled={isFetching}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {isFetching ? t('retrying') : t('retry')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t('title')}
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              {hasPageSearch
                ? t('pageSearchCount', { count: filteredLogs.length })
                : t('currentViewTotal', { count: pagination.total })}
            </div>
          </div>

          {isRefetchError && data !== undefined && (
            <div
              className="mt-4 flex flex-col gap-3 rounded-md border border-destructive/50 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
              role="alert"
              aria-live="polite"
            >
              <div className="flex gap-3">
                <AlertCircle
                  className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-medium">{t('refreshErrorTitle')}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('refreshErrorDescription')}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void refetch()}
                disabled={isFetching}
                className="self-start sm:self-auto"
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                {isFetching ? t('retrying') : t('retry')}
              </Button>
            </div>
          )}

          {/* Filters */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  aria-label={t('pageSearchLabel')}
                  placeholder={t('pageSearchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('pageSearchHelp')}
              </p>
            </div>

            {/* Event Type Filter */}
            <Select
              value={eventTypeFilter}
              onValueChange={handleEventTypeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('eventFilter')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allEvents')}</SelectItem>
                {AUDIT_EVENT_FILTER_OPTIONS.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {formatEventType(type.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Entity Type Filter */}
            <Select
              value={entityTypeFilter}
              onValueChange={handleEntityTypeChange}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('entityFilter')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allEntities')}</SelectItem>
                {AUDIT_ENTITY_FILTER_OPTIONS.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {formatEntityType(type.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {/* Audit Log Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-3 font-medium text-sm">
                    {t('columns.timestamp')}
                  </th>
                  <th className="text-left p-3 font-medium text-sm">
                    {t('columns.event')}
                  </th>
                  <th className="hidden md:table-cell text-left p-3 font-medium text-sm">
                    {t('columns.entity')}
                  </th>
                  <th className="text-left p-3 font-medium text-sm">
                    {t('columns.actor')}
                  </th>
                  <th className="text-left p-3 font-medium text-sm md:hidden">
                    {t('columns.view')}
                  </th>
                  <th className="hidden md:table-cell text-left p-3 font-medium text-sm">
                    {t('columns.details')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center p-8 text-muted-foreground"
                    >
                      {logs.length === 0
                        ? hasServerFilter
                          ? t('filteredEmpty')
                          : t('currentViewEmpty')
                        : t('pageSearchEmpty')}
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log: any) => {
                    return (
                      <tr key={log.id} className="border-b hover:bg-muted/50">
                        <td className="p-3 text-sm">
                          <div className="flex items-center gap-2">
                            <div className="flex flex-col">
                              <span>
                                {new Intl.DateTimeFormat(locale, {
                                  dateStyle: 'medium',
                                }).format(new Date(log.createdAt))}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Intl.DateTimeFormat(locale, {
                                  timeStyle: 'medium',
                                }).format(new Date(log.createdAt))}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-sm">
                          <div className="font-medium">
                            {formatEventType(log.eventType)}
                          </div>
                        </td>
                        <td className="hidden md:table-cell p-3 text-sm">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {formatEntityType(log.entityType)}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {log.entityId
                                ? `${log.entityId.substring(0, 8)}...`
                                : t('notAvailable')}
                            </span>
                          </div>
                        </td>
                        <td className="p-3 text-sm">
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {log.actorDisplayName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {log.source === 'scheduled'
                                ? `${t('scheduled')} · ${t(`actorKinds.${log.actorAccountKind}`)}`
                                : t(`actorKinds.${log.actorAccountKind}`)}
                            </span>
                          </div>
                        </td>
                        {/* Mobile: View icon */}
                        <td className="p-3 text-sm md:hidden">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(log)}
                            className="h-8 w-8 p-0"
                            aria-label={t('viewDetailsNamed', {
                              actor: log.actorDisplayName,
                              timestamp: new Intl.DateTimeFormat(locale, {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              }).format(new Date(log.createdAt)),
                            })}
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </td>
                        {/* Desktop: Inline details */}
                        <td className="hidden md:table-cell p-3 text-sm">
                          {(log.reason || log.changes?.length) && (
                            <div className="text-xs text-muted-foreground max-w-xs truncate">
                              {log.reason ??
                                t('changedFields', {
                                  count: log.changes.length,
                                })}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.total > pageSize && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                {hasPageSearch
                  ? t('pageSearchCount', { count: filteredLogs.length })
                  : t('paginationRange', {
                      start: page * pageSize + 1,
                      end: Math.min((page + 1) * pageSize, pagination.total),
                      total: pagination.total,
                    })}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {t('previous')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!pagination.hasMore}
                >
                  {t('next')}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Audit Details Modal */}
      <AuditDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setSelectedLog(null);
        }}
        log={selectedLog}
      />
    </div>
  );
}
