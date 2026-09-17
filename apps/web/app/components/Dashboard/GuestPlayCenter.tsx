'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@app/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { GuestPlayService } from '@app/services/guestPlayService';
import GuestPlayRequestForm from './GuestPlayRequestForm';

export default function GuestPlayCenter() {
  const t = useTranslations('common.guestPlay');
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const requests = GuestPlayService.useMyRequests();
  const cancelRequest = GuestPlayService.useCancelRequest();

  async function cancel(id: string, expectedVersion: number) {
    try {
      await cancelRequest.mutateAsync({ id, expectedVersion });
      setMessage(t('success.cancelled'));
    } catch (error) {
      const responseStatus =
        typeof error === 'object' && error !== null && 'response' in error
          ? (
              error as {
                response?: { status?: number };
              }
            ).response?.status
          : undefined;

      if (responseStatus === 409) {
        const refreshed = await requests.refetch();

        setMessage(
          refreshed.isSuccess ? t('errors.conflict') : t('errors.cancel')
        );
        return;
      }

      setMessage(t('errors.cancel'));
    }
  }

  return (
    <div className="space-y-5">
      {showForm ? (
        <GuestPlayRequestForm
          onCancel={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false);
            setMessage(t('success.description'));
          }}
        />
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>{t('myRequests.title')}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('myRequests.subtitle')}
              </p>
            </div>
            <Button onClick={() => setShowForm(true)}>
              {t('myRequests.newRequest')}
            </Button>
          </CardHeader>
        </Card>
      )}

      {message && (
        <p className="rounded-md border bg-muted/30 p-3 text-sm" role="status">
          {message}
        </p>
      )}
      {requests.isPending ? (
        <Card>
          <CardContent
            className="p-6 text-sm text-muted-foreground"
            role="status"
          >
            {t('states.loadingRequests')}
          </CardContent>
        </Card>
      ) : requests.isError && !requests.data ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-red-700" role="alert">
              {t('errors.requests')}
            </p>
            <Button
              className="mt-3"
              variant="outline"
              onClick={() => requests.refetch()}
            >
              {t('actions.retry')}
            </Button>
          </CardContent>
        </Card>
      ) : requests.data?.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            {t('myRequests.noRequests')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.data?.map((request) => (
            <Card key={request.id}>
              <CardContent className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-start">
                <div className="space-y-2">
                  <span className="inline-flex rounded-full border px-2 py-1 text-xs font-medium">
                    {t(`status.${request.status}`)}
                  </span>
                  <p className="font-medium">
                    {request.appointment.localDate} ·{' '}
                    {request.appointment.startTime}–
                    {request.appointment.endTime}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {request.appointment.locationName} ·{' '}
                    {t('form.guestOption', { count: request.guestCount })}
                  </p>
                  {request.message && (
                    <p className="whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">
                      {request.message}
                    </p>
                  )}
                </div>
                {request.status === 'pending' && (
                  <Button
                    variant="outline"
                    disabled={cancelRequest.isPending}
                    onClick={() => cancel(request.id, request.version)}
                  >
                    {t('actions.cancelRequest')}
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {requests.data && requests.isError && (
        <p className="text-sm text-amber-800" role="status">
          {t('states.staleRequests')}
        </p>
      )}
    </div>
  );
}
