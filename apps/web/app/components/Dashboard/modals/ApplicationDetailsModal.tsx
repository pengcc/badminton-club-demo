'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@app/components/ui/button';
import { Label } from '@app/components/ui/label';
import { Textarea } from '@app/components/ui/textarea';
import { Modal } from '@app/components/ui/modal';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import {
  X,
  FileText,
  User,
  Mail,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
} from 'lucide-react';
import type { MembershipApplicationResponse } from '@club/shared-types/api/membershipApplication';
import { MembershipApplicationService } from '@app/services/membershipApplicationService';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  confirmSignedReceipt,
  deleteAdminStudentProof,
  downloadAdminStudentProof,
  resetSignedReceipt,
  retryDecisionNotification,
  updateApplicationReviewNote,
  viewAdminStudentProof,
} from '@app/lib/api/membershipApplicationApi';

interface ApplicationDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: MembershipApplicationResponse | null;
}

const applicationGenderMessageKey = {
  male: 'male',
  female: 'female',
  'non-binary': 'other',
} as const;

export default function ApplicationDetailsModal({
  isOpen,
  onClose,
  application: applicationProp,
}: ApplicationDetailsModalProps) {
  const t = useTranslations('common.setupDelivery');
  const tForm = useTranslations('common.applicationForm');
  const tApplicant = useTranslations('common.membershipApplicant');
  const tDialogs = useTranslations('dashboard.sharedDialogs');
  const tDialogActions = useTranslations('dashboard.dialogActions');
  const tDetails = useTranslations('dashboard.applicationDetails');
  const reissue = MembershipApplicationService.useReissuePasswordSetup();
  const [displayApplication, setDisplayApplication] = useState(applicationProp);
  const [documentBusy, setDocumentBusy] = useState(false);
  const [reviewNoteDraft, setReviewNoteDraft] = useState(
    applicationProp?.reviewNote ?? ''
  );
  useEffect(() => {
    setDisplayApplication(applicationProp);
    setReviewNoteDraft(applicationProp?.reviewNote ?? '');
  }, [applicationProp]);
  if (!isOpen || !displayApplication) return null;

  const handleReissue = async () => {
    try {
      const result = await reissue.mutateAsync({ id: application.id });
      result.deliveryStatus === 'sent'
        ? toast.success(t('reissued'))
        : toast.warning(t(result.deliveryStatus));
    } catch {
      toast.error(t('reissueFailed'));
    }
  };

  const application = displayApplication;
  const {
    personalInfo,
    membershipType,
    bankingSummary,
    status,
    reviewDate,
    reviewNote,
  } = application;
  const address = personalInfo.address;
  const genderMessageKey = personalInfo.gender
    ? applicationGenderMessageKey[personalInfo.gender]
    : null;
  const decisionRetryAvailable =
    application.decisionNotificationStatus === 'failed' ||
    application.decisionNotificationStatus === 'uncertain' ||
    (application.decisionNotificationStatus === 'claimed' &&
      Boolean(
        application.decisionNotificationClaimedAt &&
          new Date(application.decisionNotificationClaimedAt).getTime() <=
            Date.now() - 10 * 60 * 1000
      ));

  const downloadProof = async (proofId: string, name: string) => {
    setDocumentBusy(true);
    try {
      const blob = await downloadAdminStudentProof(application.id, proofId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = name;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(tDetails('proofFeedback.downloadFailed'));
    } finally {
      setDocumentBusy(false);
    }
  };

  const viewProof = async (proofId: string) => {
    setDocumentBusy(true);
    try {
      const blob = await viewAdminStudentProof(application.id, proofId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error(tDetails('proofFeedback.openFailed'));
    } finally {
      setDocumentBusy(false);
    }
  };

  const removeProof = async (proofId: string) => {
    setDocumentBusy(true);
    try {
      await deleteAdminStudentProof(application.id, proofId);
      setDisplayApplication({
        ...application,
        studentProof: application.studentProof.filter(
          (proof) => proof.id !== proofId
        ),
      });
      toast.success(tDetails('proofFeedback.deleted'));
    } catch {
      toast.error(tDetails('proofFeedback.deleteFailed'));
    } finally {
      setDocumentBusy(false);
    }
  };

  const updateReceipt = async (
    kind: 'application' | 'sepa',
    reset: boolean
  ) => {
    setDocumentBusy(true);
    try {
      const updated = reset
        ? await resetSignedReceipt(application.id, kind)
        : await confirmSignedReceipt(application.id, kind);
      setDisplayApplication(updated);
      toast.success(
        reset
          ? tDetails('receipts.resetSuccess')
          : tDetails('receipts.confirmSuccess')
      );
    } catch {
      toast.error(tDetails('receipts.updateFailed'));
    } finally {
      setDocumentBusy(false);
    }
  };

  const retryDecision = async () => {
    setDocumentBusy(true);
    try {
      const updated = await retryDecisionNotification(application.id);
      setDisplayApplication(updated);
      updated.decisionNotificationStatus === 'sent'
        ? toast.success(tDetails('decisionNotification.sent'))
        : toast.warning(tDetails('decisionNotification.uncertain'));
    } catch {
      toast.error(tDetails('decisionNotification.retryFailed'));
    } finally {
      setDocumentBusy(false);
    }
  };

  const saveReviewNote = async () => {
    setDocumentBusy(true);
    try {
      const updated = await updateApplicationReviewNote(
        application.id,
        reviewNoteDraft
      );
      setDisplayApplication(updated);
      toast.success(tDetails('reviewNote.saved'));
    } catch {
      toast.error(tDetails('reviewNote.saveFailed'));
    } finally {
      setDocumentBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={tDialogs('applicationDetails')}
    >
      <Card className="w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Fixed Header */}
        <CardHeader className="flex-shrink-0 border-b pb-4">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {tDialogs('applicationDetails')}
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

        {/* Scrollable Content */}
        <CardContent className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-6">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">
                {tDetails('statusLabel')}
              </div>
              <div className="mt-1">
                {status === 'pending' && (
                  <span className="inline-flex items-center rounded-full bg-yellow-50 dark:bg-yellow-950/20 px-3 py-1 text-sm font-medium text-yellow-700 dark:text-yellow-500">
                    {tApplicant('statusLabels.pending')}
                  </span>
                )}
                {status === 'approved' && (
                  <span className="inline-flex items-center rounded-full bg-green-50 dark:bg-green-950/20 px-3 py-1 text-sm font-medium text-green-700 dark:text-green-500">
                    {tApplicant('statusLabels.approved')}
                  </span>
                )}
                {status === 'rejected' && (
                  <span className="inline-flex items-center rounded-full bg-red-50 dark:bg-red-950/20 px-3 py-1 text-sm font-medium text-red-700 dark:text-red-500">
                    {tApplicant('statusLabels.rejected')}
                  </span>
                )}
                {status === 'withdrawn' && (
                  <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-900 px-3 py-1 text-sm font-medium text-slate-700 dark:text-slate-300">
                    {tApplicant('statusLabels.withdrawn')}
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">
                {tDetails('submitted')}
              </div>
              <div className="text-sm font-medium">
                {new Date(application.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <User className="h-5 w-5" />
              {tForm('personalInfo')}
            </h3>
            <div className="grid grid-cols-2 gap-4 bg-muted/50 p-4 rounded-lg">
              <div>
                <div className="text-sm text-muted-foreground">
                  {tForm('firstName')}
                </div>
                <div className="font-medium">{personalInfo.firstName}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">
                  {tForm('lastName')}
                </div>
                <div className="font-medium">{personalInfo.lastName}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {tForm('email')}
                </div>
                <div className="font-medium">{personalInfo.email}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {tForm('phone')}
                </div>
                <div className="font-medium">{personalInfo.phone || '—'}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {tForm('birthday')}
                </div>
                <div className="font-medium">
                  {personalInfo.dateOfBirth
                    ? new Date(personalInfo.dateOfBirth).toLocaleDateString()
                    : '—'}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">
                  {tForm('gender')}
                </div>
                <div className="font-medium">
                  {genderMessageKey
                    ? tForm(`genderOptions.${genderMessageKey}`)
                    : '—'}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {tForm('address')}
                </div>
                <div className="font-medium">{address?.street ?? '—'}</div>
                <div className="font-medium">
                  {address?.postalCode ?? ''} {address?.city ?? ''}
                </div>
                <div className="font-medium">{address?.country ?? ''}</div>
              </div>
            </div>
          </div>

          {/* Membership Type */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">{tForm('membershipType')}</h3>
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="font-medium">
                {tForm(`membershipTypes.${membershipType}`)}
              </div>
            </div>
          </div>

          {membershipType === 'student' && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">
                {tApplicant('proofTitle')}
              </h3>
              {application.studentProof.length === 0 ? (
                <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  {tDetails('studentProofMissing')}
                </p>
              ) : (
                application.studentProof.map((proof) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                    key={proof.id}
                  >
                    <span className="min-w-0 truncate text-sm">
                      {proof.originalName}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={documentBusy}
                        onClick={() => void viewProof(proof.id)}
                      >
                        {tDetails('proofActions.view')}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={documentBusy}
                        onClick={() =>
                          void downloadProof(proof.id, proof.originalName)
                        }
                      >
                        {tDetails('proofActions.download')}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={documentBusy}
                        onClick={() => void removeProof(proof.id)}
                      >
                        {tDetails('proofActions.delete')}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {status === 'pending' && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">
                {tDetails('receipts.title')}
              </h3>
              {(['application', 'sepa'] as const).map((kind) => {
                const receipt =
                  kind === 'application'
                    ? application.signedApplicationReceipt
                    : application.signedSepaReceipt;
                const active = Boolean(receipt && !receipt.resetAt);
                return (
                  <div
                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                    key={kind}
                  >
                    <div>
                      <p className="font-medium">
                        {kind === 'application'
                          ? tApplicant('applicationDocument')
                          : tApplicant('sepaDocument')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {active
                          ? tDetails('receipts.received', {
                              date: new Date(
                                receipt!.receivedAt
                              ).toLocaleString(),
                            })
                          : receipt?.resetAt
                            ? tDetails('receipts.resetAt', {
                                date: new Date(
                                  receipt.resetAt
                                ).toLocaleString(),
                              })
                            : tDetails('receipts.notReceived')}
                      </p>
                    </div>
                    {active ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={documentBusy}
                        onClick={() => void updateReceipt(kind, true)}
                      >
                        {tDetails('receipts.reset')}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        disabled={
                          documentBusy ||
                          (kind === 'sepa' && !bankingSummary.complete)
                        }
                        onClick={() => void updateReceipt(kind, false)}
                      >
                        {tDetails('receipts.confirm')}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-lg font-semibold">
              {tDetails('reviewNote.title')}
            </h3>
            <Label htmlFor="application-review-note">
              {tDetails('reviewNote.title')}
            </Label>
            <Textarea
              id="application-review-note"
              value={reviewNoteDraft}
              onChange={(event) => setReviewNoteDraft(event.target.value)}
              rows={3}
            />
            <p className="text-sm text-muted-foreground">
              {tDetails('reviewNote.guidance')}
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={
                documentBusy ||
                reviewNoteDraft === (application.reviewNote ?? '')
              }
              onClick={() => void saveReviewNote()}
            >
              {tDetails('reviewNote.save')}
            </Button>
          </div>

          {/* SEPA Direct Debit Information */}
          {bankingSummary.present && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                {tForm('sepaTitle')}
              </h3>
              <div className="bg-muted/50 p-4 rounded-lg space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground">
                    {tDetails('bankingStatus')}
                  </div>
                  <div className="font-medium">
                    {bankingSummary.complete
                      ? tDetails('complete')
                      : tDetails('incomplete')}
                  </div>
                </div>
                {bankingSummary.ibanLastFour && (
                  <div>
                    <div className="text-sm text-muted-foreground">
                      {tForm('iban')}
                    </div>
                    <div className="font-medium font-mono text-sm">
                      •••• {bankingSummary.ibanLastFour}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Review Information */}
          {(reviewDate || reviewNote || application.withdrawnAt) && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">
                {tDetails('reviewInformation')}
              </h3>
              <div className="bg-muted/50 p-4 rounded-lg space-y-2">
                {reviewDate && (
                  <div>
                    <div className="text-sm text-muted-foreground">
                      {tDetails('reviewDate')}
                    </div>
                    <div className="font-medium">
                      {new Date(reviewDate).toLocaleDateString()}
                    </div>
                  </div>
                )}
                {reviewNote && (
                  <div>
                    <div className="text-sm text-muted-foreground">
                      {tDetails('notes')}
                    </div>
                    <div className="font-medium">{reviewNote}</div>
                  </div>
                )}
                {application.withdrawnAt && (
                  <div>
                    <div className="text-sm text-muted-foreground">
                      {tDetails('withdrawn')}
                    </div>
                    <div className="font-medium">
                      {new Date(application.withdrawnAt).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {(status === 'approved' || status === 'rejected') &&
            application.decisionNotificationStatus && (
              <div className="space-y-3">
                <h3 className="text-lg font-semibold">
                  {tDetails('decisionNotification.title')}
                </h3>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <span className="text-sm">
                    {tDetails('decisionNotification.delivery', {
                      status: tDetails(
                        `decisionNotification.statuses.${application.decisionNotificationStatus}`
                      ),
                    })}
                  </span>
                  {decisionRetryAvailable && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={documentBusy}
                      onClick={() => void retryDecision()}
                    >
                      {tDetails('decisionNotification.retry')}
                    </Button>
                  )}
                </div>
              </div>
            )}
        </CardContent>

        {/* Fixed Footer */}
        <div className="flex-shrink-0 border-t p-4 bg-muted/20">
          <div className="flex justify-end gap-2">
            {status === 'approved' && (
              <Button
                variant="outline"
                onClick={handleReissue}
                disabled={reissue.isPending}
              >
                <Mail className="mr-2 h-4 w-4" />
                {reissue.isPending ? t('reissuing') : t('reissue')}
              </Button>
            )}
            <Button onClick={onClose}>{tDialogActions('close')}</Button>
          </div>
        </div>
      </Card>
    </Modal>
  );
}
