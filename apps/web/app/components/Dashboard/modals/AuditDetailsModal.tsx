'use client';

import { Shield, X } from 'lucide-react';
import { Button } from '@app/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Modal } from '@app/components/ui/modal';
import type { AuditLog } from '@app/services/auditService';
import { useLocale, useTranslations } from 'next-intl';

interface AuditDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  log: AuditLog | null;
}

const auditFieldMessageKeys: Record<string, string> = {
  userId: 'userId',
  requestSource: 'requestSource',
  requestedAt: 'requestedAt',
  requestedEffectiveDate: 'requestedEffectiveDate',
  confirmedEffectiveDate: 'confirmedEffectiveDate',
  asOfDate: 'asOfDate',
  status: 'status',
  membershipStatus: 'membershipStatus',
  'player.type': 'playerType',
  'player.isActivePlayer': 'playerParticipation',
  operation: 'operation',
  inactivePlayerOutcome: 'inactivePlayerOutcome',
  teamCount: 'teamCount',
  accountSuspension: 'accountSuspension',
  result: 'result',
  archived: 'archived',
  studentProof: 'studentProof',
  applicationReceipt: 'applicationReceipt',
  sepaReceipt: 'sepaReceipt',
  reviewNote: 'reviewNote',
  decisionNotificationStatus: 'decisionNotificationStatus',
  contact: 'contact',
  approvedUserId: 'approvedUserId',
  identityMode: 'identityMode',
  physicalCleanup: 'physicalCleanup',
  withUserCleanup: 'withUserCleanup',
  administratorDesignation: 'administratorDesignation',
  requestedCount: 'requestedCount',
  updatedCount: 'updatedCount',
  singlesRanking: 'singlesRanking',
  doublesRanking: 'doublesRanking',
  preferredPositions: 'preferredPositions',
  singlesRankingOffset: 'singlesRankingOffset',
  doublesRankingOffset: 'doublesRankingOffset',
  addToTeams: 'addToTeams',
  removeFromTeams: 'removeFromTeams',
  shortName: 'shortName',
  leagueTeamName: 'leagueTeamName',
  matchLevel: 'matchLevel',
  teamId: 'teamId',
  opponentName: 'opponentName',
  direction: 'direction',
  startAt: 'startAt',
  location: 'location',
  arrivalGuidance: 'arrivalGuidance',
};

const auditValueMessageKeys: Record<string, Record<string, string>> = {
  membershipStatus: {
    active: 'dashboard.membershipStatus.active',
    passive: 'dashboard.membershipStatus.passive',
    inactive: 'dashboard.membershipStatus.inactive',
  },
  'player.type': {
    member: 'dashboard.accountKinds.member',
    external: 'dashboard.accountKinds.externalPlayer',
  },
  'player.isActivePlayer': {
    true: 'dashboard.playerManagement.editPlayer.enabled',
    false: 'dashboard.playerManagement.editPlayer.disabled',
  },
  operation: {
    transition_membership:
      'dashboard.auditLog.values.lifecycleOperations.transitionMembership',
    set_player_eligibility:
      'dashboard.auditLog.values.lifecycleOperations.setPlayerEligibility',
    convert_player_type:
      'dashboard.auditLog.values.lifecycleOperations.convertPlayerType',
  },
  inactivePlayerOutcome: {
    end_participation:
      'dashboard.auditLog.values.inactivePlayerOutcomes.endParticipation',
    continue_as_external:
      'dashboard.auditLog.values.inactivePlayerOutcomes.continueAsExternal',
  },
  accountSuspension: {
    true: 'dashboard.batchUpdate.yes',
    false: 'dashboard.batchUpdate.no',
  },
  archived: {
    true: 'common.guestPlay.admin.archived',
    false: 'common.guestPlay.admin.active',
  },
  applicationReceipt: {
    confirmed: 'dashboard.auditLog.values.receipts.confirmed',
    pending: 'dashboard.auditLog.values.receipts.pending',
  },
  sepaReceipt: {
    confirmed: 'dashboard.auditLog.values.receipts.confirmed',
    pending: 'dashboard.auditLog.values.receipts.pending',
  },
  decisionNotificationStatus: {
    pending:
      'dashboard.applicationDetails.decisionNotification.statuses.pending',
    claimed:
      'dashboard.applicationDetails.decisionNotification.statuses.claimed',
    sent: 'dashboard.applicationDetails.decisionNotification.statuses.sent',
    failed: 'dashboard.applicationDetails.decisionNotification.statuses.failed',
    uncertain:
      'dashboard.applicationDetails.decisionNotification.statuses.uncertain',
  },
  contact: {
    sent: 'dashboard.applicationDetails.decisionNotification.statuses.sent',
  },
  identityMode: {
    create: 'dashboard.auditLog.values.identityModes.create',
    reuse_member: 'dashboard.auditLog.values.identityModes.reuseMember',
    reuse_applicant: 'dashboard.auditLog.values.identityModes.reuseApplicant',
    reuse_external_player:
      'dashboard.auditLog.values.identityModes.reuseExternalPlayer',
  },
  physicalCleanup: {
    true: 'dashboard.batchUpdate.yes',
    false: 'dashboard.batchUpdate.no',
  },
  withUserCleanup: {
    true: 'dashboard.batchUpdate.yes',
    false: 'dashboard.batchUpdate.no',
  },
  administratorDesignation: {
    true: 'dashboard.batchUpdate.yes',
    false: 'dashboard.batchUpdate.no',
  },
  direction: {
    home: 'match.direction.home',
    away: 'match.direction.away',
  },
  requestSource: {
    online: 'dashboard.auditLog.values.requestSources.online',
    email: 'dashboard.membershipTermination.sources.email',
    phone: 'dashboard.membershipTermination.sources.phone',
    in_person: 'dashboard.membershipTermination.sources.in_person',
    other: 'dashboard.membershipTermination.sources.other',
    batch: 'dashboard.auditLog.values.requestSources.batch',
  },
};

const statusValueMessageKeys: Record<string, Record<string, string>> = {
  MembershipApplication: {
    pending: 'dashboard.applicationCenter.status.pending',
    approved: 'dashboard.applicationCenter.status.approved',
    rejected: 'dashboard.applicationCenter.status.rejected',
    withdrawn: 'dashboard.applicationCenter.status.withdrawn',
  },
  MembershipTermination: {
    pending_review: 'account.membershipTermination.status.pending_review',
    approved: 'account.membershipTermination.status.approved',
    rejected: 'account.membershipTermination.status.rejected',
    effective: 'account.membershipTermination.status.effective',
  },
  GuestPlay: {
    pending: 'common.guestPlay.status.pending',
    approved: 'common.guestPlay.status.approved',
    declined: 'common.guestPlay.status.declined',
    cancelled: 'common.guestPlay.status.cancelled',
  },
};

const displayValue = (
  field: string,
  value: unknown,
  entityType: string,
  translate: (key: string) => string
) => {
  if (value === undefined || value === null || value === '') return '—';
  const serializedValue = String(value);
  const messageKey =
    auditValueMessageKeys[field]?.[serializedValue] ??
    (field === 'status'
      ? statusValueMessageKeys[entityType]?.[serializedValue]
      : undefined);
  if (messageKey) return translate(messageKey);
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return serializedValue;
};

export default function AuditDetailsModal({
  isOpen,
  onClose,
  log,
}: AuditDetailsModalProps) {
  const t = useTranslations('dashboard.sharedDialogs');
  const tDialogActions = useTranslations('dashboard.dialogActions');
  const tAudit = useTranslations('dashboard.auditLog');
  const tMessages = useTranslations() as unknown as (key: string) => string;
  const locale = useLocale();
  if (!isOpen || !log) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel={t('auditDetails')}>
      <Card className="flex max-h-[90vh] w-full max-w-2xl flex-col">
        <CardHeader className="border-b pb-4">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t('auditDetails')}
          </CardTitle>
          <CardAction>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label={tDialogActions('close')}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="flex-1 space-y-4 overflow-y-auto p-6">
          <section className="rounded-lg bg-muted/50 p-4">
            <div className="text-sm text-muted-foreground">
              {tAudit('details.businessEvent')}
            </div>
            <div className="font-medium">
              {tAudit(`events.${log.eventType}`)}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {new Intl.DateTimeFormat(locale, {
                dateStyle: 'medium',
                timeStyle: 'medium',
              }).format(new Date(log.createdAt))}
            </div>
          </section>

          <section className="rounded-lg bg-muted/50 p-4">
            <div className="text-sm text-muted-foreground">
              {tAudit('details.actorSource')}
            </div>
            <div className="font-medium">{log.actorDisplayName}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {log.source === 'scheduled'
                ? tAudit('details.scheduled')
                : tAudit('details.human')}{' '}
              · {tAudit(`actorKinds.${log.actorAccountKind}`)}
            </div>
          </section>

          <section className="rounded-lg bg-muted/50 p-4">
            <div className="text-sm text-muted-foreground">
              {tAudit('details.entity')}
            </div>
            <div className="font-medium">
              {tAudit(`entities.${log.entityType}`)}
            </div>
            {log.entityId && (
              <div className="mt-1 break-all font-mono text-xs text-muted-foreground">
                ID: {log.entityId}
              </div>
            )}
          </section>

          {log.reason && (
            <section className="rounded-lg bg-muted/50 p-4">
              <div className="text-sm text-muted-foreground">
                {tAudit('details.reason')}
              </div>
              <div className="font-medium">{log.reason}</div>
            </section>
          )}

          {log.changes && log.changes.length > 0 && (
            <section className="rounded-lg bg-muted/50 p-4">
              <div className="mb-2 text-sm text-muted-foreground">
                {tAudit('details.changes')}
              </div>
              <div className="space-y-3">
                {log.changes.map((change, index) => {
                  const fieldMessageKey = auditFieldMessageKeys[change.field];
                  return (
                    <div key={`${change.field}-${index}`}>
                      <div className="text-sm font-medium">
                        {fieldMessageKey
                          ? tAudit(`fields.${fieldMessageKey}`)
                          : tAudit('fields.other')}
                      </div>
                      {!fieldMessageKey && (
                        <div className="text-xs text-muted-foreground">
                          {tAudit('details.fieldIdentifier')}:{' '}
                          <code>{change.field}</code>
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground">
                        {'oldValue' in change || 'newValue' in change
                          ? `${displayValue(change.field, change.oldValue, log.entityType, tMessages)} → ${displayValue(change.field, change.newValue, log.entityType, tMessages)}`
                          : t('auditChangeValueRedacted')}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </CardContent>

        <div className="border-t bg-muted/20 p-4">
          <Button variant="outline" onClick={onClose} className="w-full">
            {tAudit('details.close')}
          </Button>
        </div>
      </Card>
    </Modal>
  );
}
