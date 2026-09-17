'use client';

import React, { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AnnouncementService } from '@app/services/announcementService';
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
import {
  ConfirmDialog,
  useConfirmDialog,
} from '@app/components/ui/confirm-dialog';
import { Plus, Edit, Trash2, Eye, EyeOff, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import type {
  AnnouncementRequest,
  AnnouncementType,
} from '@app/lib/api/announcementApi';
import { AnnouncementType as AnnouncementTypeEnum } from '@app/lib/api/announcementApi';
import { usePublication } from '@app/hooks/usePublication';
import { PublicationFailureNotice } from './PublicationFailureNotice';
import { useOptionalAuth } from '@app/hooks/useAuth';
import { DemoEditingService } from '@app/services/demoEditingService';

interface AnnouncementFormData {
  translations: {
    de: { title: string; content: string };
    en: { title: string; content: string };
    zh: { title: string; content: string };
  };
  type: AnnouncementType;
  displayDate: string;
  externalLink: string;
  isActive: boolean;
  order: number;
}

const emptyFormData: AnnouncementFormData = {
  translations: {
    de: { title: '', content: '' },
    en: { title: '', content: '' },
    zh: { title: '', content: '' },
  },
  type: AnnouncementTypeEnum.INFO,
  displayDate: new Date().toISOString().split('T')[0].replace(/-/g, '.'),
  externalLink: '',
  isActive: true,
  order: 0,
};

function DemoEditingAvailability({
  onChange,
}: {
  onChange: (active: boolean) => void;
}) {
  const status = DemoEditingService.useStatus();
  React.useEffect(() => {
    onChange(status.data?.mode === 'active');
  }, [onChange, status.data?.mode]);
  return null;
}

export default function AnnouncementManager() {
  const t = useTranslations('dashboard.cms.announcement');
  const tCommon = useTranslations('dashboard.cms.common');
  const tPublication = useTranslations('dashboard.cms.publication');
  const tDemo = useTranslations('dashboard.demo');
  const tDialog = useTranslations('dashboard.dialogActions');
  const currentLocale = useLocale() as Language;
  const demoMode = Boolean(useOptionalAuth()?.user.demoMode);
  const [demoEditingActive, setDemoEditingActive] = useState(false);
  const canEditDemo = !demoMode || demoEditingActive;
  const [activeLanguage, setActiveLanguage] = useState<Language>(currentLocale);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AnnouncementFormData>(emptyFormData);
  const { confirm: confirmDialog, confirmProps } = useConfirmDialog({
    confirmText: tDialog('confirm'),
    cancelText: tDialog('cancel'),
    pendingText: tDialog('processing'),
  });

  // Queries - use current locale for list display
  const announcementsQuery =
    AnnouncementService.useAdminAnnouncements(currentLocale);
  const announcements = announcementsQuery.data ?? [];

  // Detail query uses `enabled: !!id` internally, so always call it but use isFetching for loading state
  const editingQuery = AnnouncementService.useAnnouncement(editingId || '');
  const editingAnnouncement = editingQuery.data;
  const isLoadingDetails = editingQuery.isFetching;

  // Mutations
  const createMutation = AnnouncementService.useCreateAnnouncement();
  const updateMutation = AnnouncementService.useUpdateAnnouncement();
  const toggleMutation = AnnouncementService.useToggleAnnouncement();
  const deleteMutation = AnnouncementService.useDeleteAnnouncement();
  const publication = usePublication();

  const publishHomepage = async (savedMessage: string) => {
    if (await publication.publish('homepage')) {
      toast.success(tPublication('success', { item: savedMessage }));
    } else {
      toast.warning(tPublication('failed', { item: savedMessage }));
    }
  };

  const handlePublicationRetry = async () => {
    if (await publication.retry()) toast.success(tPublication('refreshed'));
    else toast.error(tPublication('failedAgain'));
  };

  // Effect to populate form when editing
  React.useEffect(() => {
    if (editingId && editingAnnouncement) {
      setFormData({
        translations: editingAnnouncement.translations,
        type: editingAnnouncement.type,
        displayDate: editingAnnouncement.displayDate,
        externalLink: editingAnnouncement.externalLink,
        isActive: editingAnnouncement.isActive,
        order: editingAnnouncement.order,
      });
    }
  }, [editingId, editingAnnouncement]);

  React.useEffect(() => {
    if (demoMode && !demoEditingActive) {
      setIsCreating(false);
      setEditingId(null);
    }
  }, [demoEditingActive, demoMode]);

  const handleCreate = () => {
    setIsCreating(true);
    setEditingId(null);
    setFormData(emptyFormData);
  };

  const handleEdit = (id: string) => {
    setEditingId(id);
    setIsCreating(false);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    setFormData(emptyFormData);
  };

  const handleSave = async () => {
    if (
      !formData.translations.de.title.trim() ||
      !formData.translations.de.content.trim()
    ) {
      toast.error(t('germanRequired'));
      return;
    }

    try {
      const requestData: AnnouncementRequest = {
        translations: formData.translations,
        type: formData.type,
        displayDate: formData.displayDate,
        externalLink: formData.externalLink,
        isActive: formData.isActive,
        order: formData.order,
      };

      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: requestData });
        if (!demoMode) await publishHomepage(t('updated'));
      } else {
        await createMutation.mutateAsync(requestData);
        if (!demoMode) await publishHomepage(t('created'));
      }

      handleCancel();
    } catch {
      toast.error(t('saveFailed'));
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await toggleMutation.mutateAsync(id);
      await publishHomepage(t('visibilityUpdated'));
    } catch {
      toast.error(t('toggleFailed'));
    }
  };

  const handleDelete = (id: string) => {
    confirmDialog({
      title: t('deleteTitle'),
      description: t('deleteDescription'),
      confirmText: tCommon('delete'),
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await deleteMutation.mutateAsync(id);
          await publishHomepage(t('deleted'));
        } catch {
          toast.error(t('deleteFailed'));
        }
      },
    });
  };

  const updateTranslation = (
    lang: Language,
    field: 'title' | 'content',
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

  const getTypeBadgeVariant = (type: AnnouncementType) => {
    switch (type) {
      case 'important':
        return 'destructive';
      case 'warning':
        return 'default';
      default:
        return 'secondary';
    }
  };

  if (announcementsQuery.isLoading) {
    return <div className="flex justify-center p-8">{t('loading')}</div>;
  }

  if (announcementsQuery.isError && !announcementsQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('loadFailed')}</CardTitle>
          <CardDescription>{t('loadFailedDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => announcementsQuery.refetch()}>
            {tCommon('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {demoMode && <DemoEditingAvailability onChange={setDemoEditingActive} />}
      <ConfirmDialog {...confirmProps} />
      <PublicationFailureNotice
        visible={!demoMode && publication.hasPublicationFailure}
        retrying={publication.isRetrying}
        onRetry={handlePublicationRetry}
      />
      {announcementsQuery.isRefetchError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {t('refreshFailed')}
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{t('title')}</h2>
          <p className="text-muted-foreground">{t('description')}</p>
        </div>
        {!isCreating && !editingId && canEditDemo && (
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {t('new')}
          </Button>
        )}
      </div>

      {/* Create/Edit Form */}
      {editingId && isLoadingDetails && !editingAnnouncement && (
        <Card>
          <CardHeader>
            <CardTitle>{t('loadingOne')}</CardTitle>
            <CardDescription>{t('loadingOneDescription')}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {editingId && editingQuery.isError && !editingAnnouncement && (
        <Card>
          <CardHeader>
            <CardTitle>{t('loadOneFailed')}</CardTitle>
            <CardDescription>{t('loadOneFailedDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button onClick={() => editingQuery.refetch()}>
              {tCommon('retry')}
            </Button>
            <Button variant="outline" onClick={handleCancel}>
              {tCommon('cancel')}
            </Button>
          </CardContent>
        </Card>
      )}

      {(isCreating || (editingId && editingAnnouncement)) && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? t('edit') : t('create')}</CardTitle>
            <CardDescription>{t('formDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Language Tabs */}
            <Tabs
              value={activeLanguage}
              onValueChange={(val) => setActiveLanguage(val as Language)}
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value={Language.GERMAN}>
                  {tCommon('languages.de')}
                </TabsTrigger>
                <TabsTrigger value={Language.ENGLISH}>
                  {tCommon('languages.en')}
                </TabsTrigger>
                <TabsTrigger value={Language.CHINESE}>
                  {tCommon('languages.zh')}
                </TabsTrigger>
              </TabsList>

              {[Language.GERMAN, Language.ENGLISH, Language.CHINESE].map(
                (lang) => (
                  <TabsContent key={lang} value={lang} className="space-y-4">
                    <div>
                      <Label htmlFor={`title-${lang}`}>
                        {t('fieldTitle')}
                        {lang === Language.GERMAN
                          ? ' *'
                          : ` (${tCommon('optional')})`}
                      </Label>
                      <Input
                        id={`title-${lang}`}
                        value={formData.translations[lang].title}
                        onChange={(e) =>
                          updateTranslation(lang, 'title', e.target.value)
                        }
                        placeholder={t('titlePlaceholder')}
                        maxLength={200}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`content-${lang}`}>
                        {t('fieldContent')}
                        {lang === Language.GERMAN
                          ? ' *'
                          : ` (${tCommon('optional')})`}
                      </Label>
                      <Textarea
                        id={`content-${lang}`}
                        value={formData.translations[lang].content}
                        onChange={(e) =>
                          updateTranslation(lang, 'content', e.target.value)
                        }
                        placeholder={t('contentPlaceholder')}
                        rows={4}
                        maxLength={2000}
                      />
                    </div>
                  </TabsContent>
                )
              )}
            </Tabs>

            {/* Metadata */}
            <div
              className={`grid grid-cols-1 gap-4 ${demoMode ? '' : 'md:grid-cols-3'}`}
            >
              <div>
                <Label htmlFor="type">{t('type')}</Label>
                <Select
                  value={formData.type}
                  onValueChange={(val) =>
                    setFormData((prev) => ({
                      ...prev,
                      type: val as AnnouncementType,
                    }))
                  }
                >
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">{t('types.info')}</SelectItem>
                    <SelectItem value="important">
                      {t('types.important')}
                    </SelectItem>
                    <SelectItem value="warning">
                      {t('types.warning')}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!demoMode && (
                <>
                  <div>
                    <Label htmlFor="displayDate">{t('displayDate')}</Label>
                    <Input
                      id="displayDate"
                      value={formData.displayDate}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          displayDate: e.target.value,
                        }))
                      }
                      placeholder="YYYY.MM.DD"
                      pattern="\d{4}\.\d{2}\.\d{2}"
                    />
                  </div>

                  <div>
                    <Label htmlFor="order">{tCommon('order')}</Label>
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
                </>
              )}
            </div>

            {!demoMode && (
              <div>
                <Label htmlFor="externalLink">{t('externalLink')}</Label>
                <Input
                  id="externalLink"
                  type="url"
                  value={formData.externalLink}
                  onChange={(event) =>
                    setFormData((previous) => ({
                      ...previous,
                      externalLink: event.target.value,
                    }))
                  }
                  placeholder="https://"
                />
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('externalLinkDescription')}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-2" />
                {tCommon('cancel')}
              </Button>
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {createMutation.isPending || updateMutation.isPending
                  ? tCommon('saving')
                  : tCommon('save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Announcements List */}
      <div className="space-y-4">
        {announcements.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">{t('empty')}</p>
              {canEditDemo && (
                <Button onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('createFirst')}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          announcements.map((announcement) => (
            <Card
              key={announcement.id}
              className={!announcement.isActive ? 'opacity-60' : ''}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">
                        {announcement.title}
                      </CardTitle>
                      <Badge variant={getTypeBadgeVariant(announcement.type)}>
                        {t(`types.${announcement.type}`)}
                      </Badge>
                      {!announcement.isActive && (
                        <Badge variant="outline">{tCommon('hidden')}</Badge>
                      )}
                      {announcement.isDemoScratch && (
                        <Badge variant="secondary">
                          {tDemo('scratchLabel')}
                        </Badge>
                      )}
                    </div>
                    <CardDescription>
                      {announcement.displayDate}
                    </CardDescription>
                  </div>
                  {!demoMode && (
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t(announcement.isActive ? 'hide' : 'show', {
                          title: announcement.title,
                        })}
                        onClick={() => handleToggle(announcement.id)}
                        disabled={toggleMutation.isPending}
                      >
                        {announcement.isActive ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t('editNamed', {
                          title: announcement.title,
                        })}
                        onClick={() => handleEdit(announcement.id)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={t('deleteNamed', {
                          title: announcement.title,
                        })}
                        onClick={() => handleDelete(announcement.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  {demoMode && canEditDemo && announcement.isDemoScratch && (
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t('editNamed', {
                        title: announcement.title,
                      })}
                      onClick={() => handleEdit(announcement.id)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{announcement.content}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
