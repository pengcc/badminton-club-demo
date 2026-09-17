'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@app/components/ui/button';
import { useTranslations } from 'next-intl';

export function PublicationFailureNotice({
  visible,
  retrying,
  onRetry,
}: {
  visible: boolean;
  retrying: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations('dashboard.cms.publication');
  if (!visible) return null;

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
        <div>
          <p className="font-medium">{t('title')}</p>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={retrying}
        onClick={onRetry}
      >
        <RefreshCw className={retrying ? 'animate-spin' : ''} />
        {retrying ? t('retrying') : t('retry')}
      </Button>
    </div>
  );
}
