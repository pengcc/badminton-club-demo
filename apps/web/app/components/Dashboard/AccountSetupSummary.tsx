'use client';

import { useTranslations } from 'next-intl';
import { Mail, ShieldCheck, TriangleAlert } from 'lucide-react';
import type { AccountSetupSummary as AccountSetupSummaryValue } from '@club/shared-types/api/accountOnboarding';
import { AccountOnboardingStatus } from '@club/shared-types/core/enums';
import { Button } from '@app/components/ui/button';

interface AccountSetupSummaryProps {
  summary: AccountSetupSummaryValue;
  accountName: string;
  onReissue: (userId: string) => void;
  isReissuing?: boolean;
  isReissueDisabled?: boolean;
  presentation?: 'default' | 'compact-status';
}

export function AccountSetupSummary({
  summary,
  accountName,
  onReissue,
  isReissuing = false,
  isReissueDisabled = false,
  presentation = 'default',
}: AccountSetupSummaryProps) {
  const t = useTranslations('common.accountSetup');
  const isReady =
    summary.accountOnboardingStatus === AccountOnboardingStatus.READY;
  const state = isReady
    ? 'ready'
    : summary.accountOnboardingStatus ===
        AccountOnboardingStatus.PASSWORD_SETUP_EXPIRED
      ? 'expired'
      : 'required';
  const StateIcon = isReady ? ShieldCheck : TriangleAlert;
  const isCompactStatus = presentation === 'compact-status';

  return (
    <div
      className={`flex flex-col items-start gap-1.5 text-sm ${isCompactStatus ? 'min-w-0' : 'min-w-44'}`}
    >
      <span className="flex items-center gap-1.5 font-medium" role="status">
        <StateIcon
          className={
            isReady ? 'h-4 w-4 text-primary' : 'h-4 w-4 text-amber-600'
          }
          aria-hidden="true"
        />
        {t(`state.${state}`)}
      </span>
      {!isReady && (
        <span className="text-xs text-muted-foreground">
          {t(`delivery.${summary.deliveryStatus}`)}
        </span>
      )}
      {!isCompactStatus && summary.reissueAvailable && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onReissue(summary.userId)}
          disabled={isReissueDisabled}
          aria-label={t('reissueFor', { name: accountName })}
          className="h-8"
        >
          <Mail className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
          {isReissuing ? t('reissuing') : t('reissue')}
        </Button>
      )}
    </div>
  );
}
