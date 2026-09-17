'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  CONTENT_LANGUAGES,
  getLocalizedTextCompleteness,
} from '@club/shared-types/api/localizedContent';
import {
  EMPTY_HOMEPAGE_CONTENT,
  type HomepageContentField,
  type HomepageContentValues,
} from '@club/shared-types/api/homepageContent';
import { Language } from '@club/shared-types/core/enums';
import { Button } from '@app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Input } from '@app/components/ui/input';
import { Label } from '@app/components/ui/label';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@app/components/ui/tabs';
import { Textarea } from '@app/components/ui/textarea';
import { usePublication } from '@app/hooks/usePublication';
import { HomepageContentService } from '@app/services/homepageContentService';
import { PublicationFailureNotice } from './PublicationFailureNotice';

const fields: Array<{
  key: HomepageContentField;
  labelKey: string;
  descriptionKey: string;
  optional: boolean;
  multiline: boolean;
  maxLength: number;
}> = [
  {
    key: 'mainMessage',
    labelKey: 'mainMessage',
    descriptionKey: 'mainMessageDescription',
    optional: false,
    multiline: false,
    maxLength: 500,
  },
  {
    key: 'visitUsIntroduction',
    labelKey: 'visitIntroduction',
    descriptionKey: 'visitIntroductionDescription',
    optional: true,
    multiline: true,
    maxLength: 2000,
  },
  {
    key: 'contactIntroduction',
    labelKey: 'contactIntroduction',
    descriptionKey: 'contactIntroductionDescription',
    optional: true,
    multiline: true,
    maxLength: 2000,
  },
];

export default function HomepageCopyEditor() {
  const t = useTranslations('dashboard.cms');
  const locale = useLocale() as Language;
  const [activeLanguage, setActiveLanguage] = useState<Language>(locale);
  const [content, setContent] = useState<HomepageContentValues>(
    EMPTY_HOMEPAGE_CONTENT
  );
  const query = HomepageContentService.useContent();
  const updateMutation = HomepageContentService.useUpdateContent();
  const publication = usePublication();

  useEffect(() => {
    if (query.data) setContent(query.data.content);
  }, [query.data]);

  const updateField = (
    field: HomepageContentField,
    language: Language,
    value: string
  ) => {
    setContent((current) => ({
      ...current,
      [field]: { ...current[field], [language]: value },
    }));
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync(content);
      const published = await publication.publish('homepage');
      if (published) toast.success(t('homepage.savedPublished'));
      else toast.warning(t('homepage.savedRefreshFailed'));
    } catch {
      toast.error(t('homepage.saveFailed'));
    }
  };

  const handleRetry = async () => {
    if (await publication.retry()) toast.success(t('publication.refreshed'));
    else toast.error(t('publication.failedAgain'));
  };

  if (query.isPending) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (query.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('homepage.loadFailed')}</CardTitle>
          <CardDescription>
            {t('homepage.loadFailedDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="outline"
            onClick={() => query.refetch()}
          >
            {t('common.retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PublicationFailureNotice
        visible={publication.hasPublicationFailure}
        retrying={publication.isRetrying}
        onRetry={handleRetry}
      />
      <Card>
        <CardHeader>
          <CardTitle>{t('homepage.title')}</CardTitle>
          <CardDescription>{t('homepage.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs
            value={activeLanguage}
            onValueChange={(value) => setActiveLanguage(value as Language)}
          >
            <TabsList className="grid w-full grid-cols-3">
              {CONTENT_LANGUAGES.map((language) => (
                <TabsTrigger key={language} value={language}>
                  {t(`common.languages.${language}`)}
                </TabsTrigger>
              ))}
            </TabsList>

            {CONTENT_LANGUAGES.map((language) => (
              <TabsContent
                key={language}
                value={language}
                className="space-y-6"
              >
                {fields.map((field) => {
                  const completeness = getLocalizedTextCompleteness(
                    content[field.key],
                    field.optional
                  );
                  const id = `${field.key}-${language}`;
                  const value = content[field.key][language];
                  return (
                    <div key={field.key} className="space-y-2">
                      <Label htmlFor={id}>
                        {t(`homepage.${field.labelKey}`)}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {t(`homepage.${field.descriptionKey}`)}
                      </p>
                      {field.multiline ? (
                        <Textarea
                          id={id}
                          rows={5}
                          maxLength={field.maxLength}
                          value={value}
                          onChange={(event) =>
                            updateField(field.key, language, event.target.value)
                          }
                        />
                      ) : (
                        <Input
                          id={id}
                          maxLength={field.maxLength}
                          value={value}
                          onChange={(event) =>
                            updateField(field.key, language, event.target.value)
                          }
                        />
                      )}
                      <div className="flex justify-between gap-3 text-xs text-muted-foreground">
                        <span>
                          {!completeness.complete &&
                            t('common.missingList', {
                              languages: completeness.missingLanguages
                                .map((item) => t(`common.languages.${item}`))
                                .join(', '),
                            })}
                        </span>
                        <span>
                          {value.length}/{field.maxLength}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </TabsContent>
            ))}
          </Tabs>

          <div className="flex justify-end">
            <Button
              type="button"
              disabled={updateMutation.isPending}
              onClick={handleSave}
            >
              {updateMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Save />
              )}
              {updateMutation.isPending
                ? t('common.saving')
                : t('common.saveAndPublish')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
