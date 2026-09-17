'use client';

import React, { useRef, useState } from 'react';
import { Button } from '@app/components/ui/button';
import { ActionButton } from '@app/components/ActionButton';
import { Modal } from '@app/components/ui/modal';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Label } from '@app/components/ui/label';
import { Textarea } from '@app/components/ui/textarea';
import { X, CheckCircle, XCircle, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { MembershipApplicationService } from '@app/services/membershipApplicationService';
import { useTranslations } from 'next-intl';
import type { MembershipApplicationResponse } from '@club/shared-types/api/membershipApplication';

interface ApplicationReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: MembershipApplicationResponse | null;
  action: 'approve' | 'reject';
}

export default function ApplicationReviewModal({
  isOpen,
  onClose,
  application,
  action,
}: ApplicationReviewModalProps) {
  const [reviewNote, setReviewNote] = useState('');
  const [decisionMessage, setDecisionMessage] = useState('');
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const approvalKey = useRef<string | undefined>(undefined);
  const t = useTranslations('common.setupDelivery');
  const tDialogs = useTranslations('dashboard.sharedDialogs');
  const tDecision = useTranslations('dashboard.applicationDecision');
  const tLanguage = useTranslations('dashboard.languageOptions');

  const approveMutation = MembershipApplicationService.useApproveApplication();
  const rejectMutation = MembershipApplicationService.useRejectApplication();

  if (!isOpen || !application) return null;

  const { personalInfo } = application;
  const isApprove = action === 'approve';
  const applicationReceiptActive = Boolean(
    application.signedApplicationReceipt &&
      !application.signedApplicationReceipt.resetAt
  );
  const sepaReceiptActive = Boolean(
    application.signedSepaReceipt && !application.signedSepaReceipt.resetAt
  );
  const approvalGatesPass =
    application.bankingSummary.complete &&
    applicationReceiptActive &&
    sepaReceiptActive;

  const handleSubmit = async () => {
    if (!isApprove && !decisionMessage.trim()) {
      toast.error(tDecision('rejectionReasonRequired'));
      return;
    }
    if (isApprove && !approvalGatesPass) {
      toast.error(tDecision('approvalRequirementsMissing'));
      return;
    }
    if (isApprove && !approvalConfirmed) {
      setApprovalConfirmed(true);
      return;
    }

    setIsSubmitting(true);

    try {
      if (isApprove) {
        approvalKey.current ??= crypto.randomUUID();
        const response = await approveMutation.mutateAsync({
          id: application.id,
          reviewNote: reviewNote || undefined,
          approvalMessage: decisionMessage || undefined,
          idempotencyKey: approvalKey.current,
        });
        const delivery = response.data.deliveryStatus;
        if (response.data.setupRequired) {
          delivery === 'sent'
            ? toast.success(t('sent'))
            : toast.warning(t(delivery));
        } else {
          toast.success(t('notRequired'));
        }
        if (response.data.decisionDeliveryStatus !== 'sent') {
          toast.warning(tDecision('approvalDeliveryRetry'));
        }
        approvalKey.current = undefined;
      } else {
        const response = await rejectMutation.mutateAsync({
          id: application.id,
          reason: decisionMessage,
          reviewNote: reviewNote || undefined,
        });
        if (response.data.decisionNotificationStatus !== 'sent') {
          toast.warning(tDecision('rejectionDeliveryRetry'));
        }
      }

      onClose();
      setReviewNote('');
      setDecisionMessage('');
      setApprovalConfirmed(false);
    } catch {
      toast.error(tDecision(isApprove ? 'approvalFailed' : 'rejectionFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    approvalKey.current = undefined;
    setReviewNote('');
    setDecisionMessage('');
    setApprovalConfirmed(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      ariaLabel={tDialogs(
        isApprove ? 'approveApplication' : 'rejectApplication'
      )}
    >
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex-shrink-0 border-b pb-4">
          <CardTitle className="flex items-center gap-2">
            {isApprove ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-600" />
                {tDialogs('approveApplication')}
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-600" />
                {tDialogs('rejectApplication')}
              </>
            )}
          </CardTitle>
          <CardAction>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              aria-label={tDecision('close')}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-6">
          {/* Applicant Info */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="text-sm text-muted-foreground">
              {tDecision('applicant')}
            </div>
            <div className="font-medium">
              {personalInfo.firstName} {personalInfo.lastName}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {personalInfo.email}
            </div>
          </div>

          {isApprove && (
            <div className="space-y-2 rounded-lg border p-4">
              <div className="font-medium">{tDecision('approvalGates')}</div>
              <p
                className={
                  application.bankingSummary.complete
                    ? 'text-green-700'
                    : 'text-red-700'
                }
              >
                {tDecision('bankingInformation')}:{' '}
                {tDecision(
                  application.bankingSummary.complete
                    ? 'complete'
                    : 'incomplete'
                )}
              </p>
              <p
                className={
                  applicationReceiptActive ? 'text-green-700' : 'text-red-700'
                }
              >
                {tDecision('signedMembershipApplication')}:{' '}
                {tDecision(
                  applicationReceiptActive ? 'received' : 'missingOrReset'
                )}
              </p>
              <p
                className={
                  sepaReceiptActive ? 'text-green-700' : 'text-red-700'
                }
              >
                {tDecision('signedSepaMandate')}:{' '}
                {tDecision(sepaReceiptActive ? 'received' : 'missingOrReset')}
              </p>
              {application.membershipType === 'student' &&
                application.studentProof.length === 0 && (
                  <p className="text-amber-700">
                    {tDecision('studentProofMissing')}
                  </p>
                )}
            </div>
          )}

          {/* Applicant-visible decision message */}
          <div className="space-y-2">
            <Label htmlFor="decision-message">
              {isApprove
                ? tDecision('approvalMessageLabel')
                : `${tDecision('rejectionReasonLabel')} *`}
            </Label>
            <p
              id="decision-message-language"
              className="text-sm text-muted-foreground"
            >
              {tDecision('recipientLanguageGuidance', {
                language: tLanguage(application.communicationLocale),
              })}
            </p>
            <Textarea
              id="decision-message"
              value={decisionMessage}
              onChange={(e) => {
                setDecisionMessage(e.target.value);
                setApprovalConfirmed(false);
              }}
              placeholder={
                isApprove
                  ? tDecision('approvalMessagePlaceholder')
                  : tDecision('rejectionReasonPlaceholder')
              }
              rows={4}
              aria-invalid={!isApprove && !decisionMessage.trim()}
              aria-describedby={
                !isApprove && !decisionMessage.trim()
                  ? 'decision-message-language decision-message-error'
                  : 'decision-message-language'
              }
            />
            {!isApprove && !decisionMessage.trim() && (
              <p id="decision-message-error" className="text-sm text-red-500">
                {tDecision('rejectionReasonInline')}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-note">{tDecision('reviewNoteLabel')}</Label>
            <Textarea
              id="review-note"
              value={reviewNote}
              onChange={(event) => {
                setReviewNote(event.target.value);
                setApprovalConfirmed(false);
              }}
              rows={3}
            />
            <p className="text-sm text-muted-foreground">
              {tDecision('reviewNoteGuidance')}
            </p>
          </div>

          <div className="flex gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
            <Mail className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <p>{tDecision('deliveryGuidance')}</p>
          </div>

          {/* Warning for Rejection */}
          {!isApprove && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex gap-2">
                <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium text-red-900 dark:text-red-100">
                    {tDecision('rejectionIrreversibleTitle')}
                  </div>
                  <div className="text-red-700 dark:text-red-300 mt-1">
                    {tDecision('rejectionIrreversibleDescription')}
                  </div>
                </div>
              </div>
            </div>
          )}

          {isApprove && approvalConfirmed && (
            <div
              className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
              role="alert"
            >
              {tDecision('approvalFinalConfirmation')}
            </div>
          )}
        </CardContent>

        {/* Fixed Footer */}
        <div className="flex-shrink-0 border-t p-4 bg-muted/20">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="sm:order-1"
              disabled={isSubmitting}
            >
              {tDecision('cancel')}
            </Button>
            {isApprove ? (
              <ActionButton
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !approvalGatesPass}
                colorVariant="success"
                className="sm:order-2 flex-1"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    {tDecision('processing')}
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {approvalConfirmed
                      ? tDecision('confirmApproval')
                      : tDecision('continueToConfirmation')}
                  </>
                )}
              </ActionButton>
            ) : (
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || !decisionMessage.trim()}
                variant="destructive"
                className="sm:order-2 flex-1"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    {tDecision('processing')}
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    {tDecision('rejectAndSendEmail')}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </Modal>
  );
}
