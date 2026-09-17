'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import {
  MemberListFilter,
  MembershipTerminationSource,
  MembershipTerminationStatus,
} from '@club/shared-types/core/enums';
import type { MembershipTerminationResponse } from '@club/shared-types/api/membershipTermination';
import type { RecordMembershipTerminationInput } from '@club/shared-types/schemas';
import type { UserView } from '@club/shared-types/view/user';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import {
  ConfirmDialog,
  useConfirmDialog,
} from '@app/components/ui/confirm-dialog';
import { Input } from '@app/components/ui/input';
import { Label } from '@app/components/ui/label';
import { Textarea } from '@app/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@app/components/ui/select';
import {
  eligibleMembershipTerminationDates,
  isEligibleMembershipTerminationDate,
} from '@app/lib/membershipTerminationDates';
import { MembershipTerminationService } from '@app/services/membershipTerminationService';
import { UserService } from '@app/services/userService';

type Member = UserView.UserCard;

function message(error: any, fallback: string): string {
  return error?.response?.data?.message ?? error?.message ?? fallback;
}

function formatDate(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function DateChoice({
  id,
  requestedAt,
  value,
  onChange,
}: {
  id: string;
  requestedAt: Date;
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('dashboard.membershipTermination');
  const locale = useLocale();
  const [limit, setLimit] = useState(8);
  const dates = eligibleMembershipTerminationDates({
    requestedAt,
    evaluatedAt: new Date(),
    limit,
  });
  return (
    <div className="space-y-1">
      <Label htmlFor={`${id}-date`}>{t('membershipEndDate')}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={`${id}-date`}>
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
        onClick={() => setLimit((current) => current + 8)}
      >
        {t('showLaterDates')}
      </Button>
    </div>
  );
}

function TodayFields({
  id,
  reason,
  onReasonChange,
  action,
  pending,
  disabled,
}: {
  id: string;
  reason: string;
  onReasonChange: (value: string) => void;
  action: () => void;
  pending: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations('dashboard.membershipTermination');
  return (
    <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
      <div>
        <p className="font-medium">{t('todayExceptionTitle')}</p>
        <p className="text-sm">{t('todayConsequence')}</p>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`${id}-today-reason`}>{t('reason')}</Label>
        <Textarea
          id={`${id}-today-reason`}
          value={reason}
          onChange={(event) => onReasonChange(event.target.value)}
          maxLength={1000}
          required
        />
        <p className="text-xs text-muted-foreground">{t('reasonRequired')}</p>
      </div>
      <Button
        type="button"
        variant="destructive"
        disabled={disabled || !reason.trim() || pending}
        onClick={action}
      >
        {pending ? t('saving') : t('endToday')}
      </Button>
    </div>
  );
}

function MemberPicker({
  id,
  multiple,
  selected,
  onChange,
}: {
  id: string;
  multiple: boolean;
  selected: Member[];
  onChange: (members: Member[]) => void;
}) {
  const t = useTranslations('dashboard.membershipTermination');
  const [search, setSearch] = useState('');
  const members = UserService.useMemberList({
    filter: MemberListFilter.CURRENT,
    search: search.trim() || undefined,
    page: 1,
    pageSize: 20,
  });
  const selectedIds = new Set(selected.map((member) => member.id));
  const results = members.isPlaceholderData ? [] : (members.data?.items ?? []);

  const choose = (member: Member) => {
    if (multiple) {
      if (!selectedIds.has(member.id) && selected.length < 50) {
        onChange([...selected, member]);
      }
      return;
    }
    onChange([member]);
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={`${id}-search`}>{t('memberSearch')}</Label>
      <Input
        id={`${id}-search`}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={t('memberSearchPlaceholder')}
        autoComplete="off"
      />
      {selected.length > 0 && (
        <div className="space-y-2" aria-label={t('selectedMembers')}>
          {selected.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{member.fullName}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {member.email}
                </p>
              </div>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() =>
                  onChange(selected.filter((item) => item.id !== member.id))
                }
                aria-label={t('removeMember', { name: member.fullName })}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {(members.isLoading || members.isPlaceholderData) && (
        <p role="status" className="text-sm text-muted-foreground">
          {t('searchingMembers')}
        </p>
      )}
      {members.isError && !members.data && (
        <div role="alert" className="space-y-2 text-sm">
          <p className="text-destructive">{t('memberSearchError')}</p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void members.refetch()}
          >
            {t('retry')}
          </Button>
        </div>
      )}
      {!members.isLoading && !members.isPlaceholderData && !members.isError && (
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-1">
          {results.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">
              {t('noMembersFound')}
            </p>
          ) : (
            results.map((member) => (
              <Button
                key={member.id}
                type="button"
                variant="ghost"
                className="h-auto w-full justify-start px-3 py-2 text-left"
                disabled={
                  selectedIds.has(member.id) ||
                  (multiple && selected.length >= 50)
                }
                onClick={() => choose(member)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {member.fullName}
                  </span>
                  <span className="block truncate text-sm font-normal text-muted-foreground">
                    {member.email}
                  </span>
                </span>
              </Button>
            ))
          )}
        </div>
      )}
      {multiple && (
        <p className="text-xs text-muted-foreground">
          {t('selectionCount', { count: selected.length })}
        </p>
      )}
    </div>
  );
}

function ApprovalTask({ item }: { item: MembershipTerminationResponse }) {
  const t = useTranslations('dashboard.membershipTermination');
  const locale = useLocale();
  const approve = MembershipTerminationService.useApprove();
  const reject = MembershipTerminationService.useReject();
  const [approvalNote, setApprovalNote] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [todayReason, setTodayReason] = useState('');
  const [error, setError] = useState('');
  const { confirm, confirmProps } = useConfirmDialog({
    confirmText: t('confirm'),
    cancelText: t('cancel'),
    pendingText: t('saving'),
  });
  const requestedDateIsCurrent = isEligibleMembershipTerminationDate(
    item.requestedEffectiveDate,
    { requestedAt: new Date(item.requestedAt), evaluatedAt: new Date() }
  );
  const member = item.memberName ?? item.memberEmail ?? item.userId;

  const run = async (operation: () => Promise<unknown>) => {
    setError('');
    try {
      await operation();
    } catch (cause) {
      setError(message(cause, t('operationError')));
      throw cause;
    }
  };

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div>
        <p className="font-medium">{member}</p>
        <p className="text-sm text-muted-foreground">{item.memberEmail}</p>
      </div>
      <p className="text-sm">
        <span className="text-muted-foreground">{t('requestedEndDate')}:</span>{' '}
        {formatDate(item.requestedEffectiveDate, locale)}
      </p>
      {!requestedDateIsCurrent && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
        >
          {t('staleRequest')}
        </p>
      )}
      {requestedDateIsCurrent && (
        <div className="space-y-2">
          <Label htmlFor={`approval-${item.id}-note`}>
            {t('approvalNote')}
          </Label>
          <Textarea
            id={`approval-${item.id}-note`}
            value={approvalNote}
            onChange={(event) => setApprovalNote(event.target.value)}
            maxLength={1000}
          />
          <Button
            disabled={approve.isPending}
            onClick={() =>
              confirm({
                title: t('approveConfirmTitle'),
                description: t('approveConfirmDescription', {
                  member,
                  date: formatDate(item.requestedEffectiveDate, locale),
                }),
                onConfirm: () =>
                  run(() =>
                    approve.mutateAsync({
                      id: item.id,
                      request: {
                        effectiveTiming: 'scheduled',
                        note: approvalNote || undefined,
                      },
                    })
                  ),
              })
            }
          >
            {approve.isPending ? t('approving') : t('approve')}
          </Button>
        </div>
      )}
      <div className="space-y-2 rounded-md border p-3">
        <Label htmlFor={`rejection-${item.id}`}>{t('rejectionReason')}</Label>
        <Textarea
          id={`rejection-${item.id}`}
          value={rejectionReason}
          onChange={(event) => setRejectionReason(event.target.value)}
          maxLength={1000}
          required
        />
        <Button
          type="button"
          variant="outline"
          disabled={!rejectionReason.trim() || reject.isPending}
          onClick={() =>
            void run(() =>
              reject.mutateAsync({
                id: item.id,
                request: { reason: rejectionReason },
              })
            ).catch(() => undefined)
          }
        >
          {reject.isPending ? t('rejecting') : t('reject')}
        </Button>
      </div>
      {requestedDateIsCurrent && (
        <TodayFields
          id={`approval-${item.id}`}
          reason={todayReason}
          onReasonChange={setTodayReason}
          pending={approve.isPending}
          action={() =>
            confirm({
              title: t('todayConfirmTitle'),
              description: t('todayConfirmMemberDescription', { member }),
              confirmText: t('endToday'),
              variant: 'destructive',
              onConfirm: () =>
                run(() =>
                  approve.mutateAsync({
                    id: item.id,
                    request: {
                      effectiveTiming: 'today',
                      note: todayReason,
                    },
                  })
                ),
            })
          }
        />
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <ConfirmDialog {...confirmProps} />
    </div>
  );
}

export default function MembershipTerminationCenter() {
  const t = useTranslations('dashboard.membershipTermination');
  const locale = useLocale();
  const terminations = MembershipTerminationService.useList();
  const offline = MembershipTerminationService.useRecordOffline();
  const batch = MembershipTerminationService.useRecordBatch();
  const { confirm, confirmProps } = useConfirmDialog({
    confirmText: t('confirm'),
    cancelText: t('cancel'),
    pendingText: t('saving'),
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [offlineMembers, setOfflineMembers] = useState<Member[]>([]);
  const [batchMembers, setBatchMembers] = useState<Member[]>([]);
  const [offlineForm, setOfflineForm] = useState({
    source:
      MembershipTerminationSource.EMAIL as RecordMembershipTerminationInput['source'],
    requestReceivedAt: '',
    endDate: '',
    note: '',
    todayReason: '',
  });
  const [batchForm, setBatchForm] = useState({
    endDate: '',
    note: '',
    todayReason: '',
  });
  const [batchResult, setBatchResult] = useState<{
    createdCount: number;
    failureCount: number;
  } | null>(null);

  const items = terminations.data?.items ?? [];
  const pending = items.filter(
    (item) => item.status === MembershipTerminationStatus.PENDING_REVIEW
  );
  const approved = items.filter(
    (item) => item.status === MembershipTerminationStatus.APPROVED
  );

  const run = async (
    operation: () => Promise<unknown>,
    successText: string
  ) => {
    setError('');
    setSuccess('');
    try {
      await operation();
      setSuccess(successText);
    } catch (cause) {
      setError(message(cause, t('operationError')));
      throw cause;
    }
  };

  const offlineRequestedAt = new Date(offlineForm.requestReceivedAt);
  const offlineMember = offlineMembers[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('description')}</p>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive p-3 text-destructive"
        >
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="rounded-md border p-3">
          {success}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('pendingTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {terminations.isLoading && <p role="status">{t('loading')}</p>}
          {terminations.isError && !terminations.data && (
            <div role="alert" className="space-y-2">
              <p className="text-destructive">{t('loadError')}</p>
              <Button
                variant="outline"
                onClick={() => void terminations.refetch()}
              >
                {t('retry')}
              </Button>
            </div>
          )}
          {!terminations.isLoading &&
            !terminations.isError &&
            pending.length === 0 && <p>{t('emptyPending')}</p>}
          {pending.map((item) => (
            <ApprovalTask key={item.id} item={item} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('approvedTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {approved.length === 0 && <p>{t('emptyApproved')}</p>}
          {approved.map((item) => (
            <div key={item.id} className="rounded-md border p-3">
              <p className="font-medium">
                {item.memberUnavailable
                  ? t('userUnavailable')
                  : (item.memberName ?? item.memberEmail ?? item.userId)}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('membershipEndsOn')}:{' '}
                {item.confirmedEffectiveDate
                  ? formatDate(item.confirmedEffectiveDate, locale)
                  : '—'}
              </p>
              <p className="text-sm">{t('waitingMembershipEnd')}</p>
              {item.lastProcessingFailure && (
                <div
                  role="alert"
                  className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm"
                >
                  <p className="font-medium text-destructive">
                    {t('processingFailureTitle')}
                  </p>
                  <p>{item.lastProcessingFailure.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('processingFailureMeta', {
                      code: item.lastProcessingFailure.code,
                      failedAt: new Date(
                        item.lastProcessingFailure.failedAt
                      ).toLocaleString(),
                    })}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('processingFailureGuidance')}
                  </p>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('offlineTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <MemberPicker
              id="offline-member"
              multiple={false}
              selected={offlineMembers}
              onChange={setOfflineMembers}
            />
            <div className="space-y-1">
              <Label htmlFor="offline-source">{t('source')}</Label>
              <Select
                value={offlineForm.source}
                onValueChange={(source) =>
                  setOfflineForm({
                    ...offlineForm,
                    source:
                      source as RecordMembershipTerminationInput['source'],
                  })
                }
              >
                <SelectTrigger id="offline-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    MembershipTerminationSource.EMAIL,
                    MembershipTerminationSource.PHONE,
                    MembershipTerminationSource.IN_PERSON,
                    MembershipTerminationSource.OTHER,
                  ].map((source) => (
                    <SelectItem key={source} value={source}>
                      {t(`sources.${source}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="offline-received-at">{t('receivedAt')}</Label>
              <Input
                id="offline-received-at"
                type="datetime-local"
                value={offlineForm.requestReceivedAt}
                onChange={(event) =>
                  setOfflineForm({
                    ...offlineForm,
                    requestReceivedAt: event.target.value,
                    endDate: '',
                  })
                }
              />
            </div>
            <DateChoice
              id="offline"
              requestedAt={offlineRequestedAt}
              value={offlineForm.endDate}
              onChange={(endDate) =>
                setOfflineForm({ ...offlineForm, endDate })
              }
            />
            <div className="space-y-1">
              <Label htmlFor="offline-note">{t('note')}</Label>
              <Textarea
                id="offline-note"
                value={offlineForm.note}
                onChange={(event) =>
                  setOfflineForm({ ...offlineForm, note: event.target.value })
                }
                maxLength={1000}
              />
            </div>
            <Button
              disabled={
                offline.isPending ||
                !offlineMember ||
                !offlineForm.requestReceivedAt ||
                !offlineForm.endDate
              }
              onClick={() => {
                const now = new Date();
                if (
                  !isEligibleMembershipTerminationDate(offlineForm.endDate, {
                    requestedAt: offlineRequestedAt,
                    evaluatedAt: now,
                  })
                ) {
                  setOfflineForm({ ...offlineForm, endDate: '' });
                  setError(t('dateNoLongerAvailable'));
                  return;
                }
                confirm({
                  title: t('offlineConfirmTitle'),
                  description: t('offlineConfirmDescription', {
                    member: offlineMember.fullName,
                    date: formatDate(offlineForm.endDate, locale),
                  }),
                  onConfirm: () =>
                    run(async () => {
                      await offline.mutateAsync({
                        request: {
                          userId: offlineMember.id,
                          source: offlineForm.source,
                          requestReceivedAt: offlineRequestedAt.toISOString(),
                          effectiveTiming: 'scheduled',
                          effectiveDate: offlineForm.endDate,
                          note: offlineForm.note || undefined,
                        },
                      });
                      setOfflineMembers([]);
                    }, t('offlineSuccess')),
                });
              }}
            >
              {offline.isPending ? t('saving') : t('record')}
            </Button>
            <TodayFields
              id="offline"
              reason={offlineForm.todayReason}
              onReasonChange={(todayReason) =>
                setOfflineForm({ ...offlineForm, todayReason })
              }
              pending={offline.isPending}
              disabled={!offlineMember || !offlineForm.requestReceivedAt}
              action={() =>
                confirm({
                  title: t('todayConfirmTitle'),
                  description: t('todayConfirmMemberDescription', {
                    member: offlineMember?.fullName ?? '',
                  }),
                  confirmText: t('endToday'),
                  variant: 'destructive',
                  onConfirm: () =>
                    run(async () => {
                      await offline.mutateAsync({
                        request: {
                          userId: offlineMember.id,
                          source: offlineForm.source,
                          requestReceivedAt: offlineRequestedAt.toISOString(),
                          effectiveTiming: 'today',
                          note: offlineForm.todayReason,
                        },
                      });
                      setOfflineMembers([]);
                    }, t('todaySuccess')),
                })
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('batchTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <MemberPicker
              id="batch-members"
              multiple
              selected={batchMembers}
              onChange={setBatchMembers}
            />
            <DateChoice
              id="batch"
              requestedAt={new Date()}
              value={batchForm.endDate}
              onChange={(endDate) => setBatchForm({ ...batchForm, endDate })}
            />
            <div className="space-y-1">
              <Label htmlFor="batch-note">{t('note')}</Label>
              <Textarea
                id="batch-note"
                value={batchForm.note}
                onChange={(event) =>
                  setBatchForm({ ...batchForm, note: event.target.value })
                }
                maxLength={1000}
              />
            </div>
            <Button
              disabled={
                batch.isPending ||
                batchMembers.length === 0 ||
                !batchForm.endDate
              }
              onClick={() => {
                const now = new Date();
                if (
                  !isEligibleMembershipTerminationDate(batchForm.endDate, {
                    requestedAt: now,
                    evaluatedAt: now,
                  })
                ) {
                  setBatchForm({ ...batchForm, endDate: '' });
                  setError(t('dateNoLongerAvailable'));
                  return;
                }
                confirm({
                  title: t('batchConfirmTitle'),
                  description: t('batchConfirmDescription', {
                    count: batchMembers.length,
                    date: formatDate(batchForm.endDate, locale),
                  }),
                  onConfirm: () =>
                    run(async () => {
                      const result = await batch.mutateAsync({
                        request: {
                          userIds: batchMembers.map((member) => member.id),
                          effectiveTiming: 'scheduled',
                          effectiveDate: batchForm.endDate,
                          note: batchForm.note || undefined,
                        },
                      });
                      setBatchResult(result);
                    }, t('batchSuccess')),
                });
              }}
            >
              {batch.isPending ? t('saving') : t('recordBatch')}
            </Button>
            <TodayFields
              id="batch"
              reason={batchForm.todayReason}
              onReasonChange={(todayReason) =>
                setBatchForm({ ...batchForm, todayReason })
              }
              pending={batch.isPending}
              disabled={batchMembers.length === 0}
              action={() =>
                confirm({
                  title: t('todayConfirmTitle'),
                  description: t('todayConfirmBatchDescription', {
                    count: batchMembers.length,
                  }),
                  confirmText: t('endToday'),
                  variant: 'destructive',
                  onConfirm: () =>
                    run(async () => {
                      const result = await batch.mutateAsync({
                        request: {
                          userIds: batchMembers.map((member) => member.id),
                          effectiveTiming: 'today',
                          note: batchForm.todayReason,
                        },
                      });
                      setBatchResult(result);
                    }, t('todayBatchSuccess')),
                })
              }
            />
            {batchResult && (
              <p role="status">{t('batchResult', batchResult)}</p>
            )}
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog {...confirmProps} />
    </div>
  );
}
