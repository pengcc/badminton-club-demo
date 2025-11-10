'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import { FormField } from '@app/components/FormField';

interface FormData {
  name: string;
  email: string;
  message: string;
  playerLevel: string;
}

interface TrialTrainingFormClientProps {
  lang: string;
}

export default function TrialTrainingFormClient({ lang }: TrialTrainingFormClientProps) {
  const t = useTranslations('common');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<FormData>();

  const playerLevel = watch('playerLevel');

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      // In a real application, you would send this data to your server
      console.log('Form data:', data);
      await new Promise((r) => setTimeout(r, 500));
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const playerLevelOptions = [
    {
      value: 'beginner',
      label: t('trialTraining.playerLevelOptions.beginner.label'),
      description: t('trialTraining.playerLevelOptions.beginner.description')
    },
    {
      value: 'experienced',
      label: t('trialTraining.playerLevelOptions.experienced.label'),
      description: t('trialTraining.playerLevelOptions.experienced.description')
    },
    {
      value: 'self-assessed',
      label: t('trialTraining.playerLevelOptions.selfAssessed.label'),
      description: t('trialTraining.playerLevelOptions.selfAssessed.description')
    }
  ];

  if (submitted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-green-700">{t('trialTraining.success.title')}</CardTitle>
          <CardDescription>{t('trialTraining.success.message')}</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <div className="flex items-center justify-center mb-4">
            <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <Button onClick={() => { setSubmitted(false); }} variant="secondary">
            {t('trialTraining.success.submitAnother')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('trialTraining.title')}</CardTitle>
        <CardDescription>{t('trialTraining.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
        {/* Player Level Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('trialTraining.playerLevel')} <span className="text-red-500" aria-hidden>*</span>
          </label>
          <div className="space-y-3">
            {playerLevelOptions.map((option) => {
              const id = `level-${option.value}`;
              return (
                <label key={option.value} htmlFor={id} className={`relative flex items-start p-3 rounded-md border cursor-pointer transition-colors ${playerLevel === option.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input
                    {...register('playerLevel', { required: t('validation.required') })}
                    id={id}
                    type="radio"
                    value={option.value}
                    className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                  />
                  <div className="ml-3 text-sm">
                    <div className="font-medium text-gray-700">{option.label}</div>
                    <p className="text-gray-500">{option.description}</p>
                  </div>
                </label>
              );
            })}
          </div>
          {errors.playerLevel && (
            <p className="mt-1 text-sm text-red-600">{errors.playerLevel.message}</p>
          )}
        </div>

        {/* Conditional Messages */}
        {playerLevel === 'beginner' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex">
              <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">{t('trialTraining.notices.beginnerNotice.title')}</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>{t('trialTraining.notices.beginnerNotice.message')}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {(playerLevel === 'experienced' || playerLevel === 'self-assessed') && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">{t('trialTraining.notices.experiencedInfo.title')}</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>{t('trialTraining.notices.experiencedInfo.message')}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form Fields (only show if level is experienced or self-assessed) */}
        {(playerLevel === 'experienced' || playerLevel === 'self-assessed') && (
          <>
            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                {t('trialTraining.form.fullName')} <span className="text-red-500" aria-hidden>*</span>
              </label>
              <input
                {...register('name', {
                  required: t('validation.required'),
                  minLength: { value: 2, message: t('validation.minLength') }
                })}
                type="text"
                id="name"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                autoComplete="name"
                aria-invalid={!!errors.name}
                placeholder={t('trialTraining.form.fullName')}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                {t('trialTraining.form.email')} <span className="text-red-500" aria-hidden>*</span>
              </label>
              <input
                {...register('email', {
                  required: t('validation.required'),
                  pattern: {
                    value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                    message: t('validation.email')
                  }
                })}
                type="email"
                id="email"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                autoComplete="email"
                aria-invalid={!!errors.email}
                placeholder={t('applicationForm.email')}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            {/* Message Field */}
            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700">
                {t('trialTraining.form.message')}
              </label>
              <textarea
                {...register('message')}
                id="message"
                rows={4}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                placeholder={t('trialTraining.form.messagePlaceholder')}
              ></textarea>
            </div>

            {/* Submit Button */}
            <div>
              <fieldset disabled={isSubmitting}>
                <Button type="submit" className="w-full" aria-busy={isSubmitting}>
                  {isSubmitting ? t('trialTraining.form.submitting') : t('trialTraining.form.submit')}
                </Button>
              </fieldset>
            </div>
          </>
        )}
        </form>
      </CardContent>
    </Card>
  );
}