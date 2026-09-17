'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Info, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import type { ZodIssue } from 'zod';
import { CONTENT_LANGUAGES } from '@club/shared-types/api/localizedContent';
import type { LocalizedText } from '@club/shared-types/api/localizedContent';
import {
  EMPTY_TASTER_SESSION_PUBLIC_CONTENT,
  getTasterSessionPublicContentCompleteness,
  tasterSessionPublicContentValuesSchema,
  type TasterSessionPublicContentValues,
} from '@club/shared-types/api/tasterSessionPublicContent';
import {
  EMPTY_MEMBERSHIP_PUBLIC_CONTENT,
  getMembershipPublicContentCompleteness,
  membershipPublicContentValuesSchema,
  type MembershipPublicContentValues,
} from '@club/shared-types/api/membershipPublicContent';
import { Language } from '@club/shared-types/core/enums';
import { usePublication } from '@app/hooks/usePublication';
import { TasterSessionPublicContentService } from '@app/services/tasterSessionPublicContentService';
import { MembershipPublicContentService } from '@app/services/membershipPublicContentService';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@app/components/ui/tabs';
import { Textarea } from '@app/components/ui/textarea';
import { PublicationFailureNotice } from '../PublicationFailureNotice';
import { useTranslations } from 'next-intl';
import { ContentDomainHeader } from './ContentDomainHeader';

type ContentRecord = Record<string, LocalizedText>;
type Field = {
  key: string;
  labelKey: string;
  required: boolean;
  maxLength: number;
};

type LocalizedFormIssue = {
  field: string;
  language: Language;
  fieldId: string;
  kind: 'required' | 'tooLong' | 'invalid';
  max?: number;
};

function mapLocalizedIssues(
  zodIssues: ZodIssue[],
  fields: readonly Field[],
  idPrefix: string
): LocalizedFormIssue[] {
  return zodIssues.flatMap((issue) => {
    const field = String(issue.path[0] ?? '');
    const language = issue.path[1];
    const fieldOwner = fields.find((candidate) => candidate.key === field);
    if (!fieldOwner || typeof language !== 'string') return [];
    return [
      {
        field,
        language: language as Language,
        fieldId: `${idPrefix}-${field}-${language}`,
        kind:
          issue.message === 'German content is required'
            ? 'required'
            : issue.code === 'too_big'
              ? 'tooLong'
              : 'invalid',
        max: issue.code === 'too_big' ? Number(issue.maximum) : undefined,
      } satisfies LocalizedFormIssue,
    ];
  });
}

function LocalizedAggregateForm({
  content,
  fields,
  idPrefix,
  pending,
  activeLanguage,
  issues,
  requestError,
  onLanguageChange,
  onChange,
  onSave,
}: {
  content: ContentRecord;
  fields: readonly Field[];
  idPrefix: string;
  pending: boolean;
  activeLanguage: Language;
  issues: LocalizedFormIssue[];
  requestError?: string;
  onLanguageChange: (language: Language) => void;
  onChange: (content: ContentRecord) => void;
  onSave: () => void;
}) {
  const t = useTranslations('dashboard.cms');
  const issueFor = (field: string, language: Language) =>
    issues.find(
      (issue) => issue.field === field && issue.language === language
    );
  const issueMessage = (issue: LocalizedFormIssue) =>
    issue.kind === 'required'
      ? t('participation.feedback.required')
      : issue.kind === 'tooLong'
        ? t('participation.feedback.tooLong', { max: issue.max ?? 0 })
        : t('participation.feedback.invalid');
  return (
    <div className="space-y-6">
      {(issues.length > 0 || requestError) && (
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
                {issues.map((issue) => (
                  <li key={`${issue.field}-${issue.language}`}>
                    {t('participation.feedback.fieldInLanguage', {
                      field: t(
                        `participation.fields.${
                          fields.find((field) => field.key === issue.field)
                            ?.labelKey ?? issue.field
                        }`
                      ),
                      language: t(`common.languages.${issue.language}`),
                    })}
                    : {issueMessage(issue)}
                  </li>
                ))}
                {requestError && <li>{requestError}</li>}
              </ul>
            </div>
          </div>
        </div>
      )}
      <Tabs
        value={activeLanguage}
        onValueChange={(language) => onLanguageChange(language as Language)}
      >
        <TabsList className="grid w-full grid-cols-3">
          {CONTENT_LANGUAGES.map((language) => (
            <TabsTrigger
              key={language}
              value={language}
              aria-invalid={issues.some((issue) => issue.language === language)}
              className="aria-[invalid=true]:text-destructive"
            >
              {t(`common.languages.${language}`)}
            </TabsTrigger>
          ))}
        </TabsList>
        {CONTENT_LANGUAGES.map((language) => (
          <TabsContent key={language} value={language} className="space-y-5">
            {fields.map((field) => {
              const issue = issueFor(field.key, language);
              const errorId = `${idPrefix}-${field.key}-${language}-error`;
              return (
                <div key={field.key} className="space-y-2">
                  <Label htmlFor={`${idPrefix}-${field.key}-${language}`}>
                    {t(`participation.fields.${field.labelKey}`)}
                    {!field.required && ` (${t('common.optional')})`}
                  </Label>
                  <Textarea
                    id={`${idPrefix}-${field.key}-${language}`}
                    rows={field.key === 'homepageSummary' ? 3 : 5}
                    maxLength={field.maxLength}
                    value={content[field.key]?.[language] ?? ''}
                    aria-invalid={Boolean(issue)}
                    aria-describedby={issue ? errorId : undefined}
                    onChange={(event) =>
                      onChange({
                        ...content,
                        [field.key]: {
                          ...content[field.key],
                          [language]: event.target.value,
                        },
                      })
                    }
                  />
                  {issue && (
                    <p id={errorId} className="text-sm text-destructive">
                      {issueMessage(issue)}
                    </p>
                  )}
                  <p className="text-right text-xs text-muted-foreground">
                    {(content[field.key]?.[language] ?? '').length}/
                    {field.maxLength}
                  </p>
                </div>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>
      <div className="flex justify-end">
        <Button type="button" disabled={pending} onClick={onSave}>
          {pending ? <Loader2 className="animate-spin" /> : <Save />}
          {pending ? t('common.saving') : t('common.saveAndPublish')}
        </Button>
      </div>
    </div>
  );
}

const tasterFields = [
  {
    key: 'homepageSummary',
    labelKey: 'homepageSummary',
    required: true,
    maxLength: 500,
  },
  {
    key: 'introduction',
    labelKey: 'introduction',
    required: true,
    maxLength: 3000,
  },
  {
    key: 'preparation',
    labelKey: 'preparation',
    required: false,
    maxLength: 2000,
  },
  {
    key: 'participationGuidance',
    labelKey: 'participationGuidance',
    required: false,
    maxLength: 2000,
  },
  {
    key: 'followUpGuidance',
    labelKey: 'followUpGuidance',
    required: false,
    maxLength: 2000,
  },
] as const;

const membershipFields = [
  {
    key: 'homepageSummary',
    labelKey: 'homepageSummary',
    required: true,
    maxLength: 500,
  },
  {
    key: 'introduction',
    labelKey: 'introduction',
    required: true,
    maxLength: 3000,
  },
  {
    key: 'membershipTypes',
    labelKey: 'membershipTypes',
    required: true,
    maxLength: 3000,
  },
  {
    key: 'membershipPath',
    labelKey: 'membershipPath',
    required: true,
    maxLength: 3000,
  },
  {
    key: 'applicationPreparation',
    labelKey: 'applicationPreparation',
    required: false,
    maxLength: 2000,
  },
  {
    key: 'studentProof',
    labelKey: 'studentProof',
    required: false,
    maxLength: 2000,
  },
] as const;

function Completeness({
  values,
  content,
  fields,
}: {
  values: Record<string, { complete: boolean; missingLanguages: Language[] }>;
  content: ContentRecord;
  fields: readonly Field[];
}) {
  const t = useTranslations('dashboard.cms');
  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-4">
      <div className="flex items-start gap-3">
        <Info
          className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <div>
          <p className="font-medium">{t('participation.completeness.title')}</p>
          <p className="text-sm text-muted-foreground">
            {t('participation.completeness.description')}
          </p>
        </div>
      </div>
      <div
        className="flex flex-wrap gap-2"
        aria-label={t('common.translationCompleteness')}
      >
        {Object.entries(values).map(([field, status]) => {
          const optional = !fields.find((candidate) => candidate.key === field)
            ?.required;
          const hasValue = CONTENT_LANGUAGES.some((language) =>
            content[field]?.[language]?.trim()
          );
          return (
            <Badge
              key={field}
              variant={status.complete ? 'secondary' : 'outline'}
            >
              {t(`participation.fields.${field}`)}:{' '}
              {optional && !hasValue
                ? t('participation.completeness.notProvided')
                : status.complete
                  ? t('common.complete')
                  : t('common.missingList', {
                      languages: status.missingLanguages
                        .map((language) => t(`common.languages.${language}`))
                        .join(', '),
                    })}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}

function TasterEditor() {
  const t = useTranslations('dashboard.cms');
  const query = TasterSessionPublicContentService.useContent();
  const mutation = TasterSessionPublicContentService.useUpdateContent();
  const publication = usePublication();
  const [content, setContent] = useState<TasterSessionPublicContentValues>(
    EMPTY_TASTER_SESSION_PUBLIC_CONTENT
  );
  const [activeLanguage, setActiveLanguage] = useState(Language.GERMAN);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [requestError, setRequestError] = useState<string>();

  useEffect(() => {
    if (query.data) setContent(query.data.content);
  }, [query.data]);

  const parsedContent =
    tasterSessionPublicContentValuesSchema.safeParse(content);
  const issues =
    validationAttempted && !parsedContent.success
      ? mapLocalizedIssues(
          parsedContent.error.issues,
          tasterFields,
          'taster-information'
        )
      : [];

  const save = async () => {
    setRequestError(undefined);
    const parsed = tasterSessionPublicContentValuesSchema.safeParse(content);
    if (!parsed.success) {
      setValidationAttempted(true);
      const firstIssue = mapLocalizedIssues(
        parsed.error.issues,
        tasterFields,
        'taster-information'
      )[0];
      toast.error(t('participation.feedback.validationToast'));
      if (firstIssue) {
        setActiveLanguage(firstIssue.language);
        requestAnimationFrame(() =>
          document.getElementById(firstIssue.fieldId)?.focus()
        );
      }
      return;
    }
    setValidationAttempted(false);
    try {
      await mutation.mutateAsync(parsed.data);
      if (await publication.publish('taster-information')) {
        toast.success(t('participation.taster.savedPublished'));
      } else toast.warning(t('participation.taster.savedRefreshFailed'));
    } catch {
      const message = t('participation.taster.saveFailed');
      setRequestError(message);
      toast.error(message);
    }
  };

  if (query.isPending) return <p>{t('participation.taster.loading')}</p>;
  if (query.isError)
    return (
      <Button onClick={() => void query.refetch()}>
        {t('participation.taster.retry')}
      </Button>
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('participation.taster.title')}</CardTitle>
        <CardDescription>
          {t('participation.taster.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <PublicationFailureNotice
          visible={publication.hasPublicationFailure}
          retrying={publication.isRetrying}
          onRetry={() => void publication.retry()}
        />
        <Completeness
          values={getTasterSessionPublicContentCompleteness(content)}
          content={content}
          fields={tasterFields}
        />
        <LocalizedAggregateForm
          content={content}
          fields={tasterFields}
          idPrefix="taster-information"
          pending={mutation.isPending}
          activeLanguage={activeLanguage}
          issues={issues}
          requestError={requestError}
          onLanguageChange={setActiveLanguage}
          onChange={(value) => {
            setRequestError(undefined);
            setContent(value as TasterSessionPublicContentValues);
          }}
          onSave={() => void save()}
        />
      </CardContent>
    </Card>
  );
}

function MembershipEditor() {
  const t = useTranslations('dashboard.cms');
  const query = MembershipPublicContentService.useContent();
  const mutation = MembershipPublicContentService.useUpdateContent();
  const publication = usePublication();
  const [content, setContent] = useState<MembershipPublicContentValues>(
    EMPTY_MEMBERSHIP_PUBLIC_CONTENT
  );
  const [activeLanguage, setActiveLanguage] = useState(Language.GERMAN);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [requestError, setRequestError] = useState<string>();

  useEffect(() => {
    if (query.data) setContent(query.data.content);
  }, [query.data]);

  const parsedContent = membershipPublicContentValuesSchema.safeParse(content);
  const issues =
    validationAttempted && !parsedContent.success
      ? mapLocalizedIssues(
          parsedContent.error.issues,
          membershipFields,
          'membership-information'
        )
      : [];

  const save = async () => {
    setRequestError(undefined);
    const parsed = membershipPublicContentValuesSchema.safeParse(content);
    if (!parsed.success) {
      setValidationAttempted(true);
      const firstIssue = mapLocalizedIssues(
        parsed.error.issues,
        membershipFields,
        'membership-information'
      )[0];
      toast.error(t('participation.feedback.validationToast'));
      if (firstIssue) {
        setActiveLanguage(firstIssue.language);
        requestAnimationFrame(() =>
          document.getElementById(firstIssue.fieldId)?.focus()
        );
      }
      return;
    }
    setValidationAttempted(false);
    try {
      await mutation.mutateAsync(parsed.data);
      if (await publication.publish('membership-information')) {
        toast.success(t('participation.membership.savedPublished'));
      } else toast.warning(t('participation.membership.savedRefreshFailed'));
    } catch {
      const message = t('participation.membership.saveFailed');
      setRequestError(message);
      toast.error(message);
    }
  };

  if (query.isPending) return <p>{t('participation.membership.loading')}</p>;
  if (query.isError)
    return (
      <Button onClick={() => void query.refetch()}>
        {t('participation.membership.retry')}
      </Button>
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('participation.membership.title')}</CardTitle>
        <CardDescription>
          {t('participation.membership.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <PublicationFailureNotice
          visible={publication.hasPublicationFailure}
          retrying={publication.isRetrying}
          onRetry={() => void publication.retry()}
        />
        <Completeness
          values={getMembershipPublicContentCompleteness(content)}
          content={content}
          fields={membershipFields}
        />
        <LocalizedAggregateForm
          content={content}
          fields={membershipFields}
          idPrefix="membership-information"
          pending={mutation.isPending}
          activeLanguage={activeLanguage}
          issues={issues}
          requestError={requestError}
          onLanguageChange={setActiveLanguage}
          onChange={(value) => {
            setRequestError(undefined);
            setContent(value as MembershipPublicContentValues);
          }}
          onSave={() => void save()}
        />
      </CardContent>
    </Card>
  );
}

export default function MembershipParticipationContentEditor() {
  const t = useTranslations('dashboard.cms.content');
  const [activeTab, setActiveTab] = useState('membership');

  return (
    <div>
      <ContentDomainHeader domain="membershipParticipation" />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6 grid w-full grid-cols-2 items-stretch gap-1 group-data-[orientation=horizontal]/tabs:h-auto">
          <TabsTrigger
            value="membership"
            className="h-auto min-w-0 break-all whitespace-normal py-2"
          >
            {t('domains.membershipParticipation.tabs.membership')}
          </TabsTrigger>
          <TabsTrigger
            value="taster"
            className="h-auto min-w-0 break-all whitespace-normal py-2"
          >
            {t('domains.membershipParticipation.tabs.taster')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="membership">
          <MembershipEditor />
        </TabsContent>
        <TabsContent value="taster">
          <TasterEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
