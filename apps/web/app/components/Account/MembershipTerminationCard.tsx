'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarX } from 'lucide-react';
import { MembershipTerminationStatus } from '@club/shared-types/core/enums';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import { ConfirmDialog } from '@app/components/ui/confirm-dialog';
import { Label } from '@app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@app/components/ui/select';
import { Textarea } from '@app/components/ui/textarea';
import {
  eligibleMembershipTerminationDates,
  isEligibleMembershipTerminationDate,
} from '@app/lib/membershipTerminationDates';
import { MembershipTerminationService } from '@app/services/membershipTerminationService';

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function MembershipTerminationCard({
  canRequest = true,
}: {
  canRequest?: boolean;
}) {
  const t = useTranslations('account.membershipTermination');
  const locale = useLocale();
  const termination = MembershipTerminationService.useMine();
  const request = MembershipTerminationService.useRequest();
  const [dateLimit, setDateLimit] = useState(8);
  const dates = useMemo(() => {
    const now = new Date();
    return eligibleMembershipTerminationDates({
      requestedAt: now,
      evaluatedAt: now,
      limit: dateLimit,
    });
  }, [dateLimit]);
  const [endDate, setEndDate] = useState('');
  const [note, setNote] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const rejected =
    termination.data?.status === MembershipTerminationStatus.REJECTED;
  const showRequestForm = canRequest && (!termination.data || rejected);

  const openConfirmation = () => {
    const now = new Date();
    if (
      !endDate ||
      !isEligibleMembershipTerminationDate(endDate, {
        requestedAt: now,
        evaluatedAt: now,
      })
    ) {
      setEndDate('');
      toast.error(t('dateNoLongerAvailable'));
      return;
    }
    setConfirmOpen(true);
  };

  const submit = async () => {
    try {
      await request.mutateAsync({
        request: { effectiveDate: endDate, note: note || undefined },
      });
      toast.success(t('submitted'));
    } catch (error: any) {
      toast.error(error.response?.data?.message ?? error.message ?? t('error'));
      throw error;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarX className="h-5 w-5" />
          {t('title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {termination.isLoading && <p role="status">{t('loading')}</p>}
        {termination.isError && !termination.data && (
          <div role="alert" className="space-y-2">
            <p className="text-sm text-destructive">{t('loadError')}</p>
            <Button
              variant="outline"
              onClick={() => void termination.refetch()}
            >
              {t('retry')}
            </Button>
          </div>
        )}
        {termination.data && (
          <div className="space-y-2 rounded-md border p-4">
            <p className="font-medium">
              {t(`status.${termination.data.status}`)}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(
                termination.data.status === MembershipTerminationStatus.APPROVED
                  ? 'membershipEndsOn'
                  : 'requestedEndDate'
              )}
              : {formatDate(termination.data.endDate, locale)}
            </p>
            {rejected && termination.data.rejectionReason && (
              <p className="text-sm">
                {t('rejectionReason')}: {termination.data.rejectionReason}
              </p>
            )}
            {!rejected && (
              <p className="text-sm text-muted-foreground">
                {t('alreadySubmitted')}
              </p>
            )}
          </div>
        )}
        {!termination.isLoading &&
          !termination.isError &&
          !termination.data &&
          !canRequest && (
            <p className="text-sm text-muted-foreground">{t('unavailable')}</p>
          )}
        {!termination.isLoading && !termination.isError && showRequestForm && (
          <div className="space-y-4">
            {rejected && (
              <p className="text-sm font-medium">{t('requestAgain')}</p>
            )}
            <p className="text-sm text-muted-foreground">{t('description')}</p>
            <div className="space-y-2">
              <Label htmlFor="termination-end-date">
                {t('requestedEndDate')}
              </Label>
              <Select value={endDate} onValueChange={setEndDate}>
                <SelectTrigger id="termination-end-date">
                  <SelectValue placeholder={t('selectDate')} />
                </SelectTrigger>
                <SelectContent>
                  {dates.map((date, index) => (
                    <SelectItem key={date} value={date}>
                      {formatDate(date, locale)}
                      {index === 0 ? ` · ${t('earliestAvailable')}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="link"
                className="h-auto px-0"
                onClick={() => setDateLimit((current) => current + 8)}
              >
                {t('showLaterDates')}
              </Button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="termination-note">{t('note')}</Label>
              <Textarea
                id="termination-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={1000}
              />
            </div>
            <Button
              onClick={openConfirmation}
              disabled={!endDate || request.isPending}
            >
              {request.isPending ? t('submitting') : t('submit')}
            </Button>
          </div>
        )}
      </CardContent>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('confirmTitle')}
        description={t('confirmDescription', {
          date: endDate ? formatDate(endDate, locale) : '',
        })}
        confirmText={t('confirmSubmit')}
        cancelText={t('cancel')}
        pendingText={t('submitting')}
        onConfirm={submit}
      />
    </Card>
  );
}
