'use client';

import React, { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@app/components/ui/button';
import { Input } from '@app/components/ui/input';
import { Label } from '@app/components/ui/label';
import { FormLabel } from '@app/components/FormLabel';
import { Modal } from '@app/components/ui/modal';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@app/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@app/components/ui/select';
import {
  AlertTriangle,
  CheckCircle2,
  X,
  UserPlus,
  Mail,
  User,
} from 'lucide-react';
import { Checkbox } from '@app/components/ui/checkbox';
import { UserService } from '@app/services/userService';
import type { Gender } from '@club/shared-types/core/enums';
import { MembershipStatus } from '@club/shared-types/core/enums';
import { AccountOnboardingTargetKind } from '@club/shared-types/domain/accountOnboarding';
import {
  GENDERS,
  CURRENT_MEMBERSHIP_STATUSES,
} from '@app/lib/constants/member-options';
import { BirthdayPicker } from '@app/components/ui/BirthdayPicker';
import { toast } from 'sonner';
import type { AccountEstablishmentResponse } from '@club/shared-types/api/accountOnboarding';
import type { AccountEstablishmentRequest } from '@club/shared-types/api/accountOnboarding';
import { accountEstablishmentSchema } from '@club/shared-types/schemas/accountOnboarding';
import { isAmbiguousMutationError } from '@app/services/lifecycleMutationRetry';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMemberAdded: (member: any) => void;
}

interface MemberFormData {
  firstName: string;
  lastName: string;
  email: string;
  gender: Gender | '';
  dateOfBirth: string;
  initialMembershipStatus: MembershipStatus.ACTIVE | MembershipStatus.PASSIVE;
  establishPlayer: boolean;
  setupLocale: 'de' | 'en' | 'zh';
  sendPasswordSetupEmailNow: boolean;
}

type MemberFormErrors = Partial<Record<keyof MemberFormData, string>>;

const initialFormData: MemberFormData = {
  firstName: '',
  lastName: '',
  email: '',
  gender: '',
  dateOfBirth: '',
  initialMembershipStatus: MembershipStatus.ACTIVE,
  establishPlayer: false,
  setupLocale: 'de',
  sendPasswordSetupEmailNow: false,
};

export default function AddMemberModal({
  isOpen,
  onClose,
  onMemberAdded,
}: AddMemberModalProps) {
  const t = useTranslations('dashboard');
  const establishAccountMutation = UserService.useEstablishAccount();

  const [formData, setFormData] = useState<MemberFormData>(initialFormData);
  const onboardingKey = useRef<string | undefined>(undefined);
  const common = useTranslations('common');

  const [errors, setErrors] = useState<MemberFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<AccountEstablishmentResponse>();
  const [resultSentNow, setResultSentNow] = useState(false);
  const [formError, setFormError] = useState<string>();

  const validateRequest = (): AccountEstablishmentRequest | undefined => {
    const newErrors: MemberFormErrors = {};
    const parsed = accountEstablishmentSchema.safeParse({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      gender: formData.gender || undefined,
      dateOfBirth: formData.dateOfBirth,
      targetKind: AccountOnboardingTargetKind.MEMBER,
      establishPlayer: formData.establishPlayer,
      initialMembershipStatus: formData.initialMembershipStatus,
      setupLocale: formData.setupLocale,
      sendPasswordSetupEmailNow: formData.sendPasswordSetupEmailNow,
    });
    if (parsed.success) {
      setErrors({});
      return parsed.data;
    }
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === 'firstName' || field === 'lastName') {
        newErrors[field] = formData[field].trim()
          ? t('form.validation.nameInvalid')
          : t('form.validation.nameRequired');
      } else if (field === 'email') {
        newErrors.email = formData.email.trim()
          ? t('form.validation.emailInvalid')
          : t('form.validation.emailRequired');
      } else if (field === 'gender') {
        newErrors.gender = t('form.validation.genderRequired');
      } else if (field === 'dateOfBirth') {
        newErrors.dateOfBirth = formData.dateOfBirth
          ? t('form.validation.dateOfBirthInvalid')
          : t('form.validation.dateOfBirthRequired');
      }
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length === 0) {
      setFormError(t('modals.addMember.validationFailed'));
    }
    return undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const request = validateRequest();
    if (!request) return;
    const submittedSendNow =
      request.targetKind === AccountOnboardingTargetKind.MEMBER &&
      request.sendPasswordSetupEmailNow;

    setIsSubmitting(true);
    setFormError(undefined);

    try {
      const idempotencyKey = onboardingKey.current ?? crypto.randomUUID();
      onboardingKey.current = idempotencyKey;
      const submittedIntent = {
        request,
        idempotencyKey,
      };
      const result =
        await establishAccountMutation.mutateAsync(submittedIntent);

      onMemberAdded(result);
      setResult(result);
      setResultSentNow(submittedSendNow);
      const deliveryMessage = !result.setupRequired
        ? 'accountEstablishment.notRequired'
        : !submittedSendNow
          ? 'accountEstablishment.deferred'
          : `accountEstablishment.${result.deliveryStatus ?? 'uncertain'}`;
      if (
        !result.setupRequired ||
        !submittedSendNow ||
        result.deliveryStatus === 'sent'
      ) {
        toast.success(common(deliveryMessage));
      } else if (result.deliveryStatus === 'failed') {
        toast.error(common(deliveryMessage));
      } else {
        toast.warning(common(deliveryMessage));
      }

      onboardingKey.current = undefined;
    } catch (error: any) {
      const status = error?.response?.status;
      const message = isAmbiguousMutationError(error)
        ? t('modals.addMember.requestUnconfirmed')
        : status === 409
          ? t('modals.addMember.reviewRequired')
          : status === 400
            ? t('modals.addMember.validationFailed')
            : t('modals.addMember.requestFailed');
      setFormError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof MemberFormData, value: any) => {
    if (isSubmitting) return;
    onboardingKey.current = undefined;
    setFormError(undefined);
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onboardingKey.current = undefined;
    setFormData(initialFormData);
    setErrors({});
    setFormError(undefined);
    setResult(undefined);
    setResultSentNow(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? undefined : handleClose}
      ariaLabel={t('modals.addMember.title')}
    >
      <Card className="w-full max-w-2xl max-h-[90vh] flex flex-col">
        <CardHeader className="flex-shrink-0 border-b pb-4">
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {t('modals.addMember.title')}
          </CardTitle>
          <CardAction>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              disabled={isSubmitting}
              aria-label={
                result
                  ? t('modals.addMember.closeResult')
                  : `${t('buttons.cancel')} ${t('modals.addMember.title')}`
              }
            >
              <X className="h-4 w-4" />
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
                    {t('modals.addMember.resultTitle')}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('modals.addMember.canonicalResult')}
                  </p>
                </div>
              </div>

              <div className="rounded-md border p-4 text-sm">
                <p className="font-medium">
                  {result.playerId
                    ? t('modals.addMember.playerEstablished')
                    : t('modals.addMember.playerNotEstablished')}
                </p>
                <p className="mt-2 flex items-start gap-2 text-muted-foreground">
                  {result.setupRequired &&
                  resultSentNow &&
                  result.deliveryStatus !== 'sent' ? (
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
                      ? t('modals.addMember.setupNotRequired')
                      : !resultSentNow
                        ? t('modals.addMember.delivery.deferred')
                        : t(
                            `modals.addMember.delivery.${result.deliveryStatus ?? 'uncertain'}`
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
              <form id="add-member-form" onSubmit={handleSubmit}>
                <fieldset
                  disabled={isSubmitting}
                  className="m-0 min-w-0 space-y-6 border-0 p-0"
                >
                  {/* Basic Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">
                      {t('modals.addMember.basicInfo')}
                    </h3>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <FormLabel
                          htmlFor="firstName"
                          icon={<User className="h-4 w-4" />}
                          required
                        >
                          {t('form.firstName')}
                        </FormLabel>
                        <Input
                          id="firstName"
                          value={formData.firstName}
                          onChange={(e) =>
                            handleInputChange('firstName', e.target.value)
                          }
                          placeholder={t('form.placeholders.enterFirstName')}
                          aria-invalid={Boolean(errors.firstName)}
                          aria-describedby={
                            errors.firstName ? 'firstName-error' : undefined
                          }
                        />
                        {errors.firstName && (
                          <p
                            id="firstName-error"
                            className="text-sm text-red-500"
                          >
                            {errors.firstName}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <FormLabel
                          htmlFor="lastName"
                          icon={<User className="h-4 w-4" />}
                          required
                        >
                          {t('form.lastName')}
                        </FormLabel>
                        <Input
                          id="lastName"
                          value={formData.lastName}
                          onChange={(e) =>
                            handleInputChange('lastName', e.target.value)
                          }
                          placeholder={t('form.placeholders.enterLastName')}
                          aria-invalid={Boolean(errors.lastName)}
                          aria-describedby={
                            errors.lastName ? 'lastName-error' : undefined
                          }
                        />
                        {errors.lastName && (
                          <p
                            id="lastName-error"
                            className="text-sm text-red-500"
                          >
                            {errors.lastName}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="space-y-2">
                        <FormLabel
                          htmlFor="email"
                          icon={<Mail className="h-4 w-4" />}
                          required
                        >
                          {t('form.emailAddress')}
                        </FormLabel>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) =>
                            handleInputChange('email', e.target.value)
                          }
                          placeholder={t('form.placeholders.enterEmail')}
                          aria-invalid={Boolean(errors.email)}
                          aria-describedby={
                            errors.email ? 'email-error' : undefined
                          }
                        />
                        {errors.email && (
                          <p id="email-error" className="text-sm text-red-500">
                            {errors.email}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 rounded-md border p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          id="send-member-setup-now"
                          checked={formData.sendPasswordSetupEmailNow}
                          onCheckedChange={(checked) =>
                            handleInputChange(
                              'sendPasswordSetupEmailNow',
                              checked === true
                            )
                          }
                        />
                        <div className="space-y-1">
                          <Label htmlFor="send-member-setup-now">
                            {t('modals.addMember.sendSetupNow')}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {t('modals.addMember.sendSetupNowHelp')}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="member-setup-locale">
                        {t('modals.addMember.setupLanguage')}
                      </Label>
                      <Select
                        value={formData.setupLocale}
                        onValueChange={(value) =>
                          handleInputChange('setupLocale', value)
                        }
                      >
                        <SelectTrigger
                          id="member-setup-locale"
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
                        <FormLabel id="add-member-gender-label" required>
                          {t('form.gender')}
                        </FormLabel>
                        <RadioGroup
                          value={formData.gender}
                          onValueChange={(value) =>
                            handleInputChange('gender', value as Gender)
                          }
                          className="flex gap-6"
                          aria-labelledby="add-member-gender-label"
                          aria-invalid={Boolean(errors.gender)}
                          aria-describedby={
                            errors.gender
                              ? 'add-member-gender-error'
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
                                id={`add-gender-${value}`}
                              />
                              <Label htmlFor={`add-gender-${value}`}>
                                {t(i18nKey)}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                        {errors.gender && (
                          <p
                            id="add-member-gender-error"
                            className="text-sm text-red-500"
                          >
                            {errors.gender}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <BirthdayPicker
                          label={t('form.dateOfBirth')}
                          required
                          value={formData.dateOfBirth}
                          onChange={(value) =>
                            handleInputChange('dateOfBirth', value)
                          }
                          error={
                            errors.dateOfBirth
                              ? [errors.dateOfBirth]
                              : undefined
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Membership Details */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">
                      {t('modals.addMember.membershipDetails')}
                    </h3>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>{t('status')}</Label>
                        <RadioGroup
                          value={formData.initialMembershipStatus}
                          onValueChange={(value) =>
                            handleInputChange(
                              'initialMembershipStatus',
                              value as
                                | MembershipStatus.ACTIVE
                                | MembershipStatus.PASSIVE
                            )
                          }
                          className="space-y-2"
                        >
                          {CURRENT_MEMBERSHIP_STATUSES.map(
                            ({ value, i18nKey }) => (
                              <div
                                key={value}
                                className="flex items-center space-x-2"
                              >
                                <RadioGroupItem
                                  value={value}
                                  id={`add-status-${value}`}
                                />
                                <Label htmlFor={`add-status-${value}`}>
                                  {t(i18nKey)}
                                </Label>
                              </div>
                            )
                          )}
                        </RadioGroup>
                      </div>
                      <div className="space-y-2 rounded-md border p-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id="establish-member-player"
                            checked={formData.establishPlayer}
                            onCheckedChange={(checked) =>
                              handleInputChange(
                                'establishPlayer',
                                checked === true
                              )
                            }
                          />
                          <div className="space-y-1">
                            <Label htmlFor="establish-member-player">
                              {t('modals.addMember.establishPlayer')}
                            </Label>
                            <p className="text-sm text-muted-foreground">
                              {t('modals.addMember.establishPlayerHelp')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </fieldset>
              </form>
            </>
          )}
        </CardContent>

        {/* Fixed Footer */}
        <div className="flex-shrink-0 border-t p-4 bg-muted/20">
          {result ? (
            <Button type="button" onClick={handleClose} className="w-full">
              {t('modals.addMember.closeResult')}
            </Button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="sm:order-1"
                disabled={isSubmitting}
              >
                {t('buttons.cancel')}
              </Button>
              <Button
                type="submit"
                form="add-member-form"
                className="sm:order-2 flex-1"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    {t('buttons.addingMember')}
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    {t('buttons.addMember')}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </Card>
    </Modal>
  );
}
