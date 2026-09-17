'use client';

import React, { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LocationService } from '@app/services/locationService';
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
import { Checkbox } from '@app/components/ui/checkbox';
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
import { Plus, Edit, Trash2, Eye, EyeOff, Save, X, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import type { LocationRequest } from '@app/lib/api/locationApi';
import type { LocationTimeSlotInput } from '@club/shared-types/api/location';
import type { LocationTasterSessionLevel } from '@club/shared-types/api/location';
import { LOCATION_WEEKDAYS } from '@club/shared-types/api/location';
import { getLocationWeekdayLabel } from '@app/lib/locationTimeSlots';
import { usePublication } from '@app/hooks/usePublication';
import { PublicationFailureNotice } from './PublicationFailureNotice';

interface LocationFormData {
  translations: {
    de: { name: string; address: string };
    en: { name: string; address: string };
    zh: { name: string; address: string };
  };
  timeSlots: LocationTimeSlotInput[];
  imageUrl: string;
  isActive: boolean;
  order: number;
}

const emptyFormData: LocationFormData = {
  translations: {
    de: { name: '', address: '' },
    en: { name: '', address: '' },
    zh: { name: '', address: '' },
  },
  timeSlots: [],
  imageUrl: '',
  isActive: true,
  order: 0,
};

export default function LocationManager() {
  const t = useTranslations('dashboard.cms');
  const tDialog = useTranslations('dashboard.dialogActions');
  const currentLocale = useLocale() as Language;
  const [activeLanguage, setActiveLanguage] = useState<Language>(currentLocale);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<LocationFormData>(emptyFormData);
  const { confirm: confirmDialog, confirmProps } = useConfirmDialog({
    confirmText: tDialog('confirm'),
    cancelText: tDialog('cancel'),
    pendingText: tDialog('processing'),
  });

  // Queries - use current locale for list display
  const {
    data: locations,
    isLoading,
    isError,
    isRefetchError,
    isFetching,
    refetch: refetchLocations,
  } = LocationService.useAdminLocations(currentLocale);

  // Detail query uses `enabled: !!id` internally, so always call it but use isFetching for loading state
  const { data: editingLocation, isFetching: isLoadingDetails } =
    LocationService.useLocation(editingId || '');

  // Mutations
  const createMutation = LocationService.useCreateLocation();
  const updateMutation = LocationService.useUpdateLocation();
  const toggleMutation = LocationService.useToggleLocation();
  const deleteMutation = LocationService.useDeleteLocation();
  const publication = usePublication();

  const publishHomepage = async (savedMessage: string) => {
    if (await publication.publish('locations')) {
      toast.success(t('publication.success', { item: savedMessage }));
    } else {
      toast.warning(t('publication.failed', { item: savedMessage }));
    }
  };

  const handlePublicationRetry = async () => {
    if (await publication.retry()) toast.success(t('publication.refreshed'));
    else toast.error(t('publication.failedAgain'));
  };

  // Effect to populate form when editing
  React.useEffect(() => {
    if (editingId && editingLocation) {
      setFormData({
        translations: editingLocation.translations,
        timeSlots: editingLocation.timeSlots,
        imageUrl: editingLocation.imageUrl,
        isActive: editingLocation.isActive,
        order: editingLocation.order,
      });
    }
  }, [editingId, editingLocation]);

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
    try {
      const requestData: LocationRequest = {
        translations: formData.translations,
        timeSlots: formData.timeSlots,
        imageUrl: formData.imageUrl,
        isActive: formData.isActive,
        order: formData.order,
      };

      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, data: requestData });
        await publishHomepage(t('location.updated'));
      } else {
        await createMutation.mutateAsync(requestData);
        await publishHomepage(t('location.created'));
      }

      handleCancel();
    } catch {
      toast.error(t('location.saveFailed'));
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await toggleMutation.mutateAsync(id);
      await publishHomepage(t('location.visibilityUpdated'));
    } catch {
      toast.error(t('location.toggleFailed'));
    }
  };

  const handleDelete = (id: string) => {
    confirmDialog({
      title: t('location.deleteTitle'),
      description: t('location.deleteDescription'),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await deleteMutation.mutateAsync(id);
          await publishHomepage(t('location.deleted'));
        } catch {
          toast.error(t('location.deleteFailed'));
        }
      },
    });
  };

  const updateTranslation = (
    lang: Language,
    field: 'name' | 'address',
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

  const addTimeSlot = () => {
    setFormData((prev) => ({
      ...prev,
      timeSlots: [
        ...prev.timeSlots,
        {
          weekday: 'monday',
          startTime: '19:00',
          endTime: '21:00',
          active: true,
          guestPlayEnabled: true,
          tasterSessionEnabled: true,
          tasterSessionAcceptedLevels: ['beginner', 'experienced'],
        },
      ],
    }));
  };

  const updateTimeSlot = <Field extends keyof LocationTimeSlotInput>(
    index: number,
    field: Field,
    value: LocationTimeSlotInput[Field]
  ) => {
    setFormData((prev) => ({
      ...prev,
      timeSlots: prev.timeSlots.map((slot, i) =>
        i === index ? { ...slot, [field]: value } : slot
      ),
    }));
  };

  const updateTimeSlotNote = (index: number, lang: Language, value: string) => {
    setFormData((prev) => ({
      ...prev,
      timeSlots: prev.timeSlots.map((slot, i) =>
        i === index ? { ...slot, note: { ...slot.note, [lang]: value } } : slot
      ),
    }));
  };

  const updateTasterSessionLevel = (
    index: number,
    level: LocationTasterSessionLevel,
    checked: boolean
  ) => {
    setFormData((previous) => ({
      ...previous,
      timeSlots: previous.timeSlots.map((slot, slotIndex) => {
        if (slotIndex !== index) return slot;
        const levels = slot.tasterSessionAcceptedLevels ?? [
          'beginner',
          'experienced',
        ];
        if (
          !checked &&
          (slot.tasterSessionEnabled ?? true) &&
          levels.includes(level) &&
          levels.length === 1
        ) {
          return slot;
        }
        return {
          ...slot,
          tasterSessionAcceptedLevels: checked
            ? [...new Set([...levels, level])]
            : levels.filter((candidate) => candidate !== level),
        };
      }),
    }));
  };

  const removeTimeSlot = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      timeSlots: prev.timeSlots.filter((_, i) => i !== index),
    }));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">{t('location.loading')}</div>
    );
  }

  if (isError && !locations) {
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>{t('location.loadFailed')}</CardTitle>
          <CardDescription>
            {t('location.loadFailedDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => void refetchLocations()}>
            {t('common.retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const visibleLocations = locations ?? [];

  return (
    <div className="space-y-6">
      <ConfirmDialog {...confirmProps} />
      <PublicationFailureNotice
        visible={publication.hasPublicationFailure}
        retrying={publication.isRetrying}
        onRetry={handlePublicationRetry}
      />
      {isRefetchError && locations !== undefined && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-md border border-amber-500/50 bg-amber-500/10 p-3"
        >
          <p className="text-sm">{t('location.refreshFailed')}</p>
          <Button
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => void refetchLocations()}
          >
            {t('common.retry')}
          </Button>
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {t('location.title')}
          </h2>
          <p className="text-muted-foreground">{t('location.description')}</p>
        </div>
        {!isCreating && !editingId && (
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {t('location.new')}
          </Button>
        )}
      </div>

      {/* Create/Edit Form */}
      {(isCreating || editingId) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingId ? t('location.edit') : t('location.create')}
              {isLoadingDetails && (
                <span className="ml-2 text-sm text-muted-foreground">
                  ({t('common.loading')})
                </span>
              )}
            </CardTitle>
            <CardDescription>{t('common.allLanguages')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Language Tabs */}
            <Tabs
              value={activeLanguage}
              onValueChange={(val) => setActiveLanguage(val as Language)}
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value={Language.ENGLISH}>
                  {t('common.languages.en')}
                </TabsTrigger>
                <TabsTrigger value={Language.GERMAN}>
                  {t('common.languages.de')}
                </TabsTrigger>
                <TabsTrigger value={Language.CHINESE}>
                  {t('common.languages.zh')}
                </TabsTrigger>
              </TabsList>

              {[Language.ENGLISH, Language.GERMAN, Language.CHINESE].map(
                (lang) => (
                  <TabsContent key={lang} value={lang} className="space-y-4">
                    <div>
                      <Label htmlFor={`name-${lang}`}>
                        {t('location.name')}
                      </Label>
                      <Input
                        id={`name-${lang}`}
                        value={formData.translations[lang].name}
                        onChange={(e) =>
                          updateTranslation(lang, 'name', e.target.value)
                        }
                        placeholder="Sports Hall: TU"
                        maxLength={200}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`address-${lang}`}>
                        {t('location.address')}
                      </Label>
                      <Textarea
                        id={`address-${lang}`}
                        value={formData.translations[lang].address}
                        onChange={(e) =>
                          updateTranslation(lang, 'address', e.target.value)
                        }
                        placeholder="Tempelhofer Ufer 19, 10963 Berlin"
                        rows={3}
                        maxLength={500}
                      />
                    </div>
                  </TabsContent>
                )
              )}
            </Tabs>

            {/* Weekly time slots */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <Label>{t('location.playTimes')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('location.playTimesDescription')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTimeSlot}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {t('location.addTime')}
                </Button>
              </div>
              <div className="space-y-3">
                {formData.timeSlots.map((slot, index) => (
                  <div
                    key={slot.id ?? `new-${index}`}
                    className="rounded-md border p-4 space-y-4"
                  >
                    <div className="grid gap-3 md:grid-cols-[1.25fr_1fr_1fr_auto] md:items-end">
                      <div className="space-y-2">
                        <Label htmlFor={`weekday-${index}`}>
                          {t('location.weekday')}
                        </Label>
                        <Select
                          value={slot.weekday}
                          onValueChange={(value) =>
                            updateTimeSlot(
                              index,
                              'weekday',
                              value as LocationTimeSlotInput['weekday']
                            )
                          }
                        >
                          <SelectTrigger
                            id={`weekday-${index}`}
                            className="w-full"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LOCATION_WEEKDAYS.map((weekday) => (
                              <SelectItem key={weekday} value={weekday}>
                                {getLocationWeekdayLabel(
                                  weekday,
                                  currentLocale
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`start-time-${index}`}>
                          {t('location.start')}
                        </Label>
                        <Input
                          id={`start-time-${index}`}
                          type="time"
                          value={slot.startTime}
                          onChange={(e) =>
                            updateTimeSlot(index, 'startTime', e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor={`end-time-${index}`}>
                          {t('location.end')}
                        </Label>
                        <Input
                          id={`end-time-${index}`}
                          type="time"
                          value={slot.endTime}
                          onChange={(e) =>
                            updateTimeSlot(index, 'endTime', e.target.value)
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-label={t('location.removeTime', {
                          number: index + 1,
                        })}
                        onClick={() => removeTimeSlot(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-6">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`slot-active-${index}`}
                          checked={slot.active}
                          onCheckedChange={(checked) =>
                            updateTimeSlot(index, 'active', Boolean(checked))
                          }
                        />
                        <Label htmlFor={`slot-active-${index}`}>
                          {t('common.active')}
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`slot-guest-play-${index}`}
                          checked={slot.guestPlayEnabled ?? true}
                          onCheckedChange={(checked) =>
                            updateTimeSlot(
                              index,
                              'guestPlayEnabled',
                              Boolean(checked)
                            )
                          }
                        />
                        <Label htmlFor={`slot-guest-play-${index}`}>
                          {t('location.guestPlay')}
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`slot-taster-session-${index}`}
                          checked={slot.tasterSessionEnabled ?? true}
                          onCheckedChange={(checked) =>
                            updateTimeSlot(
                              index,
                              'tasterSessionEnabled',
                              Boolean(checked)
                            )
                          }
                        />
                        <Label htmlFor={`slot-taster-session-${index}`}>
                          {t('location.tasterSession')}
                        </Label>
                      </div>
                    </div>
                    <fieldset
                      className="space-y-2"
                      disabled={!(slot.tasterSessionEnabled ?? true)}
                      aria-describedby={`slot-taster-level-guidance-${index}`}
                    >
                      <legend className="text-sm font-medium">
                        {t('location.acceptedLevels')}
                      </legend>
                      <div className="flex flex-wrap gap-6">
                        {(['beginner', 'experienced'] as const).map((level) => (
                          <div key={level} className="flex items-center gap-2">
                            <Checkbox
                              id={`slot-taster-${level}-${index}`}
                              checked={(
                                slot.tasterSessionAcceptedLevels ?? [
                                  'beginner',
                                  'experienced',
                                ]
                              ).includes(level)}
                              onCheckedChange={(checked) =>
                                updateTasterSessionLevel(
                                  index,
                                  level,
                                  Boolean(checked)
                                )
                              }
                            />
                            <Label
                              htmlFor={`slot-taster-${level}-${index}`}
                              className="capitalize"
                            >
                              {t(`location.levels.${level}`)}
                            </Label>
                          </div>
                        ))}
                      </div>
                      <p
                        id={`slot-taster-level-guidance-${index}`}
                        className="text-xs text-muted-foreground"
                      >
                        {t('location.levelGuidance')}
                      </p>
                    </fieldset>
                    <div className="space-y-2">
                      <Label htmlFor={`slot-note-${index}`}>
                        {t('location.note', {
                          language: t(`common.languages.${activeLanguage}`),
                        })}
                      </Label>
                      <Textarea
                        id={`slot-note-${index}`}
                        value={slot.note?.[activeLanguage] ?? ''}
                        onChange={(event) =>
                          updateTimeSlotNote(
                            index,
                            activeLanguage,
                            event.target.value
                          )
                        }
                        maxLength={500}
                        rows={2}
                        placeholder={t('location.notePlaceholder')}
                      />
                    </div>
                  </div>
                ))}
                {formData.timeSlots.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t('location.noTimes')}
                  </p>
                )}
              </div>
            </div>

            {/* Image URL */}
            <div>
              <Label htmlFor="imageUrl">{t('location.imageUrl')}</Label>
              <Input
                id="imageUrl"
                value={formData.imageUrl}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, imageUrl: e.target.value }))
                }
                placeholder="/images/location-tu.jpeg"
              />
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

      {/* Locations List */}
      <div className="space-y-4">
        {visibleLocations.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">
                {t('location.empty')}
              </p>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                {t('location.createFirst')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          visibleLocations.map((location) => (
            <Card
              key={location.id}
              className={!location.isActive ? 'opacity-60' : ''}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{location.name}</CardTitle>
                      {!location.isActive && (
                        <Badge variant="outline">{t('common.hidden')}</Badge>
                      )}
                    </div>
                    <CardDescription>{location.address}</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t(
                        location.isActive ? 'location.hide' : 'location.show',
                        { name: location.name }
                      )}
                      onClick={() => handleToggle(location.id)}
                      disabled={toggleMutation.isPending}
                    >
                      {location.isActive ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t('location.editNamed', {
                        name: location.name,
                      })}
                      onClick={() => handleEdit(location.id)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={t('location.deleteNamed', {
                        name: location.name,
                      })}
                      onClick={() => handleDelete(location.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  <strong>{t('location.playTimes')}:</strong>
                  {location.timeSlots.length > 0 ? (
                    <ul className="mt-2 space-y-1">
                      {location.timeSlots.map((slot) => (
                        <li key={slot.id}>
                          •{' '}
                          {getLocationWeekdayLabel(slot.weekday, currentLocale)}
                          : {slot.startTime}–{slot.endTime}
                          {!slot.active && ` (${t('common.inactive')})`}
                          {slot.guestPlayEnabled &&
                            ` · ${t('location.guestPlayShort')}`}
                          {(slot.tasterSessionEnabled ?? true) &&
                            ` · ${t('location.tasterSessionShort')} (${(
                              slot.tasterSessionAcceptedLevels ?? [
                                'beginner',
                                'experienced',
                              ]
                            )
                              .map((level) => t(`location.levels.${level}`))
                              .join(', ')})`}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="ml-2">
                      {t('location.noTimesSpecified')}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
