'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Info, Loader2, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { ZodIssue } from 'zod';
import { CONTENT_LANGUAGES } from '@club/shared-types/api/localizedContent';
import {
  EMPTY_RECRUITMENT_PUBLIC_CONTENT,
  getRecruitmentPublicContentCompleteness,
  recruitmentPublicContentValuesSchema,
  type RecruitmentPublicContentValues,
} from '@club/shared-types/api/recruitmentPublicContent';
import { Language } from '@club/shared-types/core/enums';
import { usePublication } from '@app/hooks/usePublication';
import { ContactEntryService } from '@app/services/contactEntryService';
import { RecruitmentPublicContentService } from '@app/services/recruitmentPublicContentService';
import { Badge } from '@app/components/ui/badge';
import { Button } from '@app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Label } from '@app/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@app/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@app/components/ui/tabs';
import { Textarea } from '@app/components/ui/textarea';
import { PublicationFailureNotice } from './PublicationFailureNotice';

const NO_CONTACT = '__none__';
const fields = ['introduction', 'requirements', 'tryoutGuidance'] as const;
type RecruitmentField = (typeof fields)[number];
type RecruitmentIssue = {
  field: RecruitmentField;
  language: Language;
  fieldId: string;
  kind: 'required' | 'tooLong' | 'invalid';
  max?: number;
};
type RecruitmentRequestIssue = {
  owner: 'contact' | 'form';
  message: string;
};

function mapRecruitmentIssues(zodIssues: ZodIssue[]): RecruitmentIssue[] {
  return zodIssues.flatMap((issue) => {
    const field = String(issue.path[0] ?? '');
    const language = issue.path[1];
    if (
      !fields.includes(field as RecruitmentField) ||
      typeof language !== 'string'
    ) {
      return [];
    }
    return [
      {
        field: field as RecruitmentField,
        language: language as Language,
        fieldId: `recruitment-${field}-${language}`,
        kind:
          issue.message === 'German content is required'
            ? 'required'
            : issue.code === 'too_big'
              ? 'tooLong'
              : 'invalid',
        max: issue.code === 'too_big' ? Number(issue.maximum) : undefined,
      } satisfies RecruitmentIssue,
    ];
  });
}

function apiErrorCode(error: unknown): string | undefined {
  const code = (error as { response?: { data?: { code?: unknown } } })?.response
    ?.data?.code;
  return typeof code === 'string' ? code : undefined;
}

export default function RecruitmentContentEditor() {
  const t = useTranslations('dashboard.cms');
  const query = RecruitmentPublicContentService.useContent();
  const contacts = ContactEntryService.useEntries();
  const mutation = RecruitmentPublicContentService.useUpdateContent();
  const publication = usePublication();
  const [content, setContent] = useState<RecruitmentPublicContentValues>(
    EMPTY_RECRUITMENT_PUBLIC_CONTENT
  );
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState(Language.GERMAN);
  const [requestIssue, setRequestIssue] = useState<RecruitmentRequestIssue>();

  useEffect(() => {
    if (query.data) setContent(query.data.content);
  }, [query.data]);

  const contactsHaveUsableData = contacts.data !== undefined;
  const contactsPending = contacts.isPending && !contactsHaveUsableData;
  const contactsUnavailable = contacts.isError && !contactsHaveUsableData;
  const contactsStale = contacts.isError && contactsHaveUsableData;
  const contactsFresh = contactsHaveUsableData && !contacts.isError;
  const activeContacts = (contacts.data ?? []).filter(
    (entry) => entry.isActive
  );
  const selectedContact = (contacts.data ?? []).find(
    (entry) => entry.id === content.contactEntryId
  );
  const contactInvalid =
    validationAttempted &&
    content.isOpen &&
    (!content.contactEntryId || (contactsFresh && !selectedContact?.isActive));
  const parsedContent = recruitmentPublicContentValuesSchema.safeParse(content);
  const contactIdSchemaInvalid =
    validationAttempted &&
    !parsedContent.success &&
    parsedContent.error.issues.some(
      (issue) => issue.path[0] === 'contactEntryId'
    );
  const localIssues =
    validationAttempted && !parsedContent.success
      ? mapRecruitmentIssues(parsedContent.error.issues)
      : [];
  const contactRequestIssue = requestIssue?.owner === 'contact';
  const blockingMessages = [
    ...localIssues.map((issue) => ({
      key: `${issue.field}-${issue.language}`,
      label: t('participation.feedback.fieldInLanguage', {
        field: t(`participation.fields.${issue.field}`),
        language: t(`common.languages.${issue.language}`),
      }),
      message:
        issue.kind === 'required'
          ? t('participation.feedback.required')
          : issue.kind === 'tooLong'
            ? t('participation.feedback.tooLong', { max: issue.max ?? 0 })
            : t('participation.feedback.invalid'),
    })),
    ...(contactInvalid || contactIdSchemaInvalid
      ? [
          {
            key: 'contact',
            label: t('participation.recruitment.contact'),
            message: contactIdSchemaInvalid
              ? t('participation.feedback.invalid')
              : t('participation.recruitment.contactRequired'),
          },
        ]
      : []),
    ...(validationAttempted && content.isOpen && contactsUnavailable
      ? [
          {
            key: 'contact-unavailable',
            label: t('participation.recruitment.contact'),
            message: t('participation.recruitment.contactUnavailable'),
          },
        ]
      : []),
    ...(validationAttempted && content.isOpen && contactsPending
      ? [
          {
            key: 'contact-pending',
            label: t('participation.recruitment.contact'),
            message: t('participation.recruitment.contactLoading'),
          },
        ]
      : []),
    ...(requestIssue
      ? [
          {
            key: `request-${requestIssue.owner}`,
            label:
              requestIssue.owner === 'contact'
                ? t('participation.recruitment.contact')
                : undefined,
            message: requestIssue.message,
          },
        ]
      : []),
  ];

  const updateContent = (
    updater: (
      current: RecruitmentPublicContentValues
    ) => RecruitmentPublicContentValues,
    owner?: 'contact'
  ) => {
    setContent(updater);
    setRequestIssue((current) =>
      !current || current.owner === 'form' || current.owner === owner
        ? undefined
        : current
    );
  };

  const save = async () => {
    setRequestIssue(undefined);
    setValidationAttempted(true);
    const parsed = recruitmentPublicContentValuesSchema.safeParse(content);
    const schemaIssues = parsed.success
      ? []
      : mapRecruitmentIssues(parsed.error.issues);
    const contactIdBlocked =
      !parsed.success &&
      parsed.error.issues.some((issue) => issue.path[0] === 'contactEntryId');
    const contactBlocked =
      contactIdBlocked ||
      (content.isOpen &&
        (!content.contactEntryId ||
          contactsPending ||
          contactsUnavailable ||
          (contactsFresh && !selectedContact?.isActive)));
    if (!parsed.success || contactBlocked) {
      toast.error(t('participation.feedback.validationToast'));
      const firstIssue = schemaIssues[0];
      if (firstIssue) {
        setActiveLanguage(firstIssue.language);
        requestAnimationFrame(() =>
          document.getElementById(firstIssue.fieldId)?.focus()
        );
      } else {
        requestAnimationFrame(() =>
          document.getElementById('recruitment-contact')?.focus()
        );
      }
      return;
    }
    try {
      await mutation.mutateAsync(parsed.data);
      if (await publication.publish('recruitment')) {
        toast.success(t('participation.recruitment.savedPublished'));
      } else {
        toast.warning(t('participation.recruitment.savedRefreshFailed'));
      }
    } catch (error) {
      const code = apiErrorCode(error);
      const issue: RecruitmentRequestIssue =
        code === 'RECRUITMENT_ACTIVE_CONTACT_REQUIRED'
          ? {
              owner: 'contact',
              message: t('participation.recruitment.contactRequired'),
            }
          : {
              owner: 'form',
              message: t('participation.recruitment.saveFailed'),
            };
      setRequestIssue(issue);
      toast.error(issue.message);
      if (issue.owner === 'contact') {
        requestAnimationFrame(() =>
          document.getElementById('recruitment-contact')?.focus()
        );
      }
    }
  };

  if (query.isPending) return <p>{t('participation.recruitment.loading')}</p>;
  if (query.isError)
    return (
      <Button onClick={() => void query.refetch()}>
        {t('participation.recruitment.retry')}
      </Button>
    );

  const completeness = getRecruitmentPublicContentCompleteness(content);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('participation.recruitment.title')}</CardTitle>
        <CardDescription>
          {t('participation.recruitment.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <PublicationFailureNotice
          visible={publication.hasPublicationFailure}
          retrying={publication.isRetrying}
          onRetry={() => void publication.retry()}
        />

        {blockingMessages.length > 0 && (
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
                  {t('participation.feedback.blockingTitle')}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                  {blockingMessages.map((issue) => (
                    <li key={issue.key}>
                      {issue.label ? `${issue.label}: ` : ''}
                      {issue.message}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="recruitment-status">
              {t('participation.recruitment.status')}
            </Label>
            <Select
              value={content.isOpen ? 'open' : 'paused'}
              onValueChange={(value) =>
                updateContent(
                  (current) => ({
                    ...current,
                    isOpen: value === 'open',
                  }),
                  'contact'
                )
              }
            >
              <SelectTrigger id="recruitment-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">
                  {t('participation.recruitment.open')}
                </SelectItem>
                <SelectItem value="paused">
                  {t('participation.recruitment.paused')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 space-y-2">
            <Label htmlFor="recruitment-contact">
              {t('participation.recruitment.contact')}
            </Label>
            <Select
              value={content.contactEntryId ?? NO_CONTACT}
              onValueChange={(value) =>
                updateContent(
                  (current) => ({
                    ...current,
                    contactEntryId: value === NO_CONTACT ? null : value,
                  }),
                  'contact'
                )
              }
              disabled={contacts.isPending}
            >
              <SelectTrigger
                id="recruitment-contact"
                className="w-full min-w-0"
                aria-invalid={
                  contactInvalid ||
                  contactIdSchemaInvalid ||
                  contactRequestIssue
                }
                aria-describedby={
                  contactInvalid ||
                  contactIdSchemaInvalid ||
                  contactRequestIssue
                    ? 'recruitment-contact-error'
                    : contactsPending || contactsUnavailable || contactsStale
                      ? 'recruitment-contact-status'
                      : undefined
                }
              >
                <SelectValue
                  placeholder={t(
                    'participation.recruitment.contactPlaceholder'
                  )}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CONTACT}>
                  {t('participation.recruitment.noContact')}
                </SelectItem>
                {activeContacts.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.title.de} — {entry.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {contactsFresh &&
              content.contactEntryId &&
              !selectedContact?.isActive && (
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {t('participation.recruitment.storedContactUnavailable')}
                </p>
              )}
            {(contactInvalid ||
              contactIdSchemaInvalid ||
              contactRequestIssue) && (
              <p
                id="recruitment-contact-error"
                className="text-sm text-destructive"
              >
                {requestIssue?.owner === 'contact'
                  ? requestIssue.message
                  : contactIdSchemaInvalid
                    ? t('participation.feedback.invalid')
                    : t('participation.recruitment.contactRequired')}
              </p>
            )}
            {contactsUnavailable && (
              <div
                id="recruitment-contact-status"
                className="flex items-center justify-between gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-3"
              >
                <p className="text-sm">
                  {t('participation.recruitment.contactUnavailable')}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void contacts.refetch()}
                >
                  {t('common.retry')}
                </Button>
              </div>
            )}
            {contactsPending && (
              <p
                id="recruitment-contact-status"
                className="text-sm text-muted-foreground"
              >
                {t('participation.recruitment.contactLoading')}
              </p>
            )}
            {contactsStale && (
              <div
                id="recruitment-contact-status"
                role="status"
                className="flex items-center justify-between gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-3"
              >
                <p className="text-sm">
                  {t('participation.recruitment.contactStale')}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void contacts.refetch()}
                >
                  {t('common.retry')}
                </Button>
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
                {t('participation.completeness.title')}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('participation.completeness.description')}
              </p>
            </div>
          </div>
          <div
            className="flex flex-wrap gap-2"
            aria-label={t('common.translationCompleteness')}
          >
            {fields.map((field) => (
              <Badge
                key={field}
                variant={completeness[field].complete ? 'secondary' : 'outline'}
              >
                {t(`participation.fields.${field}`)}:{' '}
                {completeness[field].complete
                  ? t('common.complete')
                  : t('common.missingList', {
                      languages: completeness[field].missingLanguages
                        .map((language) => t(`common.languages.${language}`))
                        .join(', '),
                    })}
              </Badge>
            ))}
          </div>
        </div>

        <Tabs
          value={activeLanguage}
          onValueChange={(language) => setActiveLanguage(language as Language)}
        >
          <TabsList className="grid w-full grid-cols-3">
            {CONTENT_LANGUAGES.map((language) => (
              <TabsTrigger
                key={language}
                value={language}
                aria-invalid={localIssues.some(
                  (issue) => issue.language === language
                )}
                className="aria-[invalid=true]:text-destructive"
              >
                {t(`common.languages.${language}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          {CONTENT_LANGUAGES.map((language) => (
            <TabsContent key={language} value={language} className="space-y-5">
              {fields.map((field) => {
                const issue = localIssues.find(
                  (candidate) =>
                    candidate.field === field && candidate.language === language
                );
                const invalid = Boolean(issue);
                const errorId = `recruitment-${field}-${language}-error`;
                return (
                  <div key={field} className="space-y-2">
                    <Label htmlFor={`recruitment-${field}-${language}`}>
                      {t(`participation.fields.${field}`)}
                    </Label>
                    <Textarea
                      id={`recruitment-${field}-${language}`}
                      rows={5}
                      maxLength={3000}
                      value={content[field][language]}
                      aria-invalid={invalid}
                      aria-describedby={invalid ? errorId : undefined}
                      onChange={(event) =>
                        updateContent((current) => ({
                          ...current,
                          [field]: {
                            ...current[field],
                            [language]: event.target.value,
                          },
                        }))
                      }
                    />
                    {invalid && (
                      <p id={errorId} className="text-sm text-destructive">
                        {issue?.kind === 'required'
                          ? t('participation.feedback.required')
                          : issue?.kind === 'tooLong'
                            ? t('participation.feedback.tooLong', {
                                max: issue.max ?? 0,
                              })
                            : t('participation.feedback.invalid')}
                      </p>
                    )}
                    <p className="text-right text-xs text-muted-foreground">
                      {content[field][language].length}/3000
                    </p>
                  </div>
                );
              })}
            </TabsContent>
          ))}
        </Tabs>

        <div className="flex justify-end">
          <Button
            type="button"
            disabled={mutation.isPending}
            onClick={() => void save()}
          >
            {mutation.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Save />
            )}
            {mutation.isPending
              ? t('common.saving')
              : t('common.saveAndPublish')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
