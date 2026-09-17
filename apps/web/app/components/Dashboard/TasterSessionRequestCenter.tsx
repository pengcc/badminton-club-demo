'use client';

import { useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Archive, Mail, RotateCcw, Send, X } from 'lucide-react';
import type {
  TasterSessionDeclineReason,
  TasterSessionRequestResponse,
  TasterSessionStatus,
} from '@club/shared-types/api/tasterSessionRequest';
import { tasterSessionRequestResponseSchema } from '@club/shared-types/api/tasterSessionRequest';
import { formatStoredTasterSessionPreferenceDetails } from '@club/shared-types/view/tasterSessionRequest';
import { Button } from '@app/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Modal } from '@app/components/ui/modal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@app/components/ui/select';
import { TasterSessionRequestService } from '@app/services/tasterSessionRequestService';

type Disposition = 'invited' | 'declined';

function isStateConflict(error: unknown): boolean {
  const candidate = error as {
    response?: { data?: { code?: string } };
  };
  return candidate.response?.data?.code === 'TASTER_SESSION_STATE_CONFLICT';
}

function latestStateConflict(
  error: unknown
): TasterSessionRequestResponse | undefined {
  const candidate = error as {
    response?: { data?: { details?: { latest?: unknown } } };
  };
  const parsed = tasterSessionRequestResponseSchema.safeParse(
    candidate.response?.data?.details?.latest
  );
  return parsed.success ? parsed.data : undefined;
}

export default function TasterSessionRequestCenter() {
  const t = useTranslations('common.tasterSession.admin');
  const tLanguage = useTranslations('dashboard.languageOptions');
  const locale = useLocale();
  const [status, setStatus] = useState<TasterSessionStatus | 'all'>('all');
  const [playerLevel, setPlayerLevel] = useState<
    'beginner' | 'experienced' | 'all'
  >('all');
  const [archived, setArchived] = useState<'exclude' | 'include' | 'only'>(
    'exclude'
  );
  const [selected, setSelected] = useState<TasterSessionRequestResponse | null>(
    null
  );
  const [disposition, setDisposition] = useState<Disposition>('invited');
  const [adminNotes, setAdminNotes] = useState('');
  const [declineReason, setDeclineReason] =
    useState<TasterSessionDeclineReason>('no_capacity');
  const [declineReasonDetails, setDeclineReasonDetails] = useState('');
  const [sendEmail, setSendEmail] = useState(true);
  const [actionError, setActionError] = useState<string>();
  const dispositionTrigger = useRef<HTMLButtonElement | null>(null);

  const query = {
    status,
    playerLevel,
    archived,
    limit: 50,
    offset: 0,
  } as const;
  const requests = TasterSessionRequestService.useList(query);
  const stats = TasterSessionRequestService.useStats();
  const dispose = TasterSessionRequestService.useDisposition();
  const archiveRequest = TasterSessionRequestService.useArchive();
  const retryDelivery = TasterSessionRequestService.useRetryDelivery();

  function closeDisposition() {
    setSelected(null);
    setDisposition('invited');
    setAdminNotes('');
    setDeclineReason('no_capacity');
    setDeclineReasonDetails('');
    setSendEmail(true);
    setActionError(undefined);
    requestAnimationFrame(() => dispositionTrigger.current?.focus());
  }

  async function submitDisposition() {
    if (!selected) return;
    setActionError(undefined);
    try {
      await dispose.mutateAsync({
        id: selected.id,
        command: {
          expectedVersion: selected.version,
          disposition,
          adminNotes: adminNotes || undefined,
          declineReason: disposition === 'declined' ? declineReason : undefined,
          declineReasonDetails:
            disposition === 'declined' && declineReason === 'other'
              ? declineReasonDetails
              : undefined,
          sendEmail,
        },
      });
      closeDisposition();
    } catch (error) {
      const latest = latestStateConflict(error);
      if (latest?.status === 'pending') {
        setSelected(latest);
      } else if (latest) {
        closeDisposition();
      }
      setActionError(
        t(isStateConflict(error) ? 'actionConflict' : 'actionFailed')
      );
    }
  }

  async function toggleArchive(request: TasterSessionRequestResponse) {
    setActionError(undefined);
    try {
      await archiveRequest.mutateAsync({
        id: request.id,
        expectedVersion: request.version,
        archived: !request.archived,
      });
    } catch (error) {
      setActionError(
        t(isStateConflict(error) ? 'actionConflict' : 'actionFailed')
      );
    }
  }

  async function retry(request: TasterSessionRequestResponse) {
    setActionError(undefined);
    try {
      await retryDelivery.mutateAsync({
        id: request.id,
        expectedVersion: request.version,
      });
    } catch {
      setActionError(t('retryFailed'));
    }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          {stats.data && (
            <div className="grid grid-cols-2 gap-3 pt-3 md:grid-cols-5">
              {(
                ['total', 'pending', 'invited', 'declined', 'archived'] as const
              ).map((key) => (
                <div key={key} className="rounded-md bg-muted p-3">
                  <div className="text-sm text-muted-foreground">
                    {t(`stats.${key}`)}
                  </div>
                  <div className="text-2xl font-semibold">
                    {stats.data[key]}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="grid gap-3 pt-3 sm:grid-cols-3">
            <div className="text-sm">
              <span id="taster-status-filter-label" className="mb-1 block">
                {t('filters.status')}
              </span>
              <Select
                value={status}
                onValueChange={(value) =>
                  setStatus(value as TasterSessionStatus | 'all')
                }
              >
                <SelectTrigger
                  aria-labelledby="taster-status-filter-label"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.all')}</SelectItem>
                  <SelectItem value="pending">{t('status.pending')}</SelectItem>
                  <SelectItem value="invited">{t('status.invited')}</SelectItem>
                  <SelectItem value="declined">
                    {t('status.declined')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm">
              <span id="taster-level-filter-label" className="mb-1 block">
                {t('filters.level')}
              </span>
              <Select
                value={playerLevel}
                onValueChange={(value) =>
                  setPlayerLevel(value as 'beginner' | 'experienced' | 'all')
                }
              >
                <SelectTrigger
                  aria-labelledby="taster-level-filter-label"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('filters.all')}</SelectItem>
                  <SelectItem value="beginner">
                    {t('levels.beginner')}
                  </SelectItem>
                  <SelectItem value="experienced">
                    {t('levels.experienced')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm">
              <span id="taster-archive-filter-label" className="mb-1 block">
                {t('filters.archive')}
              </span>
              <Select
                value={archived}
                onValueChange={(value) =>
                  setArchived(value as 'exclude' | 'include' | 'only')
                }
              >
                <SelectTrigger
                  aria-labelledby="taster-archive-filter-label"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exclude">
                    {t('filters.activeOnly')}
                  </SelectItem>
                  <SelectItem value="include">
                    {t('filters.includeArchived')}
                  </SelectItem>
                  <SelectItem value="only">
                    {t('filters.archivedOnly')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {actionError && (
            <p
              role="alert"
              className="mb-4 rounded-md border border-destructive/40 p-3 text-sm text-destructive"
            >
              {actionError}
            </p>
          )}
          {requests.isPending && <p>{t('loading')}</p>}
          {requests.isError && (
            <div>
              <p className="text-destructive">{t('loadFailed')}</p>
              <Button
                className="mt-2"
                variant="outline"
                onClick={() => requests.refetch()}
              >
                {t('retry')}
              </Button>
            </div>
          )}
          {requests.data?.requests.length === 0 && <p>{t('empty')}</p>}
          {requests.data && requests.data.requests.length > 0 && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">{t('columns.visitor')}</th>
                    <th className="p-3">{t('columns.preference')}</th>
                    <th className="p-3">{t('columns.status')}</th>
                    <th className="p-3">{t('columns.delivery')}</th>
                    <th className="p-3">{t('columns.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.data.requests.map((request) => (
                    <tr key={request.id} className="border-b last:border-0">
                      <td className="p-3">
                        <div className="font-medium">{request.name}</div>
                        <div className="text-muted-foreground">
                          {request.email}
                        </div>
                        <div className="capitalize text-muted-foreground">
                          {t(`levels.${request.playerLevel}`)}
                        </div>
                        {request.message && (
                          <div className="mt-1 max-w-xs text-xs text-muted-foreground">
                            {t('messageLabel')}: {request.message}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {request.preference ? (
                          <>
                            <div>
                              {formatStoredTasterSessionPreferenceDetails(
                                request.preference,
                                locale as 'de' | 'en' | 'zh'
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t('nonBinding')}
                            </div>
                          </>
                        ) : (
                          t('noPreference')
                        )}
                      </td>
                      <td className="p-3">
                        <span className="capitalize">
                          {t(`status.${request.status}`)}
                        </span>
                        {request.archived && (
                          <span className="ml-2 rounded bg-muted px-2 py-1 text-xs">
                            {t('archived')}
                          </span>
                        )}
                        {request.declineReason && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            {t('declineReason')}:{' '}
                            {t(
                              request.declineReason === 'no_capacity'
                                ? 'declineReasons.noCapacity'
                                : 'declineReasons.other'
                            )}
                            {request.declineReasonDetails
                              ? ` — ${request.declineReasonDetails}`
                              : ''}
                          </div>
                        )}
                        {request.adminNotes && (
                          <div className="mt-1 max-w-xs text-xs text-muted-foreground">
                            {t('notesLabel')}: {request.adminNotes}
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        {t(`delivery.${request.delivery.status}`)}
                        {request.delivery.retryAvailable && (
                          <>
                            {request.delivery.status === 'uncertain' && (
                              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                                {t('uncertainRetryWarning')}
                              </p>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ml-2"
                              onClick={() => retry(request)}
                              disabled={retryDelivery.isPending}
                            >
                              <Mail className="mr-1 h-4 w-4" />
                              {t('retryEmail')}
                            </Button>
                          </>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          {request.status === 'pending' && (
                            <Button
                              size="sm"
                              onClick={(event) => {
                                dispositionTrigger.current =
                                  event.currentTarget;
                                setSelected(request);
                              }}
                            >
                              <Send className="mr-1 h-4 w-4" />
                              {t('disposition')}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleArchive(request)}
                            disabled={archiveRequest.isPending}
                          >
                            {request.archived ? (
                              <RotateCcw className="mr-1 h-4 w-4" />
                            ) : (
                              <Archive className="mr-1 h-4 w-4" />
                            )}
                            {request.archived ? t('unarchive') : t('archive')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Modal
        isOpen={selected !== null}
        onClose={closeDisposition}
        ariaLabel={t('dispositionTitle')}
      >
        <Card className="w-full max-w-xl">
          <CardHeader>
            <CardTitle id="taster-disposition-title">
              {t('dispositionTitle')}
            </CardTitle>
            <CardAction>
              <Button
                variant="ghost"
                size="icon"
                onClick={closeDisposition}
                aria-label={t('close')}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="block text-sm">
              <span id="taster-outcome-label" className="mb-1 block">
                {t('outcome')}
              </span>
              <Select
                value={disposition}
                onValueChange={(value) => setDisposition(value as Disposition)}
              >
                <SelectTrigger
                  autoFocus
                  aria-labelledby="taster-outcome-label"
                  className="w-full"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="invited">{t('status.invited')}</SelectItem>
                  <SelectItem value="declined">
                    {t('status.declined')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {disposition === 'declined' && (
              <>
                <div className="block text-sm">
                  <span id="taster-decline-reason-label" className="mb-1 block">
                    {t('declineReason')}
                  </span>
                  <Select
                    value={declineReason}
                    onValueChange={(value) =>
                      setDeclineReason(value as TasterSessionDeclineReason)
                    }
                  >
                    <SelectTrigger
                      aria-labelledby="taster-decline-reason-label"
                      className="w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no_capacity">
                        {t('declineReasons.noCapacity')}
                      </SelectItem>
                      <SelectItem value="other">
                        {t('declineReasons.other')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {declineReason === 'other' && (
                  <div className="text-sm">
                    <label
                      htmlFor="taster-decline-reason-details"
                      className="mb-1 block"
                    >
                      {t('declineReasonDetails')}
                    </label>
                    <textarea
                      id="taster-decline-reason-details"
                      value={declineReasonDetails}
                      onChange={(event) =>
                        setDeclineReasonDetails(event.target.value)
                      }
                      className="w-full rounded-md border p-2"
                      rows={3}
                      aria-describedby="taster-decline-reason-language"
                    />
                    <p
                      id="taster-decline-reason-language"
                      className="mt-2 text-muted-foreground"
                    >
                      {selected
                        ? t('recipientLanguageGuidance', {
                            language: tLanguage(selected.locale),
                          })
                        : null}
                    </p>
                  </div>
                )}
              </>
            )}
            <div className="text-sm">
              <label htmlFor="taster-admin-notes" className="mb-1 block">
                {t('adminNotes')}
              </label>
              <textarea
                id="taster-admin-notes"
                value={adminNotes}
                onChange={(event) => setAdminNotes(event.target.value)}
                className="w-full rounded-md border p-2"
                rows={4}
                aria-describedby="taster-admin-notes-guidance"
              />
              <p
                id="taster-admin-notes-guidance"
                className="mt-2 text-muted-foreground"
              >
                {t('adminNotesGuidance')}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(event) => setSendEmail(event.target.checked)}
              />
              {t('sendEmail')}
            </label>
            <p className="text-sm text-muted-foreground">
              {t('terminalWarning')}
            </p>
            {actionError && (
              <p role="alert" className="text-sm text-destructive">
                {actionError}
              </p>
            )}
            <Button
              className="w-full"
              onClick={submitDisposition}
              disabled={
                dispose.isPending ||
                (disposition === 'declined' &&
                  declineReason === 'other' &&
                  !declineReasonDetails.trim())
              }
            >
              {dispose.isPending ? t('saving') : t('confirm')}
            </Button>
          </CardContent>
        </Card>
      </Modal>
    </>
  );
}
