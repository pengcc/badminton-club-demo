'use client';

import React, { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ActivityService } from '@app/services/activityService';
import { Language } from '@club/shared-types/core/enums';
import { Button } from '@app/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Badge } from '@app/components/ui/badge';
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
import { ActivityImageEditor } from './ActivityImageEditor';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Save,
  X,
  ImageIcon,
  Video,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  ActivityMediaCleanupWarning,
  ActivityRequest,
} from '@app/lib/api/activityApi';
import { getActivityCompleteness } from '@club/shared-types/api/activity';
import { usePublication } from '@app/hooks/usePublication';
import { PublicationFailureNotice } from './PublicationFailureNotice';

interface ActivityFormData {
  translations: {
    de: { name: string; description: string };
    en: { name: string; description: string };
    zh: { name: string; description: string };
  };
  images: string[];
  newImages: File[];
  videoLink: string;
  videoDescription: { de: string; en: string; zh: string };
  isVisible: boolean;
  order: number;
}

const emptyFormData: ActivityFormData = {
  translations: {
    de: { name: '', description: '' },
    en: { name: '', description: '' },
    zh: { name: '', description: '' },
  },
  images: [],
  newImages: [],
  videoLink: '',
  videoDescription: { de: '', en: '', zh: '' },
  isVisible: true,
  order: 0,
};

export default function ActivityManager({
  readOnly = false,
}: {
  readOnly?: boolean;
}) {
  const t = useTranslations('dashboard.cms');
  const tDialog = useTranslations('dashboard.dialogActions');
  const currentLocale = useLocale() as Language;
  const [activeLanguage, setActiveLanguage] = useState<Language>(currentLocale);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOwnerId, setFormOwnerId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ActivityFormData>(emptyFormData);
  const { confirm: confirmDialog, confirmProps } = useConfirmDialog({
    confirmText: tDialog('confirm'),
    cancelText: tDialog('cancel'),
    pendingText: tDialog('processing'),
  });

  // Queries
  const {
    data: availability,
    isLoading: isAvailabilityLoading,
    isError: isAvailabilityError,
    refetch: refetchAvailability,
  } = ActivityService.useAvailability();
  const {
    data: activities,
    isLoading: isListLoading,
    isError: isListError,
    refetch: refetchActivities,
  } = ActivityService.useAdminActivities(currentLocale);
  const {
    data: editingActivity,
    isFetching: isDetailFetching,
    isError: isDetailError,
    refetch: refetchActivity,
  } = ActivityService.useActivity(editingId || '');

  // Mutations
  const createMutation = ActivityService.useCreateActivity();
  const availabilityMutation = ActivityService.useUpdateAvailability();
  const updateMutation = ActivityService.useUpdateActivity();
  const toggleMutation = ActivityService.useToggleActivity();
  const deleteMutation = ActivityService.useDeleteActivity();
  const publication = usePublication();

  const publishActivities = async (
    savedMessage: string,
    mediaCleanupWarning: ActivityMediaCleanupWarning | null = null
  ) => {
    if (await publication.publish('activities')) {
      if (mediaCleanupWarning) toast.warning(t('activity.mediaCleanupWarning'));
      else toast.success(t('publication.success', { item: savedMessage }));
    } else {
      const message = mediaCleanupWarning
        ? t('activity.mediaCleanupAndRefreshFailed')
        : t('publication.failed', { item: savedMessage });
      toast.warning(message);
    }
  };

  const handlePublicationRetry = async () => {
    if (await publication.retry()) toast.success(t('publication.refreshed'));
    else toast.error(t('publication.failedAgain'));
  };

  const handleAvailabilityChange = async () => {
    if (!availability) return;
    const enabled = !availability.enabled;
    try {
      await availabilityMutation.mutateAsync(enabled);
      await publishActivities(
        t(
          enabled
            ? 'activity.availability.enabledSaved'
            : 'activity.availability.disabledSaved'
        )
      );
    } catch {
      toast.error(t('activity.availability.saveFailed'));
    }
  };

  // Effect to populate form when editing
  React.useEffect(() => {
    if (
      editingId &&
      formOwnerId !== editingId &&
      editingActivity?.id === editingId
    ) {
      setFormData({
        translations: editingActivity.translations,
        images: editingActivity.images ?? [],
        newImages: [],
        videoLink: editingActivity.videoLink ?? '',
        videoDescription: editingActivity.videoDescription,
        isVisible: editingActivity.isVisible,
        order: editingActivity.order,
      });
      setFormOwnerId(editingId);
    }
  }, [editingId, editingActivity, formOwnerId]);

  const handleCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setFormOwnerId(null);
    setFormData(emptyFormData);
  };

  const handleEdit = (id: string) => {
    setFormData(emptyFormData);
    setFormOwnerId(null);
    setEditingId(id);
    setIsCreating(false);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    setFormOwnerId(null);
    setFormData(emptyFormData);
  };

  const handleSave = async () => {
    if (!formData.translations.de.name.trim()) {
      toast.error(t('activity.germanNameRequired'));
      return;
    }

    try {
      const requestData: ActivityRequest = {
        translations: formData.translations,
        retainedImages: formData.images,
        newImages: formData.newImages,
        videoLink: formData.videoLink,
        videoDescription: formData.videoDescription,
        isVisible: formData.isVisible,
        order: formData.order,
      };

      if (editingId) {
        const outcome = await updateMutation.mutateAsync({
          id: editingId,
          data: requestData,
        });
        await publishActivities(
          t('activity.updated'),
          outcome.mediaCleanupWarning
        );
      } else {
        await createMutation.mutateAsync(requestData);
        await publishActivities(t('activity.created'));
      }

      handleCancel();
    } catch {
      toast.error(t('activity.saveFailed'));
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await toggleMutation.mutateAsync(id);
      await publishActivities(t('activity.visibilityUpdated'));
    } catch {
      toast.error(t('activity.toggleFailed'));
    }
  };

  const handleDelete = (id: string) => {
    confirmDialog({
      title: t('activity.deleteTitle'),
      description: t('activity.deleteDescription'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      variant: 'destructive',
      onConfirm: async () => {
        try {
          const outcome = await deleteMutation.mutateAsync(id);
          await publishActivities(
            t('activity.deleted'),
            outcome.mediaCleanupWarning
          );
        } catch {
          toast.error(t('activity.deleteFailed'));
        }
      },
    });
  };

  const updateVideoDescription = (lang: Language, value: string) => {
    setFormData((previous) => ({
      ...previous,
      videoDescription: { ...previous.videoDescription, [lang]: value },
    }));
  };

  const completeness = getActivityCompleteness(
    formData.translations,
    formData.videoDescription
  );

  const updateTranslation = (
    lang: Language,
    field: 'name' | 'description',
    value: string
  ) => {
    setFormData((prev) => ({
      ...prev,
      translations: {
        ...prev.translations,
        [lang]: {
          ...prev.translations[lang],
          [field]: value,
        },
      },
    }));
  };

  if (isListLoading && activities === undefined) {
    return (
      <div className="flex justify-center p-8">{t('activity.loading')}</div>
    );
  }

  if (isListError && activities === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('activity.loadFailed')}</CardTitle>
          <CardDescription>
            {t('activity.loadFailedDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void refetchActivities()}>
            {t('common.retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const activityList = activities ?? [];
  const hasInitializedDetail = editingId !== null && formOwnerId === editingId;
  const isDetailLoading =
    editingId !== null && !hasInitializedDetail && !isDetailError;
  const isInitialDetailError =
    editingId !== null && !hasInitializedDetail && isDetailError;
  const isBackgroundDetailError = hasInitializedDetail && isDetailError;
  const canEdit = hasInitializedDetail;

  return (
    <div className="space-y-6">
      <ConfirmDialog {...confirmProps} />
      <PublicationFailureNotice
        visible={!readOnly && publication.hasPublicationFailure}
        retrying={publication.isRetrying}
        onRetry={handlePublicationRetry}
      />
      <Card>
        <CardHeader>
          <CardTitle>{t('activity.availability.title')}</CardTitle>
          <CardDescription>
            {t('activity.availability.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {isAvailabilityLoading && availability === undefined ? (
            <p className="text-sm text-muted-foreground">
              {t('activity.availability.loading')}
            </p>
          ) : isAvailabilityError && availability === undefined ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted-foreground">
                {t('activity.availability.loadFailed')}
              </p>
              <Button
                variant="outline"
                onClick={() => void refetchAvailability()}
              >
                {t('common.retry')}
              </Button>
            </div>
          ) : availability ? (
            <>
              <div className="space-y-2">
                <Badge variant={availability.enabled ? 'default' : 'secondary'}>
                  {t(
                    availability.enabled
                      ? 'activity.availability.enabled'
                      : 'activity.availability.disabled'
                  )}
                </Badge>
                {isAvailabilityError && (
                  <p className="text-sm text-muted-foreground">
                    {t('activity.availability.refreshFailed')}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {isAvailabilityError && (
                  <Button
                    variant="outline"
                    onClick={() => void refetchAvailability()}
                  >
                    {t('common.retry')}
                  </Button>
                )}
                {!readOnly && (
                  <Button
                    variant={availability.enabled ? 'outline' : 'default'}
                    disabled={availabilityMutation.isPending}
                    onClick={handleAvailabilityChange}
                  >
                    {availabilityMutation.isPending
                      ? t('activity.availability.saving')
                      : t(
                          availability.enabled
                            ? 'activity.availability.disable'
                            : 'activity.availability.enable'
                        )}
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
      {isListError && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <p className="text-sm text-muted-foreground">
              {t('activity.refreshFailed')}
            </p>
            <Button variant="outline" onClick={() => void refetchActivities()}>
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {t('activity.title')}
          </h2>
          <p className="text-muted-foreground">{t('activity.description')}</p>
        </div>
        {!readOnly && !isListError && !isCreating && !editingId && (
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {t('activity.new')}
          </Button>
        )}
      </div>

      {/* Create/Edit Form */}
      {isDetailLoading && (
        <Card>
          <CardHeader>
            <CardTitle>{t('activity.loadingOne')}</CardTitle>
            <CardDescription>
              {t('activity.loadingOneDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={handleCancel}>
              {t('common.cancel')}
            </Button>
          </CardContent>
        </Card>
      )}
      {isInitialDetailError && (
        <Card>
          <CardHeader>
            <CardTitle>{t('activity.loadOneFailed')}</CardTitle>
            <CardDescription>
              {t('activity.loadOneFailedDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={() => void refetchActivity()}>
              {t('common.retry')}
            </Button>
            <Button variant="outline" onClick={handleCancel}>
              {t('common.cancel')}
            </Button>
          </CardContent>
        </Card>
      )}
      {isBackgroundDetailError && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <p className="text-sm text-muted-foreground">
              {t('activity.refreshOneFailed')}
            </p>
            <Button variant="outline" onClick={() => void refetchActivity()}>
              {t('common.retry')}
            </Button>
          </CardContent>
        </Card>
      )}
      {(isCreating || canEdit) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingId ? t('activity.edit') : t('activity.create')}
              {editingId && isDetailFetching && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({t('activity.refreshing')})
                </span>
              )}
            </CardTitle>
            <CardDescription>{t('activity.formDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Language Tabs */}
            <Tabs
              value={activeLanguage}
              onValueChange={(val) => setActiveLanguage(val as Language)}
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value={Language.GERMAN}>
                  {t('common.languages.de')}
                </TabsTrigger>
                <TabsTrigger value={Language.ENGLISH}>
                  {t('common.languages.en')}
                </TabsTrigger>
                <TabsTrigger value={Language.CHINESE}>
                  {t('common.languages.zh')}
                </TabsTrigger>
              </TabsList>

              {[Language.GERMAN, Language.ENGLISH, Language.CHINESE].map(
                (lang) => (
                  <TabsContent key={lang} value={lang} className="space-y-4">
                    {[
                      completeness.name,
                      completeness.description,
                      completeness.videoDescription,
                    ].some((field) =>
                      field.missingLanguages.includes(lang)
                    ) && (
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        {t('activity.incomplete')}
                      </p>
                    )}
                    <div>
                      <Label htmlFor={`name-${lang}`}>
                        {t('activity.name')}
                      </Label>
                      <Input
                        id={`name-${lang}`}
                        value={formData.translations[lang].name}
                        onChange={(e) =>
                          updateTranslation(lang, 'name', e.target.value)
                        }
                        placeholder={t('activity.namePlaceholder')}
                        maxLength={200}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`description-${lang}`}>
                        {t('activity.contentDescription')}
                      </Label>
                      <Textarea
                        id={`description-${lang}`}
                        value={formData.translations[lang].description}
                        onChange={(e) =>
                          updateTranslation(lang, 'description', e.target.value)
                        }
                        placeholder={t('activity.descriptionPlaceholder')}
                        rows={5}
                        maxLength={5000}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`videoDescription-${lang}`}>
                        {t('activity.videoDescription')}
                      </Label>
                      <Input
                        id={`videoDescription-${lang}`}
                        value={formData.videoDescription[lang]}
                        onChange={(event) =>
                          updateVideoDescription(lang, event.target.value)
                        }
                        placeholder={t('activity.videoDescriptionPlaceholder')}
                        maxLength={200}
                      />
                    </div>
                  </TabsContent>
                )
              )}
            </Tabs>

            {/* Images */}
            <div>
              <Label className="mb-2 block">{t('activity.imagesLabel')}</Label>
              <ActivityImageEditor
                retainedImages={formData.images}
                newImages={formData.newImages}
                onRetainedImagesChange={(urls) =>
                  setFormData((prev) => ({ ...prev, images: urls }))
                }
                onNewImagesChange={(files) =>
                  setFormData((prev) => ({ ...prev, newImages: files }))
                }
                maxImages={10}
              />
            </div>

            {/* Video */}
            <div>
              <div>
                <Label htmlFor="videoLink">{t('activity.videoLink')}</Label>
                <Input
                  id="videoLink"
                  value={formData.videoLink}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      videoLink: e.target.value,
                    }))
                  }
                  placeholder="https://youtube.com/watch?v=..."
                  maxLength={500}
                />
              </div>
            </div>

            {/* Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="order">{t('common.order')}</Label>
                <Input
                  id="order"
                  type="number"
                  value={formData.order}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      order: parseInt(e.target.value) || 0,
                    }))
                  }
                  min={0}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="isVisible"
                  checked={formData.isVisible}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      isVisible: e.target.checked,
                    }))
                  }
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="isVisible" className="cursor-pointer">
                  {t('activity.visible')}
                </Label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                {t('common.cancel')}
              </Button>
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {createMutation.isPending || updateMutation.isPending
                  ? t('common.saving')
                  : t('common.save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Activities List */}
      <div className="space-y-4">
        {activityList.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">
                {t('activity.empty')}
              </p>
              {!readOnly && (
                <Button onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('activity.createFirst')}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          activityList.map((activity) => (
            <Card
              key={activity.id}
              className={!activity.isVisible ? 'opacity-60' : ''}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">{activity.name}</CardTitle>
                      {!activity.isVisible && (
                        <Badge variant="outline">{t('common.hidden')}</Badge>
                      )}
                      {activity.completeness &&
                        Object.values(activity.completeness).some(
                          (field) => !field.complete
                        ) && (
                          <Badge variant="secondary">
                            {t('activity.translationsIncomplete')}
                          </Badge>
                        )}
                    </div>
                    <CardDescription className="flex items-center gap-3">
                      {activity.images.length > 0 && (
                        <span className="flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" />
                          {t('activity.imageCount', {
                            count: activity.images.length,
                          })}
                        </span>
                      )}
                      {activity.videoLink && (
                        <span className="flex items-center gap-1">
                          <Video className="h-3 w-3" />
                          {t('activity.video')}
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  {!readOnly && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(activity.id)}
                        disabled={toggleMutation.isPending}
                        aria-label={t(
                          activity.isVisible
                            ? 'activity.hide'
                            : 'activity.show',
                          { name: activity.name }
                        )}
                      >
                        {activity.isVisible ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(activity.id)}
                        aria-label={t('activity.editNamed', {
                          name: activity.name,
                        })}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(activity.id)}
                        disabled={deleteMutation.isPending}
                        aria-label={t('activity.deleteNamed', {
                          name: activity.name,
                        })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              {activity.description && (
                <CardContent>
                  <p className="text-muted-foreground line-clamp-2">
                    {activity.description}
                  </p>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
