'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
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
  CardDescription,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { GuestPlayService } from '@app/services/guestPlayService';
import type { GuestPlayLocale } from '@club/shared-types/api/guestPlay';

interface Props {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const CLEAR_OPPORTUNITY_VALUE = '__clear-opportunity__';

function safeError(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (
      error as { response?: { data?: { error?: string; message?: string } } }
    ).response;
    return response?.data?.error ?? response?.data?.message ?? fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

export default function GuestPlayRequestForm({ onSuccess, onCancel }: Props) {
  const t = useTranslations('common.guestPlay');
  const locale = useLocale() as GuestPlayLocale;
  const opportunities = GuestPlayService.useOpportunities(locale);
  const createRequest = GuestPlayService.useCreateRequest();
  const [selection, setSelection] = useState('');
  const [guestCount, setGuestCount] = useState(1);
  const [message, setMessage] = useState('');
  const [feedback, setFeedback] = useState<{
    tone: 'error' | 'success';
    text: string;
  } | null>(null);

  const selected = opportunities.data?.find(
    (option) =>
      `${option.locationId}:${option.timeSlotId}:${option.localDate}` ===
      selection
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) {
      setFeedback({ tone: 'error', text: t('form.selectRequired') });
      return;
    }
    try {
      await createRequest.mutateAsync({
        locationId: selected.locationId,
        timeSlotId: selected.timeSlotId,
        localDate: selected.localDate,
        guestCount,
        message: message.trim() || undefined,
        locale,
      });
      setFeedback({ tone: 'success', text: t('success.description') });
      setSelection('');
      setGuestCount(1);
      setMessage('');
      onSuccess?.();
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: safeError(error, t('errors.submit')),
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-5" onSubmit={submit}>
          <div>
            <label
              className="mb-2 block text-sm font-medium"
              htmlFor="guest-play-opportunity"
            >
              {t('selectSession')}
            </label>
            {opportunities.isPending ? (
              <p
                className="rounded-md border p-3 text-sm text-muted-foreground"
                role="status"
              >
                {t('states.loadingOpportunities')}
              </p>
            ) : opportunities.isError && !opportunities.data ? (
              <div
                className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
                role="alert"
              >
                <p>{t('errors.opportunities')}</p>
                <Button
                  className="mt-2"
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => opportunities.refetch()}
                >
                  {t('actions.retry')}
                </Button>
              </div>
            ) : opportunities.data?.length === 0 ? (
              <p className="rounded-md border p-3 text-sm text-muted-foreground">
                {t('states.noOpportunities')}
              </p>
            ) : (
              <Select
                value={selection}
                onValueChange={(value) =>
                  setSelection(value === CLEAR_OPPORTUNITY_VALUE ? '' : value)
                }
                required
              >
                <SelectTrigger
                  id="guest-play-opportunity"
                  className="h-11 w-full min-w-0"
                >
                  <SelectValue placeholder={t('form.selectPlaceholder')} />
                </SelectTrigger>
                <SelectContent className="max-h-[var(--radix-select-content-available-height)] max-w-[calc(100vw-2rem)]">
                  <SelectItem value={CLEAR_OPPORTUNITY_VALUE}>
                    {t('form.selectPlaceholder')}
                  </SelectItem>
                  {opportunities.data?.map((option) => {
                    const key = `${option.locationId}:${option.timeSlotId}:${option.localDate}`;
                    return (
                      <SelectItem
                        className="whitespace-normal"
                        key={key}
                        value={key}
                      >
                        {option.localDate} · {option.startTime}–{option.endTime}{' '}
                        · {option.locationName}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
            {selected?.participationNote && (
              <p className="mt-2 rounded-md bg-blue-50 p-3 text-sm text-blue-900">
                {selected.participationNote}
              </p>
            )}
          </div>

          <div>
            <label
              className="mb-2 block text-sm font-medium"
              htmlFor="guest-count"
            >
              {t('guestCount')}
            </label>
            <Select
              value={String(guestCount)}
              onValueChange={(value) => setGuestCount(Number(value))}
            >
              <SelectTrigger id="guest-count" className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((count) => (
                  <SelectItem key={count} value={String(count)}>
                    {t('form.guestOption', { count })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label
              className="mb-2 block text-sm font-medium"
              htmlFor="guest-message"
            >
              {t('form.messageLabel')}
            </label>
            <textarea
              id="guest-message"
              className="min-h-24 w-full rounded-md border border-input bg-background p-3 text-sm"
              maxLength={1000}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={t('form.messagePlaceholder')}
            />
          </div>

          {feedback && (
            <p
              className={
                feedback.tone === 'error'
                  ? 'text-sm text-red-700'
                  : 'text-sm text-green-700'
              }
              role={feedback.tone === 'error' ? 'alert' : 'status'}
            >
              {feedback.text}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {t('permissionNotice')}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                {t('actions.close')}
              </Button>
            )}
            <Button
              type="submit"
              disabled={createRequest.isPending || !selected}
            >
              {createRequest.isPending
                ? t('form.submitting')
                : t('form.submit')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
