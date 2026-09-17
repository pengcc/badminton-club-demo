'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  EMPTY_CLUB_INFORMATION,
  getClubInformationCompleteness,
  type ClubInformationValues,
} from '@club/shared-types/api/clubInformation';
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
import { ClubInformationService } from '@app/services/clubInformationService';
import { PublicationFailureNotice } from './PublicationFailureNotice';

export default function ClubInformationEditor() {
  const t = useTranslations('dashboard.cms');
  const locale = useLocale() as Language;
  const [activeLanguage, setActiveLanguage] = useState<Language>(locale);
  const [content, setContent] = useState<ClubInformationValues>(
    EMPTY_CLUB_INFORMATION
  );
  const query = ClubInformationService.useContent();
  const mutation = ClubInformationService.useUpdateContent();
  const publication = usePublication();

  useEffect(() => {
    if (query.data) setContent(query.data.content);
  }, [query.data]);

  const handleSave = async () => {
    try {
      await mutation.mutateAsync(content);
      if (await publication.publish('homepage')) {
        toast.success(t('club.savedPublished'));
      } else {
        toast.warning(t('club.savedRefreshFailed'));
      }
    } catch {
      toast.error(t('club.saveFailed'));
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
          <CardTitle>{t('club.loadFailed')}</CardTitle>
          <CardDescription>{t('club.loadFailedDescription')}</CardDescription>
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

  const completeness = getClubInformationCompleteness(content);

  return (
    <div className="space-y-4">
      <PublicationFailureNotice
        visible={publication.hasPublicationFailure}
        retrying={publication.isRetrying}
        onRetry={handleRetry}
      />
      <Card>
        <CardHeader>
          <CardTitle>{t('club.title')}</CardTitle>
          <CardDescription>{t('club.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="officialNameGerman">
                {t('club.officialName')}
              </Label>
              <Input
                id="officialNameGerman"
                maxLength={200}
                value={content.officialNameGerman}
                onChange={(event) =>
                  setContent((value) => ({
                    ...value,
                    officialNameGerman: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nameEnglish">{t('club.englishName')}</Label>
              <Input
                id="nameEnglish"
                maxLength={200}
                value={content.nameEnglish}
                onChange={(event) =>
                  setContent((value) => ({
                    ...value,
                    nameEnglish: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nameChinese">{t('club.chineseName')}</Label>
              <Input
                id="nameChinese"
                maxLength={200}
                value={content.nameChinese}
                onChange={(event) =>
                  setContent((value) => ({
                    ...value,
                    nameChinese: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shortName">{t('club.shortName')}</Label>
              <Input
                id="shortName"
                maxLength={40}
                value={content.shortName}
                onChange={(event) =>
                  setContent((value) => ({
                    ...value,
                    shortName: event.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="foundingYear">{t('club.foundingYear')}</Label>
              <Input
                id="foundingYear"
                type="number"
                min={1800}
                max={2200}
                value={content.foundingYear || ''}
                onChange={(event) =>
                  setContent((value) => ({
                    ...value,
                    foundingYear: Number(event.target.value),
                  }))
                }
              />
            </div>
            {!completeness.nameTranslations.complete && (
              <p className="text-xs text-muted-foreground md:col-span-2">
                {t('common.missing')}:{' '}
                {completeness.nameTranslations.missingLanguages
                  .map((item) => t(`common.languages.${item}`))
                  .join(', ')}
              </p>
            )}
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
                className="space-y-2"
              >
                <Label htmlFor={`clubIntroduction-${language}`}>
                  {t('club.introduction')}
                </Label>
                <Textarea
                  id={`clubIntroduction-${language}`}
                  rows={7}
                  maxLength={3000}
                  value={content.introduction[language]}
                  onChange={(event) =>
                    setContent((value) => ({
                      ...value,
                      introduction: {
                        ...value.introduction,
                        [language]: event.target.value,
                      },
                    }))
                  }
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {!completeness.introduction.complete &&
                      t('common.missingList', {
                        languages: completeness.introduction.missingLanguages
                          .map((item) => t(`common.languages.${item}`))
                          .join(', '),
                      })}
                  </span>
                  <span>{content.introduction[language].length}/3000</span>
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
