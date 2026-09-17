'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocale, useTranslations } from 'next-intl';
import { Calendar, Clock, MapPin } from 'lucide-react';
import type { TasterSessionPlayerLevel } from '@club/shared-types/api/tasterSessionRequest';
import { formatTasterSessionLocalDate } from '@club/shared-types/view/tasterSessionRequest';
import { Button } from '@app/components/ui/button';
import { Input } from '@app/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { TasterSessionRequestService } from '@app/services/tasterSessionRequestService';

interface FormData {
  name: string;
  email: string;
  playerLevel: TasterSessionPlayerLevel;
  preferenceId?: string;
  message?: string;
}

export default function TasterSessionFormClient() {
  const t = useTranslations('common.tasterSession');
  const locale = useLocale() as 'de' | 'en' | 'zh';
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormData>();
  const playerLevel = watch('playerLevel');
  const selectedPreferenceId = watch('preferenceId');
  const options = TasterSessionRequestService.usePreferenceOptions(
    playerLevel,
    locale
  );
  const createRequest = TasterSessionRequestService.useCreate();

  const submit = handleSubmit(async (values) => {
    const selectedPreference = options.data?.find(
      (option) => option.id === values.preferenceId
    );
    try {
      await createRequest.mutateAsync({
        name: values.name,
        email: values.email,
        playerLevel: values.playerLevel,
        message: values.message || undefined,
        preference: selectedPreference
          ? {
              optionId: selectedPreference.id,
              startsAt: selectedPreference.startsAt,
            }
          : undefined,
        locale,
      });
      reset();
      setSubmitError(undefined);
      setSubmitted(true);
    } catch (error) {
      const candidate = error as {
        response?: {
          status?: number;
          data?: { code?: string; error?: string };
        };
      };
      setSubmitError(
        candidate.response?.data?.code ===
          'PENDING_TASTER_SESSION_REQUEST_EXISTS'
          ? t('errors.pendingExists')
          : candidate.response?.status === 429
            ? t('errors.rateLimited')
            : candidate.response?.status === 400
              ? t('errors.preferenceChanged')
              : t('errors.generic')
      );
    }
  });

  if (submitted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('success.title')}</CardTitle>
          <CardDescription>{t('success.message')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setSubmitted(false)} variant="secondary">
            {t('success.submitAnother')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-6" noValidate>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">{t('playerLevel')}</legend>
            {(['beginner', 'experienced'] as const).map((level) => (
              <label
                key={level}
                className={`block cursor-pointer rounded-md border p-3 ${
                  playerLevel === level ? 'border-primary bg-muted/50' : ''
                }`}
              >
                <input
                  {...register('playerLevel', {
                    required: t('validation.required'),
                    onChange: () => setValue('preferenceId', undefined),
                  })}
                  type="radio"
                  value={level}
                  className="mr-3"
                />
                <span className="font-medium">
                  {t(`levels.${level}.label`)}
                </span>
                <span className="mt-1 block pl-6 text-sm text-muted-foreground">
                  {t(`levels.${level}.description`)}
                </span>
              </label>
            ))}
            {errors.playerLevel && (
              <p className="text-sm text-destructive">
                {errors.playerLevel.message}
              </p>
            )}
          </fieldset>

          {playerLevel && (
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">
                {t('preference.title')}
              </legend>
              <p className="text-sm text-muted-foreground">
                {t('preference.nonBinding')}
              </p>
              {options.isPending && (
                <p className="text-sm text-muted-foreground">
                  {t('preference.loading')}
                </p>
              )}
              {options.isError && (
                <div className="rounded-md border border-destructive/40 p-3">
                  <p className="text-sm text-destructive">
                    {t('preference.loadFailed')}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => options.refetch()}
                  >
                    {t('preference.retry')}
                  </Button>
                </div>
              )}
              {options.data?.length === 0 && (
                <p className="rounded-md bg-muted p-3 text-sm">
                  {t('preference.none')}
                </p>
              )}
              {options.data?.map((option) => {
                const date = formatTasterSessionLocalDate(
                  option.localDate,
                  locale
                );
                return (
                  <label
                    key={option.id}
                    className={`block cursor-pointer rounded-md border p-3 ${
                      selectedPreferenceId === option.id
                        ? 'border-primary bg-muted/50'
                        : ''
                    }`}
                  >
                    <input
                      {...register('preferenceId', {
                        validate: (value) =>
                          !options.data?.length ||
                          Boolean(value) ||
                          t('validation.required'),
                      })}
                      type="radio"
                      value={option.id}
                      className="mr-3"
                    />
                    <span className="inline-flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {date}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {option.startTime}–{option.endTime}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {option.location.name}
                      </span>
                    </span>
                    <span className="mt-2 block pl-6 text-sm text-muted-foreground">
                      {option.location.address}
                    </span>
                    {option.note && (
                      <span className="mt-1 block pl-6 text-sm text-muted-foreground">
                        {option.note}
                      </span>
                    )}
                  </label>
                );
              })}
              {errors.preferenceId && (
                <p className="text-sm text-destructive">
                  {errors.preferenceId.message}
                </p>
              )}
            </fieldset>
          )}

          {playerLevel && !options.isPending && !options.isError && (
            <>
              <div>
                <label htmlFor="name" className="text-sm font-medium">
                  {t('form.name')}
                </label>
                <Input
                  {...register('name', {
                    required: t('validation.required'),
                    minLength: { value: 2, message: t('validation.name') },
                  })}
                  id="name"
                  autoComplete="name"
                  className="mt-1"
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={errors.name ? 'name-error' : undefined}
                />
                {errors.name && (
                  <p id="name-error" className="text-sm text-destructive">
                    {errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="email" className="text-sm font-medium">
                  {t('form.email')}
                </label>
                <Input
                  {...register('email', {
                    required: t('validation.required'),
                    pattern: {
                      value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                      message: t('validation.email'),
                    },
                  })}
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="mt-1"
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                />
                {errors.email && (
                  <p id="email-error" className="text-sm text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="message" className="text-sm font-medium">
                  {t('form.message')}
                </label>
                <textarea
                  {...register('message')}
                  id="message"
                  rows={4}
                  className="mt-1 block w-full rounded-md border p-2"
                />
              </div>
              {submitError && (
                <p
                  role="alert"
                  className="rounded-md border border-destructive/40 p-3 text-sm text-destructive"
                >
                  {submitError}
                </p>
              )}
              <Button
                type="submit"
                className="w-full"
                disabled={createRequest.isPending}
              >
                {createRequest.isPending
                  ? t('form.submitting')
                  : t('form.submit')}
              </Button>
            </>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
