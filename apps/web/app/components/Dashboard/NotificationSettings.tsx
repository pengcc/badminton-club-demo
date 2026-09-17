'use client';

import { useState } from 'react';
import type { NotificationRecipientType } from '@club/shared-types/api/notificationSettings';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import { Label } from '@app/components/ui/label';
import { EmailChipInput } from '@app/components/ui/email-chip-input';
import { NotificationSettingsService } from '@app/services/notificationSettingsService';
import { Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';

type RecipientDrafts = Partial<Record<NotificationRecipientType, string[]>>;

export default function NotificationSettings() {
  const t = useTranslations('dashboard.notificationSettings');
  const recipientsQuery =
    NotificationSettingsService.useNotificationRecipients();
  const updateRecipients =
    NotificationSettingsService.useUpdateNotificationRecipients();
  const [drafts, setDrafts] = useState<RecipientDrafts>({});
  const [saveError, setSaveError] = useState(false);
  const [savedType, setSavedType] = useState<NotificationRecipientType>();

  const cards: Array<{
    type: NotificationRecipientType;
    title: string;
    description: string;
    save: string;
  }> = [
    {
      type: 'applicationAlerts',
      title: t('application.title'),
      description: t('application.description'),
      save: t('application.save'),
    },
    {
      type: 'tasterSessionAlerts',
      title: t('tasterSession.title'),
      description: t('tasterSession.description'),
      save: t('tasterSession.save'),
    },
    {
      type: 'guestPlayAlerts',
      title: t('guestPlay.title'),
      description: t('guestPlay.description'),
      save: t('guestPlay.save'),
    },
  ];

  if (recipientsQuery.isPending && !recipientsQuery.data) {
    return (
      <div className="flex items-center justify-center py-12" role="status">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="sr-only">{t('loading')}</span>
      </div>
    );
  }

  if (recipientsQuery.isError && !recipientsQuery.data) {
    return (
      <div
        className="space-y-3 rounded-md bg-destructive/10 px-4 py-3 text-destructive"
        role="alert"
      >
        <p>{t('loadFailed')}</p>
        <Button variant="outline" onClick={() => recipientsQuery.refetch()}>
          {t('retry')}
        </Button>
      </div>
    );
  }

  if (!recipientsQuery.data) return null;

  const handleDraftChange = (
    type: NotificationRecipientType,
    emails: string[]
  ) => {
    setDrafts((current) => ({ ...current, [type]: emails }));
    setSavedType(undefined);
    setSaveError(false);
  };

  const handleSave = async (type: NotificationRecipientType) => {
    setSaveError(false);
    setSavedType(undefined);

    try {
      await updateRecipients.mutateAsync({
        type,
        emails: drafts[type] ?? recipientsQuery.data[type],
      });
      setDrafts((current) => {
        const next = { ...current };
        delete next[type];
        return next;
      });
      setSavedType(type);
    } catch {
      setSaveError(true);
    }
  };

  return (
    <div className="space-y-6">
      {recipientsQuery.isError && (
        <div
          className="space-y-2 rounded-md bg-destructive/10 px-4 py-3 text-destructive"
          role="alert"
        >
          <p>{t('refreshFailed')}</p>
          <Button variant="outline" onClick={() => recipientsQuery.refetch()}>
            {t('retryRefresh')}
          </Button>
        </div>
      )}

      {saveError && (
        <div
          className="rounded-md bg-destructive/10 px-4 py-3 text-destructive"
          role="alert"
        >
          {t('saveFailed')}
        </div>
      )}

      {savedType && (
        <div
          className="rounded-md bg-green-500/10 px-4 py-3 text-green-600 dark:text-green-400"
          role="status"
        >
          {t('saved')}
        </div>
      )}

      {cards.map((card) => {
        const inputId = `notification-recipients-${card.type}`;
        const emails = drafts[card.type] ?? recipientsQuery.data[card.type];
        const isSaving =
          updateRecipients.isPending &&
          updateRecipients.variables?.type === card.type;

        return (
          <Card key={card.type}>
            <CardHeader>
              <CardTitle>{card.title}</CardTitle>
              <CardDescription>{card.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label
                  htmlFor={inputId}
                  className="mb-2 block text-sm font-medium"
                >
                  {t('recipients')}
                </Label>
                <EmailChipInput
                  id={inputId}
                  emails={emails}
                  onChange={(next) => handleDraftChange(card.type, next)}
                  placeholder={t('placeholder')}
                  invalidEmailMessage={t('input.invalid')}
                  duplicateEmailMessage={t('input.duplicate')}
                  instructions={t('input.instructions')}
                  getRemoveEmailLabel={(email) => t('input.remove', { email })}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  {t('emptyGuidance')}
                </p>
              </div>
              <Button
                onClick={() => handleSave(card.type)}
                disabled={updateRecipients.isPending}
                className="w-full sm:w-auto"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('saving')}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {card.save}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
