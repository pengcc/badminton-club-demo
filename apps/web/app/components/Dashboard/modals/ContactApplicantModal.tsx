'use client';

import React, { useState } from 'react';
import { Button } from '@app/components/ui/button';
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
import { X, Mail, Send } from 'lucide-react';
import { toast } from 'sonner';
import { MembershipApplicationService } from '@app/services/membershipApplicationService';
import type { MembershipApplicationResponse } from '@club/shared-types/api/membershipApplication';
import { useTranslations } from 'next-intl';

interface ContactApplicantModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: MembershipApplicationResponse | null;
}

export default function ContactApplicantModal({
  isOpen,
  onClose,
  application,
}: ContactApplicantModalProps) {
  const t = useTranslations('dashboard.sharedDialogs');
  const tContact = useTranslations('dashboard.applicationContact');
  const tLanguage = useTranslations('dashboard.languageOptions');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const contactMutation = MembershipApplicationService.useContactApplicant();

  if (!isOpen || !application) return null;

  const { personalInfo } = application;

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error(tContact('messageRequired'));
      return;
    }

    setIsSubmitting(true);

    try {
      await contactMutation.mutateAsync({
        id: application.id,
        message: message.trim(),
      });

      toast.success(tContact('sent'));
      setMessage('');
      onClose();
    } catch {
      toast.error(tContact('sendFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Simply close - user can see their message is still there if they reopen
    setMessage('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      ariaLabel={t('contactApplicant')}
    >
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex-shrink-0 border-b pb-4">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t('contactApplicant')}
          </CardTitle>
          <CardAction>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              aria-label={tContact('close')}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-6">
          {/* Recipient Info */}
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="text-sm text-muted-foreground">
              {tContact('recipient')}
            </div>
            <div className="font-medium">
              {personalInfo.firstName} {personalInfo.lastName}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {personalInfo.email}
            </div>
          </div>

          {/* Message Input */}
          <div className="space-y-2">
            <Label htmlFor="message">{tContact('messageLabel')}</Label>
            <p
              id="contact-message-language"
              className="text-sm text-muted-foreground"
            >
              {tContact('recipientLanguageGuidance', {
                language: tLanguage(application.communicationLocale),
              })}
            </p>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={tContact('messagePlaceholder')}
              rows={8}
              aria-invalid={!message.trim()}
              aria-describedby={
                !message.trim()
                  ? 'contact-message-language contact-message-error'
                  : 'contact-message-language'
              }
            />
            {!message.trim() && (
              <p id="contact-message-error" className="text-sm text-red-500">
                {tContact('messageRequiredInline')}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {tContact('senderGuidance')}
            </p>
          </div>

          <div className="flex gap-3 rounded-lg border bg-muted/30 p-4 text-sm">
            <Mail className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <p>{tContact('deliveryGuidance')}</p>
          </div>
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
              {tContact('cancel')}
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !message.trim()}
              className="sm:order-2 flex-1"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  {tContact('sending')}
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  {tContact('send')}
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </Modal>
  );
}
