'use client';

import React, { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AlertTriangle,
  CheckCircle2,
  Mail,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import type { Gender } from '@club/shared-types/core/enums';
import { AccountOnboardingTargetKind } from '@club/shared-types/domain/accountOnboarding';
import type { AccountEstablishmentResponse } from '@club/shared-types/api/accountOnboarding';
import { BirthdayPicker } from '@app/components/ui/BirthdayPicker';
import { Button } from '@app/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Input } from '@app/components/ui/input';
import { Label } from '@app/components/ui/label';
import { Modal } from '@app/components/ui/modal';
import { RadioGroup, RadioGroupItem } from '@app/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@app/components/ui/select';
import { FormLabel } from '@app/components/FormLabel';
import { GENDERS } from '@app/lib/constants/member-options';
import { UserService } from '@app/services/userService';
import { toast } from 'sonner';

interface AddExternalPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExternalPlayerAdded?: (result: AccountEstablishmentResponse) => void;
}

interface ExternalPlayerFormData {
  firstName: string;
  lastName: string;
  email: string;
  gender: Gender | '';
  dateOfBirth: string;
  setupLocale: 'de' | 'en' | 'zh';
}

type ExternalPlayerFormErrors = Partial<
  Record<keyof ExternalPlayerFormData, string>
>;

const initialFormData: ExternalPlayerFormData = {
  firstName: '',
  lastName: '',
  email: '',
  gender: '',
  dateOfBirth: '',
  setupLocale: 'de',
};

export default function AddExternalPlayerModal({
  isOpen,
  onClose,
  onExternalPlayerAdded,
}: AddExternalPlayerModalProps) {
  const t = useTranslations('dashboard');
  const establishAccountMutation = UserService.useEstablishAccount();
  const onboardingKey = useRef<string | undefined>(undefined);
  const [formData, setFormData] = useState(initialFormData);
  const [errors, setErrors] = useState<ExternalPlayerFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<AccountEstablishmentResponse>();
  const [formError, setFormError] = useState<string>();

  const validateForm = () => {
    const nextErrors: ExternalPlayerFormErrors = {};

    if (!formData.firstName.trim()) {
      nextErrors.firstName = t('form.validation.nameRequired');
    }
    if (!formData.lastName.trim()) {
      nextErrors.lastName = t('form.validation.nameRequired');
    }
    if (!formData.email.trim()) {
      nextErrors.email = t('form.validation.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      nextErrors.email = t('form.validation.emailInvalid');
    }
    if (!formData.gender) {
      nextErrors.gender = t('form.validation.genderRequired');
    }
    if (!formData.dateOfBirth) {
      nextErrors.dateOfBirth = t('form.validation.dateOfBirthRequired');
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    setFormError(undefined);

    try {
      onboardingKey.current ??= crypto.randomUUID();
      const establishmentResult = await establishAccountMutation.mutateAsync({
        request: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          gender: formData.gender as Gender,
          dateOfBirth: formData.dateOfBirth,
          setupLocale: formData.setupLocale,
          targetKind: AccountOnboardingTargetKind.EXTERNAL_PLAYER,
          establishPlayer: true,
        },
        idempotencyKey: onboardingKey.current,
      });

      onExternalPlayerAdded?.(establishmentResult);
      setResult(establishmentResult);
      if (!establishmentResult.setupRequired) {
        toast.success(t('modals.addExternalPlayer.toast.notRequired'));
      } else if (establishmentResult.deliveryStatus === 'sent') {
        toast.success(t('modals.addExternalPlayer.toast.sent'));
      } else if (establishmentResult.deliveryStatus === 'failed') {
        toast.error(t('modals.addExternalPlayer.toast.failed'));
      } else {
        toast.warning(t('modals.addExternalPlayer.toast.uncertain'));
      }
      onboardingKey.current = undefined;
    } catch (error: any) {
      const message =
        error?.response?.status === 409
          ? t('modals.addExternalPlayer.reviewRequired')
          : t('modals.addExternalPlayer.requestFailed');
      setFormError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (
    field: keyof ExternalPlayerFormData,
    value: string
  ) => {
    if (isSubmitting) return;

    onboardingKey.current = undefined;
    setFormError(undefined);
    setFormData((current) => ({ ...current, [field]: value }));
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: undefined }));
    }
  };

  const handleClose = () => {
    onboardingKey.current = undefined;
    setFormData(initialFormData);
    setErrors({});
    setFormError(undefined);
    setResult(undefined);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? undefined : handleClose}
      ariaLabel={t('modals.addExternalPlayer.title')}
    >
      <Card className="flex max-h-[90vh] w-full max-w-2xl flex-col">
        <CardHeader className="flex-shrink-0 border-b pb-4">
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" aria-hidden="true" />
            {t('modals.addExternalPlayer.title')}
          </CardTitle>
          <CardAction>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleClose}
              disabled={isSubmitting}
              aria-label={
                result
                  ? t('modals.addExternalPlayer.closeResult')
                  : `${t('buttons.cancel')} ${t('modals.addExternalPlayer.title')}`
              }
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          </CardAction>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto overscroll-contain p-6">
          {result ? (
            <div className="space-y-5" role="status" aria-live="polite">
              <div className="flex items-start gap-3">
                <CheckCircle2
                  className="mt-0.5 h-6 w-6 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="font-semibold">
                    {t('modals.addExternalPlayer.resultTitle')}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('modals.addExternalPlayer.canonicalResult')}
                  </p>
                </div>
              </div>

              <div className="rounded-md border p-4 text-sm">
                <p className="font-medium">
                  {t('modals.addExternalPlayer.playerEstablished')}
                </p>
                <p className="mt-2 flex items-start gap-2 text-muted-foreground">
                  {result.setupRequired && result.deliveryStatus !== 'sent' ? (
                    <AlertTriangle
                      className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                      aria-hidden="true"
                    />
                  ) : (
                    <CheckCircle2
                      className="mt-0.5 h-4 w-4 shrink-0 text-primary"
                      aria-hidden="true"
                    />
                  )}
                  <span>
                    {!result.setupRequired
                      ? t('modals.addExternalPlayer.setupNotRequired')
                      : t(
                          `modals.addExternalPlayer.delivery.${result.deliveryStatus ?? 'uncertain'}`
                        )}
                  </span>
                </p>
              </div>
            </div>
          ) : (
            <>
              {formError && (
                <div
                  className="mb-5 flex gap-3 rounded-md border border-destructive/50 bg-destructive/5 p-4 text-sm"
                  role="alert"
                >
                  <AlertTriangle
                    className="mt-0.5 h-5 w-5 shrink-0 text-destructive"
                    aria-hidden="true"
                  />
                  <p>{formError}</p>
                </div>
              )}
              <form
                id="add-external-player-form"
                onSubmit={handleSubmit}
                className="space-y-6"
              >
                <div className="space-y-4">
                  <h3 className="text-lg font-medium">
                    {t('modals.addExternalPlayer.identityDetails')}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {t('modals.addExternalPlayer.scopeHelp')}
                  </p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {(['firstName', 'lastName'] as const).map((field) => (
                      <div key={field} className="space-y-2">
                        <FormLabel
                          htmlFor={`external-player-${field}`}
                          icon={<User className="h-4 w-4" />}
                          required
                        >
                          {t(`form.${field}`)}
                        </FormLabel>
                        <Input
                          id={`external-player-${field}`}
                          value={formData[field]}
                          disabled={isSubmitting}
                          onChange={(event) =>
                            handleInputChange(field, event.target.value)
                          }
                          placeholder={t(
                            `form.placeholders.${field === 'firstName' ? 'enterFirstName' : 'enterLastName'}`
                          )}
                          aria-invalid={Boolean(errors[field])}
                          aria-describedby={
                            errors[field]
                              ? `external-player-${field}-error`
                              : undefined
                          }
                        />
                        {errors[field] && (
                          <p
                            id={`external-player-${field}-error`}
                            className="text-sm text-red-500"
                          >
                            {errors[field]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <FormLabel
                      htmlFor="external-player-email"
                      icon={<Mail className="h-4 w-4" />}
                      required
                    >
                      {t('form.emailAddress')}
                    </FormLabel>
                    <Input
                      id="external-player-email"
                      type="email"
                      value={formData.email}
                      disabled={isSubmitting}
                      onChange={(event) =>
                        handleInputChange('email', event.target.value)
                      }
                      placeholder={t('form.placeholders.enterEmail')}
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={
                        errors.email ? 'external-player-email-error' : undefined
                      }
                    />
                    {errors.email && (
                      <p
                        id="external-player-email-error"
                        className="text-sm text-red-500"
                      >
                        {errors.email}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="external-player-setup-locale">
                      {t('modals.addExternalPlayer.setupLanguage')}
                    </Label>
                    <Select
                      value={formData.setupLocale}
                      disabled={isSubmitting}
                      onValueChange={(value) =>
                        handleInputChange('setupLocale', value)
                      }
                    >
                      <SelectTrigger
                        id="external-player-setup-locale"
                        className="h-10 w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="de">
                          {t('languageOptions.de')}
                        </SelectItem>
                        <SelectItem value="en">
                          {t('languageOptions.en')}
                        </SelectItem>
                        <SelectItem value="zh">
                          {t('languageOptions.zh')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <FormLabel id="external-player-gender-label" required>
                        {t('form.gender')}
                      </FormLabel>
                      <RadioGroup
                        value={formData.gender}
                        disabled={isSubmitting}
                        onValueChange={(value) =>
                          handleInputChange('gender', value)
                        }
                        className="flex gap-6"
                        aria-labelledby="external-player-gender-label"
                        aria-invalid={Boolean(errors.gender)}
                        aria-describedby={
                          errors.gender
                            ? 'external-player-gender-error'
                            : undefined
                        }
                      >
                        {GENDERS.map(({ value, i18nKey }) => (
                          <div
                            key={value}
                            className="flex items-center space-x-2"
                          >
                            <RadioGroupItem
                              value={value}
                              id={`external-player-gender-${value}`}
                            />
                            <Label htmlFor={`external-player-gender-${value}`}>
                              {t(i18nKey)}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                      {errors.gender && (
                        <p
                          id="external-player-gender-error"
                          className="text-sm text-red-500"
                        >
                          {errors.gender}
                        </p>
                      )}
                    </div>
                    <BirthdayPicker
                      label={t('form.dateOfBirth')}
                      required
                      disabled={isSubmitting}
                      value={formData.dateOfBirth}
                      onChange={(value) =>
                        handleInputChange('dateOfBirth', value)
                      }
                      error={
                        errors.dateOfBirth ? [errors.dateOfBirth] : undefined
                      }
                    />
                  </div>
                </div>
              </form>
            </>
          )}
        </CardContent>

        <div className="flex-shrink-0 border-t bg-muted/20 p-4">
          {result ? (
            <Button type="button" onClick={handleClose} className="w-full">
              {t('modals.addExternalPlayer.closeResult')}
            </Button>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                {t('buttons.cancel')}
              </Button>
              <Button
                type="submit"
                form="add-external-player-form"
                className="flex-1"
                disabled={isSubmitting}
              >
                <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
                {isSubmitting
                  ? t('buttons.addingExternalPlayer')
                  : t('buttons.addExternalPlayer')}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </Modal>
  );
}
