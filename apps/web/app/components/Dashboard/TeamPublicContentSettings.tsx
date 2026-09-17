'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  EMPTY_TEAM_PUBLIC_CONTENT,
  getTeamPublicContentCompleteness,
  type TeamPublicContentValues,
} from '@club/shared-types/api/teamPublicContent';
import { CONTENT_LANGUAGES } from '@club/shared-types/api/localizedContent';
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
import { TeamPublicContentService } from '@app/services/teamPublicContentService';
import { PublicationFailureNotice } from './PublicationFailureNotice';

export default function TeamPublicContentSettings() {
  const t = useTranslations('dashboard.cms');
  const locale = useLocale() as Language;
  const [activeLanguage, setActiveLanguage] = useState<Language>(locale);
  const [content, setContent] = useState<TeamPublicContentValues>(
    EMPTY_TEAM_PUBLIC_CONTENT
  );
  const query = TeamPublicContentService.useContent();
  const mutation = TeamPublicContentService.useUpdateContent();
  const publication = usePublication();

  useEffect(() => {
    if (query.data) setContent(query.data.content);
  }, [query.data]);

  const handleSave = async () => {
    try {
      await mutation.mutateAsync(content);
      if (await publication.publish('teams')) {
        toast.success(t('team.savedPublished'));
      } else {
        toast.warning(t('team.savedRefreshFailed'));
      }
    } catch {
      toast.error(t('team.saveFailed'));
    }
  };

  const handleRetry = async () => {
    if (await publication.retry()) toast.success(t('publication.refreshed'));
    else toast.error(t('publication.failedAgain'));
  };

  if (query.isPending) {
    return (
      <Card>
        <CardContent className="flex justify-center py-12">
          <Loader2 className="animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (query.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('team.loadFailed')}</CardTitle>
          <CardDescription>{t('team.loadFailedDescription')}</CardDescription>
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

  const completeness = getTeamPublicContentCompleteness(content);

  return (
    <div className="space-y-4">
      <PublicationFailureNotice
        visible={publication.hasPublicationFailure}
        retrying={publication.isRetrying}
        onRetry={handleRetry}
      />
      <Card>
        <CardHeader>
          <CardTitle>{t('team.title')}</CardTitle>
          <CardDescription>{t('team.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-base font-medium">
                {t('team.showSection')}
              </Label>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('team.showSectionDescription')}
              </p>
            </div>
            <Button
              type="button"
              variant={content.enabled ? 'default' : 'outline'}
              size="sm"
              onClick={() =>
                setContent((value) => ({
                  ...value,
                  enabled: !value.enabled,
                }))
              }
            >
              {content.enabled ? t('common.enabled') : t('common.disabled')}
            </Button>
          </div>

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
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor={`team-content-title-${language}`}>
                    {t('team.introductionTitle')}
                  </Label>
                  <Input
                    id={`team-content-title-${language}`}
                    value={content.title[language]}
                    onChange={(event) =>
                      setContent((value) => ({
                        ...value,
                        title: {
                          ...value.title,
                          [language]: event.target.value,
                        },
                      }))
                    }
                    maxLength={200}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {!completeness.title.complete &&
                        t('common.missingList', {
                          languages: completeness.title.missingLanguages
                            .map((item) => t(`common.languages.${item}`))
                            .join(', '),
                        })}
                    </span>
                    <span>{content.title[language].length}/200</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`team-content-description-${language}`}>
                    {t('team.generalIntroduction')}
                  </Label>
                  <Textarea
                    id={`team-content-description-${language}`}
                    value={content.description[language]}
                    onChange={(event) =>
                      setContent((value) => ({
                        ...value,
                        description: {
                          ...value.description,
                          [language]: event.target.value,
                        },
                      }))
                    }
                    rows={6}
                    maxLength={2000}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      {!completeness.description.complete &&
                        t('common.missingList', {
                          languages: completeness.description.missingLanguages
                            .map((item) => t(`common.languages.${item}`))
                            .join(', '),
                        })}
                    </span>
                    <span>{content.description[language].length}/2000</span>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>

          <div className="flex justify-end">
            <Button
              type="button"
              disabled={mutation.isPending}
              onClick={handleSave}
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
    </div>
  );
}
