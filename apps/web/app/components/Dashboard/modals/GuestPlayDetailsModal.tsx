'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@app/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@app/components/ui/dialog';
import { GuestPlayService } from '@app/services/guestPlayService';
import type {
  GuestPlayAdminResponse,
  GuestPlayNotificationKind,
} from '@club/shared-types/api/guestPlay';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  request: GuestPlayAdminResponse | null;
}

function commandError(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (
      error as {
        response?: { data?: { error?: string; message?: string } };
      }
    ).response;
    return response?.data?.error ?? response?.data?.message ?? fallback;
  }
  return fallback;
}

export default function GuestPlayDetailsModal({
  isOpen,
  onClose,
  request: initial,
}: Props) {
  const t = useTranslations('common.guestPlay');
  const detail = GuestPlayService.useRequestById(
    isOpen ? (initial?.id ?? null) : null
  );
  const request = detail.data ?? initial;
  const decide = GuestPlayService.useDecision();
  const correct = GuestPlayService.useCorrection();
  const archive = GuestPlayService.useArchive();
  const restore = GuestPlayService.useRestore();
  const retry = GuestPlayService.useRetryNotification();
  const [notes, setNotes] = useState(initial?.adminNotes ?? '');
  const [reason, setReason] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  if (!isOpen || !request) return null;
  const isPast = new Date(request.appointment.startAt).getTime() <= Date.now();
  const pending =
    decide.isPending ||
    correct.isPending ||
    archive.isPending ||
    restore.isPending ||
    retry.isPending;

  async function run(action: () => Promise<unknown>, success: string) {
    try {
      await action();
      setFeedback(success);
      await detail.refetch();
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
        const refreshed = await detail.refetch();

        if (!refreshed.isSuccess || !refreshed.data) {
          setFeedback(t('errors.command'));
          return;
        }

        setNotes(refreshed.data.adminNotes ?? '');
        setFeedback(t('errors.conflict'));
        return;
      }

      setFeedback(commandError(error, t('errors.command')));
    }
  }
  const notificationEntries = Object.entries(request.notifications) as [
    GuestPlayNotificationKind,
    GuestPlayAdminResponse['notifications'][GuestPlayNotificationKind],
  ][];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        closeLabel={t('actions.close')}
        className="max-h-[90vh] overflow-hidden sm:max-w-3xl"
      >
        <DialogHeader>
          <DialogTitle>{t('admin.detailsTitle')}</DialogTitle>
          <DialogDescription className="sr-only">
            {t('admin.requestDetails')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 overflow-y-auto pr-1">
          <section
            className="grid gap-3 sm:grid-cols-2"
            aria-label={t('admin.requestDetails')}
          >
            <div>
              <p className="text-xs text-muted-foreground">
                {t('admin.member')}
              </p>
              <p className="font-medium">{request.memberName}</p>
              <p className="text-sm">{request.memberEmail}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {t('admin.status')}
              </p>
              <p>
                {t(`status.${request.status}`)}
                {request.archived ? ` · ${t('admin.archived')}` : ''}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {t('selectSession')}
              </p>
              <p>
                {request.appointment.localDate} ·{' '}
                {request.appointment.startTime}–{request.appointment.endTime}
              </p>
              <p className="text-sm">
                {request.appointment.locationName},{' '}
                {request.appointment.locationAddress}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('guestCount')}</p>
              <p>{request.guestCount}</p>
            </div>
          </section>
          {request.message && (
            <section>
              <h3 className="text-sm font-medium">{t('form.messageLabel')}</h3>
              <p className="mt-1 whitespace-pre-wrap rounded-md bg-muted/40 p-3 text-sm">
                {request.message}
              </p>
            </section>
          )}

          <section className="space-y-3">
            <h3 className="font-medium">{t('admin.actions')}</h3>
            <label className="block text-sm" htmlFor="guest-play-notes">
              {t('admin.internalNotes')}
            </label>
            <textarea
              id="guest-play-notes"
              className="min-h-20 w-full rounded-md border border-input p-3 text-sm"
              value={notes}
              maxLength={1000}
              onChange={(event) => setNotes(event.target.value)}
            />
            {request.status === 'pending' && !request.archived && (
              <div className="flex flex-wrap gap-2">
                <Button
                  disabled={pending || isPast}
                  onClick={() =>
                    run(
                      () =>
                        decide.mutateAsync({
                          id: request.id,
                          command: {
                            expectedVersion: request.version,
                            decision: 'approved',
                            adminNotes: notes.trim() || undefined,
                          },
                        }),
                      t('success.command')
                    )
                  }
                >
                  {t('actions.approve')}
                </Button>
                <Button
                  variant="destructive"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () =>
                        decide.mutateAsync({
                          id: request.id,
                          command: {
                            expectedVersion: request.version,
                            decision: 'declined',
                            adminNotes: notes.trim() || undefined,
                          },
                        }),
                      t('success.command')
                    )
                  }
                >
                  {t('actions.decline')}
                </Button>
                {isPast && (
                  <p className="w-full text-sm text-amber-800">
                    {t('admin.pastApprovalBlocked')}
                  </p>
                )}
              </div>
            )}
            {(request.status === 'approved' || request.status === 'declined') &&
              !request.archived && (
                <>
                  <label className="block text-sm" htmlFor="guest-play-reason">
                    {t('admin.correctionReason')}
                  </label>
                  <input
                    id="guest-play-reason"
                    className="h-10 w-full rounded-md border border-input px-3 text-sm"
                    value={reason}
                    maxLength={500}
                    onChange={(event) => setReason(event.target.value)}
                  />
                  <Button
                    variant="outline"
                    disabled={
                      pending ||
                      !reason.trim() ||
                      (request.status === 'declined' && isPast)
                    }
                    onClick={() =>
                      run(
                        () =>
                          correct.mutateAsync({
                            id: request.id,
                            command: {
                              expectedVersion: request.version,
                              decision:
                                request.status === 'approved'
                                  ? 'declined'
                                  : 'approved',
                              reason: reason.trim(),
                              adminNotes: notes.trim() || undefined,
                            },
                          }),
                        t('success.command')
                      )
                    }
                  >
                    {request.status === 'approved'
                      ? t('actions.correctToDeclined')
                      : t('actions.correctToApproved')}
                  </Button>
                </>
              )}
            {!request.archived && request.status !== 'pending' && (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      archive.mutateAsync({
                        id: request.id,
                        expectedVersion: request.version,
                      }),
                    t('success.command')
                  )
                }
              >
                {t('actions.archive')}
              </Button>
            )}
            {request.archived && (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(
                    () =>
                      restore.mutateAsync({
                        id: request.id,
                        expectedVersion: request.version,
                      }),
                    t('success.command')
                  )
                }
              >
                {t('actions.restore')}
              </Button>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="font-medium">{t('admin.notifications')}</h3>
            {notificationEntries.map(([kind, entry]) => (
              <div
                className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                key={kind}
              >
                <div>
                  <p className="text-sm font-medium">
                    {t(`admin.notificationKinds.${kind}`)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t(`admin.notificationStatus.${entry.status}`)} ·{' '}
                    {t('admin.attempts', { count: entry.attempts })}
                  </p>
                  {entry.error && (
                    <p className="text-sm text-amber-800">
                      {t('admin.deliveryWarning')}
                    </p>
                  )}
                </div>
                {entry.retryAvailable && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() =>
                      run(
                        () =>
                          retry.mutateAsync({
                            id: request.id,
                            notification: kind,
                            expectedVersion: request.version,
                          }),
                        t('success.retry')
                      )
                    }
                  >
                    {t('actions.retryDelivery')}
                  </Button>
                )}
              </div>
            ))}
          </section>
          {feedback && (
            <p className="rounded-md bg-muted/50 p-3 text-sm" role="status">
              {feedback}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
