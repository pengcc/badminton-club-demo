'use client';

import { useEffect, useState } from 'react';
import { Clock3, FlaskConical } from 'lucide-react';
import { Button } from '@app/components/ui/button';
import { Badge } from '@app/components/ui/badge';
import { DemoEditingService } from '@app/services/demoEditingService';
import { useTranslations } from 'next-intl';

function remainingMinutes(expiresAt: string | undefined, now: number): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 60_000));
}

export function DemoControl() {
  const t = useTranslations('dashboard.demo');
  const statusQuery = DemoEditingService.useStatus();
  const startMutation = DemoEditingService.useStart();
  const finishMutation = DemoEditingService.useFinish();
  const [now, setNow] = useState(() => Date.now());
  const status = statusQuery.data;

  useEffect(() => {
    if (status?.mode !== 'active') return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [status?.mode]);

  if (statusQuery.isPending) {
    return (
      <div className="border-b bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        {t('loading')}
      </div>
    );
  }
  if (statusQuery.isError || !status) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        <span>{t('unavailable')}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => statusQuery.refetch()}
        >
          {t('retry')}
        </Button>
      </div>
    );
  }

  const active =
    status.mode === 'active' && remainingMinutes(status.expiresAt, now) > 0;
  const effectiveMode =
    status.mode === 'active' && !active ? 'read-only' : status.mode;
  const label = active
    ? t('activeLabel')
    : effectiveMode === 'in-use'
      ? t('inUseLabel')
      : effectiveMode === 'cleanup-blocked'
        ? t('cleanupBlockedLabel')
        : t('readOnlyLabel');

  return (
    <div className="border-b bg-card px-4 py-3">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-md bg-primary/10 p-2 text-primary">
            <FlaskConical className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{t('portfolioTitle')}</span>
              <Badge variant={active ? 'default' : 'secondary'}>{label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {active
                ? t('activeDescription')
                : effectiveMode === 'in-use'
                  ? t('inUseDescription')
                  : effectiveMode === 'cleanup-blocked'
                    ? t('cleanupBlockedDescription')
                    : t('readOnlyDescription')}
            </p>
            {active && (
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {t('activeQuota', {
                  minutes: remainingMinutes(status.expiresAt, now),
                  changes: status.remainingMutations,
                })}
              </p>
            )}
          </div>
        </div>
        {active ? (
          <Button
            size="sm"
            variant="outline"
            disabled={finishMutation.isPending}
            onClick={() => finishMutation.mutate()}
          >
            {t('finish')}
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={
              !['read-only', 'cleanup-blocked'].includes(effectiveMode) ||
              startMutation.isPending
            }
            onClick={() => startMutation.mutate()}
          >
            {t(effectiveMode === 'cleanup-blocked' ? 'retryCleanup' : 'start')}
          </Button>
        )}
      </div>
    </div>
  );
}
