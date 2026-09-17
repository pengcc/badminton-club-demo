'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@app/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@app/components/ui/select';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { GuestPlayService } from '@app/services/guestPlayService';
import type {
  GuestPlayAdminResponse,
  GuestPlayStatus,
} from '@club/shared-types/api/guestPlay';
import GuestPlayDetailsModal from './modals/GuestPlayDetailsModal';

export default function GuestPlayManagement() {
  const t = useTranslations('common.guestPlay');
  const [status, setStatus] = useState<'all' | GuestPlayStatus>('pending');
  const [archiveView, setArchiveView] = useState<'exclude' | 'only'>('exclude');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<GuestPlayAdminResponse | null>(null);
  const query = {
    status,
    archived: archiveView,
    limit: 100,
    offset: 0,
  } as const;
  const list = GuestPlayService.useRequestList(query);
  const stats = GuestPlayService.useStats();
  const normalized = search.trim().toLowerCase();
  const visible =
    list.data?.requests.filter(
      (request) =>
        !normalized ||
        request.memberName.toLowerCase().includes(normalized) ||
        request.memberEmail.toLowerCase().includes(normalized)
    ) ?? [];

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>{t('admin.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats.data && (
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {(
                [
                  'total',
                  'pending',
                  'approved',
                  'declined',
                  'cancelled',
                  'archived',
                ] as const
              ).map((key) => (
                <div key={key} className="rounded-md bg-muted/50 p-3">
                  <dt className="text-xs text-muted-foreground">
                    {t(`admin.stats.${key}`)}
                  </dt>
                  <dd className="text-xl font-semibold">{stats.data[key]}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <label className="sr-only" htmlFor="guest-play-search">
              {t('admin.search')}
            </label>
            <input
              id="guest-play-search"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              placeholder={t('admin.search')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Select
              value={status}
              onValueChange={(value) =>
                setStatus(value as 'all' | GuestPlayStatus)
              }
            >
              <SelectTrigger
                aria-label={t('admin.statusFilter')}
                className="h-10"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.all')}</SelectItem>
                {(
                  ['pending', 'approved', 'declined', 'cancelled'] as const
                ).map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(`status.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={archiveView}
              onValueChange={(value) =>
                setArchiveView(value as 'exclude' | 'only')
              }
            >
              <SelectTrigger
                aria-label={t('admin.archiveFilter')}
                className="h-10"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exclude">{t('admin.active')}</SelectItem>
                <SelectItem value="only">{t('admin.archived')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {list.isPending ? (
        <Card>
          <CardContent
            className="p-6 text-sm text-muted-foreground"
            role="status"
          >
            {t('states.loadingRequests')}
          </CardContent>
        </Card>
      ) : list.isError && !list.data ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-red-700" role="alert">
              {t('errors.requests')}
            </p>
            <Button
              className="mt-3"
              variant="outline"
              onClick={() => list.refetch()}
            >
              {t('actions.retry')}
            </Button>
          </CardContent>
        </Card>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            {t('admin.empty')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {visible.map((request) => (
            <Card key={request.id}>
              <CardContent className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{request.memberName}</strong>
                    <span className="rounded-full border px-2 py-0.5 text-xs">
                      {t(`status.${request.status}`)}
                    </span>
                    {request.archived && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {t('admin.archived')}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {request.appointment.localDate} ·{' '}
                    {request.appointment.startTime} ·{' '}
                    {request.appointment.locationName} · {request.guestCount}
                  </p>
                </div>
                <Button variant="outline" onClick={() => setSelected(request)}>
                  {t('actions.details')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {list.data && list.isError && (
        <p className="text-sm text-amber-800" role="status">
          {t('states.staleRequests')}
        </p>
      )}
      <GuestPlayDetailsModal
        key={selected?.id ?? 'closed'}
        isOpen={Boolean(selected)}
        request={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
