'use client';

import { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Edit,
  Eye,
  EyeOff,
  Info,
  Plus,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ZodIssue } from 'zod';
import { CONTENT_LANGUAGES } from '@club/shared-types/api/localizedContent';
import {
  contactEntryValuesSchema,
  getContactEntryCompleteness,
  type ContactEntryValues,
} from '@club/shared-types/api/contact';
import { Language } from '@club/shared-types/core/enums';
import { ContactEntryService } from '@app/services/contactEntryService';
import { usePublication } from '@app/hooks/usePublication';
import type {
  ContactEntryAdministration,
  ContactEntryRequest,
  ContactQrCleanupWarning,
} from '@app/lib/api/contactEntryApi';
import { Button } from '@app/components/ui/button';
import { Badge } from '@app/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Input } from '@app/components/ui/input';
import { Label } from '@app/components/ui/label';
import { Textarea } from '@app/components/ui/textarea';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@app/components/ui/tabs';
import {
  ConfirmDialog,
  useConfirmDialog,
} from '@app/components/ui/confirm-dialog';
import { PublicationFailureNotice } from './PublicationFailureNotice';
import { useTranslations } from 'next-intl';

const emptyLocalized = () => ({ de: '', en: '', zh: '' });
type LocalizedContactField =
  | 'title'
  | 'description'
  | 'qrExplanation'
  | 'externalLinkLabel';
type ContactFieldKey =
  | 'category'
  | 'email'
  | 'order'
  | 'externalLink'
  | 'qrCode'
  | `${LocalizedContactField}.${Language}`;

interface ContactFormIssue {
  key?: ContactFieldKey;
  fieldId?: string;
  language?: Language;
  label?: string;
  message: string;
  clearWithPendingQrSelection?: boolean;
}

const localizedFieldIds: Record<LocalizedContactField, string> = {
  title: 'contact-title',
  description: 'contact-description',
  qrExplanation: 'contact-qr-label',
  externalLinkLabel: 'contact-link-label',
};

const contactQrErrorTranslationKeys = {
  INVALID_CONTACT_QR_UPLOAD: 'upload',
  INVALID_CONTACT_QR_TYPE: 'type',
  INVALID_CONTACT_QR_SIZE: 'size',
  INVALID_CONTACT_QR_SIGNATURE: 'signature',
  INVALID_RETAINED_CONTACT_QR: 'retained',
  CONTACT_QR_OWNERSHIP_UNVERIFIED: 'ownership',
} as const;

function apiErrorCode(error: unknown): string | undefined {
  const code = (error as { response?: { data?: { code?: unknown } } })?.response
    ?.data?.code;
  return typeof code === 'string' ? code : undefined;
}
const emptyValues = (): ContactEntryValues => ({
  category: '',
  title: emptyLocalized(),
  description: emptyLocalized(),
  email: '',
  retainedQrCode: '',
  qrExplanation: emptyLocalized(),
  externalLink: '',
  externalLinkLabel: emptyLocalized(),
  isActive: true,
  order: 0,
});

function valuesFrom(entry: ContactEntryAdministration): ContactEntryValues {
  return {
    category: entry.category,
    title: entry.title,
    description: entry.description,
    email: entry.email,
    retainedQrCode: entry.qrCode,
    qrExplanation: entry.qrExplanation,
    externalLink: entry.externalLink,
    externalLinkLabel: entry.externalLinkLabel,
    isActive: entry.isActive,
    order: entry.order,
  };
}

export default function ContactEntryManager() {
  const t = useTranslations('dashboard.cms');
  const tDialog = useTranslations('dashboard.dialogActions');
  const query = ContactEntryService.useEntries();
  const create = ContactEntryService.useCreate();
  const update = ContactEntryService.useUpdate();
  const remove = ContactEntryService.useDelete();
  const publication = usePublication();
  const { confirm, confirmProps } = useConfirmDialog({
    confirmText: tDialog('confirm'),
    cancelText: tDialog('cancel'),
    pendingText: tDialog('processing'),
  });
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [values, setValues] = useState<ContactEntryValues>(emptyValues);
  const [newQrCode, setNewQrCode] = useState<File>();
  const [retainedQrOriginalFilename, setRetainedQrOriginalFilename] =
    useState('');
  const qrInputRef = useRef<HTMLInputElement>(null);
  const [activeLanguage, setActiveLanguage] = useState<Language>(
    Language.GERMAN
  );
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [requestIssue, setRequestIssue] = useState<ContactFormIssue>();

  const fieldLabel = (field: string, language?: Language) => {
    const label =
      field === 'order'
        ? t('common.order')
        : field === 'externalLink'
          ? t('contact.externalLink')
          : field === 'qrCode'
            ? t('contact.qrImage')
            : field === 'title' ||
                field === 'description' ||
                field === 'qrExplanation' ||
                field === 'externalLinkLabel'
              ? t(`contact.fields.${field}`)
              : t(`contact.${field}`);
    return language
      ? t('contact.validation.fieldInLanguage', {
          field: label,
          language: t(`common.languages.${language}`),
        })
      : label;
  };

  const validationMessage = (issue: ZodIssue) => {
    const field = String(issue.path[0] ?? '');
    if (issue.code === 'too_big') {
      return t('contact.validation.tooLong', { max: Number(issue.maximum) });
    }
    if (field === 'email') return t('contact.validation.email');
    if (field === 'externalLink') return t('contact.validation.externalLink');
    if (field === 'order') return t('contact.validation.order');
    if (
      issue.code === 'too_small' ||
      issue.message === 'German content is required'
    ) {
      return t('contact.validation.required');
    }
    if (
      issue.message ===
      'German external-link label is required when a link is set'
    ) {
      return t('contact.validation.externalLinkLabel');
    }
    return t('contact.validation.invalid');
  };

  const mapSchemaIssue = (issue: ZodIssue): ContactFormIssue => {
    const field = String(issue.path[0] ?? '');
    const nestedLanguage = issue.path[1];
    if (field in localizedFieldIds && typeof nestedLanguage === 'string') {
      const language = nestedLanguage as Language;
      const localizedField = field as LocalizedContactField;
      return {
        key: `${localizedField}.${language}`,
        fieldId: `${localizedFieldIds[localizedField]}-${language}`,
        language,
        label: fieldLabel(field, language),
        message: validationMessage(issue),
      };
    }

    const plainFields: Record<
      string,
      { key: ContactFieldKey; fieldId: string }
    > = {
      category: { key: 'category', fieldId: 'contact-category' },
      email: { key: 'email', fieldId: 'contact-email' },
      order: { key: 'order', fieldId: 'contact-order' },
      externalLink: { key: 'externalLink', fieldId: 'contact-link' },
      retainedQrCode: { key: 'qrCode', fieldId: 'contact-qr' },
    };
    const target = plainFields[field];
    if (!target) return { message: validationMessage(issue) };
    return {
      ...target,
      label: fieldLabel(target.key),
      message: validationMessage(issue),
    };
  };

  const localIssues = validationAttempted
    ? (() => {
        const parsed = contactEntryValuesSchema.safeParse(values);
        return parsed.success ? [] : parsed.error.issues.map(mapSchemaIssue);
      })()
    : [];
  const formIssues = requestIssue
    ? [...localIssues, requestIssue]
    : localIssues;
  const issueFor = (key: ContactFieldKey) =>
    formIssues.find((issue) => issue.key === key);

  const focusIssue = (issue: ContactFormIssue) => {
    if (issue.language) setActiveLanguage(issue.language);
    if (!issue.fieldId) return;
    requestAnimationFrame(() => {
      document.getElementById(issue.fieldId ?? '')?.focus();
    });
  };

  const clearFeedback = () => {
    setValidationAttempted(false);
    setRequestIssue(undefined);
  };

  const clearRequestIssueFor = (key?: ContactFieldKey) => {
    setRequestIssue((current) =>
      !current || !current.key || current.key === key ? undefined : current
    );
  };

  const clearPendingQrSelectionIssue = () => {
    setRequestIssue((current) =>
      current?.key === 'qrCode' && current.clearWithPendingQrSelection
        ? undefined
        : current
    );
  };

  const clearPendingQrSelection = () => {
    setNewQrCode(undefined);
    if (qrInputRef.current) qrInputRef.current.value = '';
    clearPendingQrSelectionIssue();
  };

  const updateValues = (next: ContactEntryValues, key?: ContactFieldKey) => {
    setValues(next);
    clearRequestIssueFor(key);
  };

  const notifySaved = async (
    message: string,
    cleanup: ContactQrCleanupWarning | null = null
  ) => {
    const published = await publication.publish('contact');
    if (cleanup) toast.warning(t('contact.mediaCleanupWarning'));
    if (!published) toast.warning(t('publication.failed', { item: message }));
    else if (!cleanup)
      toast.success(t('publication.success', { item: message }));
  };

  const maximumReached = (query.data ?? []).length >= 4;

  const openNew = () => {
    if (maximumReached) return;
    setEditingId('new');
    setValues(emptyValues());
    setNewQrCode(undefined);
    setRetainedQrOriginalFilename('');
    setActiveLanguage(Language.GERMAN);
    clearFeedback();
  };
  const openEdit = (entry: ContactEntryAdministration) => {
    setEditingId(entry.id);
    setValues(valuesFrom(entry));
    setNewQrCode(undefined);
    setRetainedQrOriginalFilename(entry.qrCodeOriginalFilename);
    setActiveLanguage(Language.GERMAN);
    clearFeedback();
  };
  const close = () => {
    setEditingId(null);
    setValues(emptyValues());
    setNewQrCode(undefined);
    setRetainedQrOriginalFilename('');
    setActiveLanguage(Language.GERMAN);
    clearFeedback();
  };
  const setLocalized = (
    owner: 'title' | 'description' | 'qrExplanation' | 'externalLinkLabel',
    language: Language,
    value: string
  ) => {
    setValues((current) => ({
      ...current,
      [owner]: { ...current[owner], [language]: value },
    }));
    clearRequestIssueFor(`${owner}.${language}`);
  };

  const save = async () => {
    setRequestIssue(undefined);
    const parsed = contactEntryValuesSchema.safeParse(values);
    if (!parsed.success) {
      setValidationAttempted(true);
      const firstIssue = parsed.error.issues.map(mapSchemaIssue)[0];
      toast.error(t('contact.validation.summaryToast'));
      if (firstIssue) focusIssue(firstIssue);
      return;
    }
    setValidationAttempted(false);
    const request: ContactEntryRequest = { ...parsed.data, newQrCode };
    try {
      if (editingId === 'new') {
        await create.mutateAsync(request);
        await notifySaved(t('contact.saved'));
      } else if (editingId) {
        const outcome = await update.mutateAsync({ id: editingId, request });
        await notifySaved(t('contact.updated'), outcome.mediaCleanupWarning);
      }
      close();
    } catch (error) {
      const code = apiErrorCode(error);
      const qrTranslationKey =
        code && code in contactQrErrorTranslationKeys
          ? contactQrErrorTranslationKeys[
              code as keyof typeof contactQrErrorTranslationKeys
            ]
          : undefined;
      const issue: ContactFormIssue = qrTranslationKey
        ? {
            key: 'qrCode',
            fieldId: 'contact-qr',
            label: fieldLabel('qrCode'),
            message: t(`contact.qrErrors.${qrTranslationKey}`),
            clearWithPendingQrSelection:
              code === 'INVALID_CONTACT_QR_UPLOAD' ||
              code === 'INVALID_CONTACT_QR_TYPE' ||
              code === 'INVALID_CONTACT_QR_SIZE' ||
              code === 'INVALID_CONTACT_QR_SIGNATURE',
          }
        : {
            message:
              code === 'CONTACT_ENTRY_LIMIT_REACHED'
                ? t('contact.limitReached')
                : t('contact.saveFailed'),
          };
      setRequestIssue(issue);
      toast.error(issue.message);
      focusIssue(issue);
    }
  };

  const toggle = async (entry: ContactEntryAdministration) => {
    try {
      const outcome = await update.mutateAsync({
        id: entry.id,
        request: { ...valuesFrom(entry), isActive: !entry.isActive },
      });
      await notifySaved(
        entry.isActive ? t('contact.hiddenOutcome') : t('contact.shownOutcome'),
        outcome.mediaCleanupWarning
      );
    } catch {
      toast.error(t('contact.saveFailed'));
    }
  };

  const deleteEntry = (entry: ContactEntryAdministration) =>
    confirm({
      title: t('contact.deleteTitle'),
      description: t('contact.deleteDescription', { name: entry.title.de }),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      variant: 'destructive',
      onConfirm: async () => {
        try {
          const outcome = await remove.mutateAsync(entry.id);
          await notifySaved(t('contact.deleted'), outcome.mediaCleanupWarning);
        } catch {
          toast.error(t('contact.deleteFailed'));
        }
      },
    });

  if (query.isPending && !query.data)
    return <p className="py-8 text-center">{t('contact.loading')}</p>;
  if (query.isError && !query.data)
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('contact.loadFailed')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void query.refetch()}>
            {t('common.retry')}
          </Button>
        </CardContent>
      </Card>
    );

  const completeness = getContactEntryCompleteness(values);
  const completenessItems = Object.entries(completeness).map(
    ([field, status]) => {
      const localizedField = field as LocalizedContactField;
      const requiresGermanContent =
        field === 'title' ||
        field === 'description' ||
        (field === 'externalLinkLabel' && Boolean(values.externalLink.trim()));
      const hasAnyValue = CONTENT_LANGUAGES.some((language) =>
        values[localizedField][language].trim()
      );
      const requiredMissing =
        requiresGermanContent &&
        !values[localizedField][Language.GERMAN].trim();
      const state = requiredMissing
        ? 'required-missing'
        : !requiresGermanContent && !hasAnyValue
          ? 'optional-missing'
          : status.complete
            ? 'complete'
            : 'optional-missing';
      return {
        field: localizedField,
        status,
        requiresGermanContent,
        hasAnyValue,
        requiredMissing,
        state,
      };
    }
  );
  const requiredContentComplete = completenessItems.every(
    (item) => !item.requiredMissing
  );
  const optionalFieldsNotProvided = completenessItems.filter(
    (item) => !item.requiresGermanContent && !item.hasAnyValue
  ).length;
  const pending = create.isPending || update.isPending;

  return (
    <div className="space-y-6">
      <ConfirmDialog {...confirmProps} />
      <PublicationFailureNotice
        visible={publication.hasPublicationFailure}
        retrying={publication.isRetrying}
        onRetry={() => void publication.retry()}
      />
      {query.isError && query.data && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-3"
        >
          <p className="text-sm">{t('contact.refreshFailed')}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
          >
            {t('common.retry')}
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">{t('contact.title')}</h2>
          <p className="text-muted-foreground">{t('contact.description')}</p>
        </div>
        {!editingId && (
          <div className="text-right">
            <Button onClick={openNew} disabled={maximumReached}>
              <Plus className="mr-2 h-4 w-4" />
              {t('contact.new')}
            </Button>
            {maximumReached && (
              <p className="mt-1 text-sm text-muted-foreground">
                {t('contact.maximum')}
              </p>
            )}
          </div>
        )}
      </div>

      {editingId && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingId === 'new' ? t('contact.new') : t('contact.edit')}
            </CardTitle>
            <CardDescription>{t('contact.formDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {formIssues.length > 0 && (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 p-4"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle
                    className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="font-medium">
                      {t('contact.validation.blockingTitle')}
                    </p>
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                      {formIssues.map((issue, index) => (
                        <li key={`${issue.key ?? 'form'}-${index}`}>
                          {issue.label ? `${issue.label}: ` : ''}
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact-category">
                  {t('contact.category')}
                </Label>
                <Input
                  id="contact-category"
                  value={values.category}
                  aria-invalid={Boolean(issueFor('category'))}
                  aria-describedby={
                    issueFor('category') ? 'contact-category-error' : undefined
                  }
                  onChange={(event) =>
                    updateValues(
                      { ...values, category: event.target.value },
                      'category'
                    )
                  }
                />
                {issueFor('category') && (
                  <p
                    id="contact-category-error"
                    className="text-sm text-destructive"
                  >
                    {issueFor('category')?.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-email">{t('contact.email')}</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={values.email}
                  aria-invalid={Boolean(issueFor('email'))}
                  aria-describedby={
                    issueFor('email') ? 'contact-email-error' : undefined
                  }
                  onChange={(event) =>
                    updateValues(
                      { ...values, email: event.target.value },
                      'email'
                    )
                  }
                />
                {issueFor('email') && (
                  <p
                    id="contact-email-error"
                    className="text-sm text-destructive"
                  >
                    {issueFor('email')?.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-order">{t('common.order')}</Label>
                <Input
                  id="contact-order"
                  type="number"
                  min={0}
                  value={values.order}
                  aria-invalid={Boolean(issueFor('order'))}
                  aria-describedby={
                    issueFor('order') ? 'contact-order-error' : undefined
                  }
                  onChange={(event) =>
                    updateValues(
                      {
                        ...values,
                        order: Number(event.target.value),
                      },
                      'order'
                    )
                  }
                />
                {issueFor('order') && (
                  <p
                    id="contact-order-error"
                    className="text-sm text-destructive"
                  >
                    {issueFor('order')?.message}
                  </p>
                )}
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    updateValues({ ...values, isActive: !values.isActive })
                  }
                >
                  {values.isActive ? (
                    <Eye className="mr-2 h-4 w-4" />
                  ) : (
                    <EyeOff className="mr-2 h-4 w-4" />
                  )}
                  {values.isActive ? t('common.active') : t('common.hidden')}
                </Button>
              </div>
            </div>
            <Tabs
              value={activeLanguage}
              onValueChange={(language) =>
                setActiveLanguage(language as Language)
              }
            >
              <TabsList>
                {CONTENT_LANGUAGES.map((language) => (
                  <TabsTrigger
                    key={language}
                    value={language}
                    aria-invalid={formIssues.some(
                      (issue) => issue.language === language
                    )}
                    className="aria-[invalid=true]:text-destructive"
                  >
                    {t(`common.languages.${language}`)}
                  </TabsTrigger>
                ))}
              </TabsList>
              {CONTENT_LANGUAGES.map((language) => (
                <TabsContent
                  key={language}
                  value={language}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label htmlFor={`contact-title-${language}`}>
                      {t('contact.entryTitle')}
                    </Label>
                    <Input
                      id={`contact-title-${language}`}
                      value={values.title[language]}
                      aria-invalid={Boolean(issueFor(`title.${language}`))}
                      aria-describedby={
                        issueFor(`title.${language}`)
                          ? `contact-title-${language}-error`
                          : undefined
                      }
                      onChange={(event) =>
                        setLocalized('title', language, event.target.value)
                      }
                    />
                    {issueFor(`title.${language}`) && (
                      <p
                        id={`contact-title-${language}-error`}
                        className="text-sm text-destructive"
                      >
                        {issueFor(`title.${language}`)?.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`contact-description-${language}`}>
                      {t('contact.shortDescription')}
                    </Label>
                    <Textarea
                      id={`contact-description-${language}`}
                      value={values.description[language]}
                      aria-invalid={Boolean(
                        issueFor(`description.${language}`)
                      )}
                      aria-describedby={
                        issueFor(`description.${language}`)
                          ? `contact-description-${language}-error`
                          : undefined
                      }
                      onChange={(event) =>
                        setLocalized(
                          'description',
                          language,
                          event.target.value
                        )
                      }
                    />
                    {issueFor(`description.${language}`) && (
                      <p
                        id={`contact-description-${language}-error`}
                        className="text-sm text-destructive"
                      >
                        {issueFor(`description.${language}`)?.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`contact-qr-label-${language}`}>
                      {t('contact.qrExplanation')}
                    </Label>
                    <Input
                      id={`contact-qr-label-${language}`}
                      value={values.qrExplanation[language]}
                      aria-invalid={Boolean(
                        issueFor(`qrExplanation.${language}`)
                      )}
                      aria-describedby={
                        issueFor(`qrExplanation.${language}`)
                          ? `contact-qr-label-${language}-error`
                          : undefined
                      }
                      onChange={(event) =>
                        setLocalized(
                          'qrExplanation',
                          language,
                          event.target.value
                        )
                      }
                    />
                    {issueFor(`qrExplanation.${language}`) && (
                      <p
                        id={`contact-qr-label-${language}-error`}
                        className="text-sm text-destructive"
                      >
                        {issueFor(`qrExplanation.${language}`)?.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`contact-link-label-${language}`}>
                      {t('contact.externalLinkLabel')}
                    </Label>
                    <Input
                      id={`contact-link-label-${language}`}
                      value={values.externalLinkLabel[language]}
                      aria-invalid={Boolean(
                        issueFor(`externalLinkLabel.${language}`)
                      )}
                      aria-describedby={
                        issueFor(`externalLinkLabel.${language}`)
                          ? `contact-link-label-${language}-error`
                          : undefined
                      }
                      onChange={(event) =>
                        setLocalized(
                          'externalLinkLabel',
                          language,
                          event.target.value
                        )
                      }
                    />
                    {issueFor(`externalLinkLabel.${language}`) && (
                      <p
                        id={`contact-link-label-${language}-error`}
                        className="text-sm text-destructive"
                      >
                        {issueFor(`externalLinkLabel.${language}`)?.message}
                      </p>
                    )}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact-link">
                  {t('contact.externalLink')}
                </Label>
                <Input
                  id="contact-link"
                  type="url"
                  value={values.externalLink}
                  aria-invalid={Boolean(issueFor('externalLink'))}
                  aria-describedby={
                    issueFor('externalLink') ? 'contact-link-error' : undefined
                  }
                  onChange={(event) =>
                    updateValues(
                      {
                        ...values,
                        externalLink: event.target.value,
                      },
                      'externalLink'
                    )
                  }
                />
                {issueFor('externalLink') && (
                  <p
                    id="contact-link-error"
                    className="text-sm text-destructive"
                  >
                    {issueFor('externalLink')?.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-qr">{t('contact.qrImage')}</Label>
                <Input
                  id="contact-qr"
                  ref={qrInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  aria-invalid={Boolean(issueFor('qrCode'))}
                  aria-describedby={
                    issueFor('qrCode') ? 'contact-qr-error' : undefined
                  }
                  onChange={(event) => {
                    clearPendingQrSelectionIssue();
                    setNewQrCode(event.target.files?.[0]);
                  }}
                />
                {issueFor('qrCode') && (
                  <p id="contact-qr-error" className="text-sm text-destructive">
                    {issueFor('qrCode')?.message}
                  </p>
                )}
                {values.retainedQrCode && (
                  <p className="text-sm text-muted-foreground">
                    {t('contact.currentQrFile', {
                      filename:
                        retainedQrOriginalFilename ||
                        t('contact.filenameUnavailable'),
                    })}
                  </p>
                )}
                {(newQrCode || values.retainedQrCode) && (
                  <div className="flex flex-wrap gap-2">
                    {newQrCode && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={clearPendingQrSelection}
                      >
                        {t('contact.clearSelectedQr')}
                      </Button>
                    )}
                    {values.retainedQrCode && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateValues(
                            { ...values, retainedQrCode: '' },
                            'qrCode'
                          )
                        }
                      >
                        {t('contact.removeQr')}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-3 rounded-md border bg-muted/30 p-4">
              <div className="flex items-start gap-3">
                <Info
                  className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <div>
                  <p className="font-medium">
                    {t('contact.completeness.title')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('contact.completeness.description')}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-1 text-sm font-medium">
                <span
                  className={
                    requiredContentComplete
                      ? 'text-green-700 dark:text-green-400'
                      : 'text-destructive'
                  }
                >
                  {requiredContentComplete
                    ? t('contact.completeness.requiredComplete')
                    : t('contact.completeness.requiredNeedsAttention')}
                </span>
                <span aria-hidden="true" className="text-muted-foreground">
                  ·
                </span>
                <span className="text-muted-foreground">
                  {t('contact.completeness.optionalFieldsNotProvided', {
                    count: optionalFieldsNotProvided,
                  })}
                </span>
              </div>
              <div
                className="grid gap-2 text-sm sm:grid-cols-2"
                aria-label={t('common.translationCompleteness')}
              >
                {completenessItems.map((item) => {
                  const missingLanguageCodes =
                    item.requiredMissing &&
                    item.status.missingLanguages.length === 0
                      ? CONTENT_LANGUAGES.filter(
                          (language) => !values[item.field][language].trim()
                        )
                      : item.status.missingLanguages;
                  const missingLanguages = missingLanguageCodes
                    .map((language: Language) =>
                      t(`common.languages.${language}`)
                    )
                    .join(', ');
                  const message =
                    item.state === 'complete'
                      ? t('common.complete')
                      : item.state === 'optional-missing' && !item.hasAnyValue
                        ? t('contact.completeness.notProvided')
                        : t('common.missingList', {
                            languages: missingLanguages,
                          });
                  const Icon =
                    item.state === 'complete'
                      ? CheckCircle2
                      : item.state === 'required-missing'
                        ? AlertCircle
                        : Info;
                  const stateClassName =
                    item.state === 'complete'
                      ? 'border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/20 dark:text-green-400'
                      : item.state === 'required-missing'
                        ? 'border-destructive/40 bg-destructive/10 text-destructive'
                        : 'border-border bg-background text-muted-foreground';
                  return (
                    <p
                      key={item.field}
                      className={`flex items-start gap-2 rounded-md border px-3 py-2 ${stateClassName}`}
                    >
                      <Icon
                        className="mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        <span className="font-medium">
                          {t(`contact.fields.${item.field}`)}:
                        </span>{' '}
                        {message}
                      </span>
                    </p>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <Button disabled={pending} onClick={() => void save()}>
                {pending ? t('common.saving') : t('contact.save')}
              </Button>
              <Button variant="outline" onClick={close}>
                {t('common.cancel')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {!editingId && (
        <div className="space-y-3">
          {(query.data ?? []).length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                {t('contact.empty')}
              </CardContent>
            </Card>
          )}
          {(query.data ?? []).map((entry) => (
            <Card key={entry.id}>
              <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{entry.title.de}</h3>
                    <Badge variant={entry.isActive ? 'secondary' : 'outline'}>
                      {entry.isActive ? t('common.active') : t('common.hidden')}
                    </Badge>
                    <Badge variant="outline">
                      {t('contact.order', { order: entry.order })}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {entry.category} · {entry.email}
                  </p>
                  {!entry.completeness.title.complete && (
                    <p className="text-xs text-muted-foreground">
                      {t('contact.missingTitle', {
                        languages: entry.completeness.title.missingLanguages
                          .map((language) => t(`common.languages.${language}`))
                          .join(', '),
                      })}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    aria-label={t('contact.editNamed', {
                      name: entry.title.de,
                    })}
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit(entry)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    {t('contact.editAction')}
                  </Button>
                  <Button
                    aria-label={t(
                      entry.isActive ? 'contact.hide' : 'contact.show',
                      { name: entry.title.de }
                    )}
                    variant="outline"
                    size="sm"
                    onClick={() => void toggle(entry)}
                  >
                    {entry.isActive ? (
                      <EyeOff className="mr-2 h-4 w-4" />
                    ) : (
                      <Eye className="mr-2 h-4 w-4" />
                    )}
                    {entry.isActive
                      ? t('contact.hideAction')
                      : t('contact.showAction')}
                  </Button>
                  <Button
                    aria-label={t('contact.deleteNamed', {
                      name: entry.title.de,
                    })}
                    variant="destructive"
                    size="sm"
                    onClick={() => deleteEntry(entry)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t('common.delete')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
