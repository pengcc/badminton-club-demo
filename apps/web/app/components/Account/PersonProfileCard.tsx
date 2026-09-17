'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MapPin, Save, UserRound } from 'lucide-react';
import { AccountKind, type Gender } from '@club/shared-types/core/enums';
import type { Api } from '@club/shared-types/api/user';
import {
  updateUserSchema,
  type UpdateUserInput,
} from '@club/shared-types/schemas/user';
import { UserService } from '@app/services/userService';
import { Button } from '@app/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';
import { Input } from '@app/components/ui/input';
import { Label } from '@app/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@app/components/ui/radio-group';
import { GENDERS } from '@app/lib/constants/member-options';

type PersonProfile = Api.PersonUserResponse;

interface ProfileDraft {
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string;
  gender: Gender;
  hasAddress: boolean;
  street: string;
  postalCode: string;
  city: string;
}

function createDraft(profile: PersonProfile): ProfileDraft {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone ?? '',
    dateOfBirth: profile.dateOfBirth,
    gender: profile.gender as Gender,
    hasAddress: Boolean(profile.address),
    street: profile.address?.street ?? '',
    postalCode: profile.address?.postalCode ?? '',
    city: profile.address?.city ?? '',
  };
}

function buildRequest(
  profile: PersonProfile,
  draft: ProfileDraft
): UpdateUserInput {
  const candidate = updateUserSchema.parse({
    firstName: draft.firstName,
    lastName: draft.lastName,
    phone: draft.phone.trim() || null,
    dateOfBirth: draft.dateOfBirth,
    gender: draft.gender,
    address: draft.hasAddress
      ? {
          street: draft.street,
          postalCode: draft.postalCode,
          city: draft.city,
          country: 'Deutschland',
        }
      : null,
  });
  const current = {
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone ?? null,
    dateOfBirth: profile.dateOfBirth,
    gender: profile.gender,
    address: profile.address
      ? { ...profile.address, country: 'Deutschland' }
      : null,
  };
  return Object.fromEntries(
    Object.entries(candidate).filter(
      ([field, value]) =>
        JSON.stringify(value) !==
        JSON.stringify(current[field as keyof typeof current])
    )
  ) as UpdateUserInput;
}

export function PersonProfileCard({
  userId,
  onNameSaved,
}: {
  userId: string;
  onNameSaved: () => Promise<unknown>;
}) {
  const t = useTranslations('account.profile');
  const profileQuery = UserService.useUserProfile(userId);

  if (profileQuery.isPending) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          {t('loading')}
        </CardContent>
      </Card>
    );
  }
  if (profileQuery.isError || !profileQuery.data) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          <p role="alert" className="text-sm text-destructive">
            {t('loadError')}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => void profileQuery.refetch()}
          >
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (profileQuery.data.accountKind !== AccountKind.PERSON) return null;

  return (
    <PersonProfileForm
      key={profileQuery.data.updatedAt}
      profile={profileQuery.data}
      refreshWarning={profileQuery.isRefetchError}
      onRetry={() => void profileQuery.refetch()}
      onNameSaved={onNameSaved}
    />
  );
}

function PersonProfileForm({
  profile,
  refreshWarning,
  onRetry,
  onNameSaved,
}: {
  profile: PersonProfile;
  refreshWarning: boolean;
  onRetry: () => void;
  onNameSaved: () => Promise<unknown>;
}) {
  const t = useTranslations('account.profile');
  const updateProfile = UserService.useUpdateUser();
  const [draft, setDraft] = useState(() => createDraft(profile));
  const [validationError, setValidationError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saved, setSaved] = useState(false);

  const setField = <K extends keyof ProfileDraft>(
    field: K,
    value: ProfileDraft[K]
  ) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setValidationError(false);
    setSaveError(false);
    setSaved(false);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    let request: UpdateUserInput;
    try {
      request = buildRequest(profile, draft);
    } catch {
      setValidationError(true);
      return;
    }
    if (Object.keys(request).length === 0) return;
    try {
      await updateProfile.mutateAsync({ id: profile.id, formData: request });
      setSaved(true);
      if ('firstName' in request || 'lastName' in request) {
        void onNameSaved();
      }
    } catch {
      setSaveError(true);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound className="h-5 w-5" />
          {t('title')}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{t('description')}</p>
      </CardHeader>
      <CardContent>
        {refreshWarning && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <span>{t('refreshError')}</span>
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              {t('retry')}
            </Button>
          </div>
        )}
        <form className="space-y-6" onSubmit={save}>
          <div className="grid gap-4 sm:grid-cols-2">
            <ProfileInput
              id="profile-first-name"
              label={t('firstName')}
              value={draft.firstName}
              onChange={(value) => setField('firstName', value)}
              required
            />
            <ProfileInput
              id="profile-last-name"
              label={t('lastName')}
              value={draft.lastName}
              onChange={(value) => setField('lastName', value)}
              required
            />
            <ProfileInput
              id="profile-date-of-birth"
              label={t('dateOfBirth')}
              type="date"
              value={draft.dateOfBirth}
              onChange={(value) => setField('dateOfBirth', value)}
              required
            />
            <ProfileInput
              id="profile-phone"
              label={`${t('phone')} (${t('optional')})`}
              type="tel"
              value={draft.phone}
              onChange={(value) => setField('phone', value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('gender')}</Label>
            <RadioGroup
              value={draft.gender}
              onValueChange={(value) => setField('gender', value as Gender)}
              className="flex flex-wrap gap-4"
            >
              {GENDERS.map(({ value, i18nKey }) => (
                <div key={value} className="flex items-center gap-2">
                  <RadioGroupItem
                    value={value}
                    id={`profile-gender-${value}`}
                  />
                  <Label htmlFor={`profile-gender-${value}`}>
                    {t(`genderValues.${i18nKey.split('.').at(-1)}`)}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div className="space-y-4 rounded-md border p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="flex items-center gap-2 font-medium">
                  <MapPin className="h-4 w-4" />
                  {t('address')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('addressHelp')}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setField('hasAddress', !draft.hasAddress)}
              >
                {draft.hasAddress ? t('removeAddress') : t('addAddress')}
              </Button>
            </div>
            {draft.hasAddress && (
              <div className="grid gap-4 sm:grid-cols-2">
                <ProfileInput
                  id="profile-street"
                  label={t('street')}
                  value={draft.street}
                  onChange={(value) => setField('street', value)}
                  required
                />
                <ProfileInput
                  id="profile-postal-code"
                  label={t('postalCode')}
                  value={draft.postalCode}
                  onChange={(value) => setField('postalCode', value)}
                  required
                />
                <ProfileInput
                  id="profile-city"
                  label={t('city')}
                  value={draft.city}
                  onChange={(value) => setField('city', value)}
                  required
                />
                <div className="space-y-2">
                  <Label>{t('country')}</Label>
                  <p className="rounded-md border bg-muted px-3 py-2 text-sm">
                    {t('germany')}
                  </p>
                </div>
              </div>
            )}
          </div>
          {validationError && (
            <p role="alert" className="text-sm text-destructive">
              {t('validationError')}
            </p>
          )}
          {saveError && (
            <p role="alert" className="text-sm text-destructive">
              {t('saveError')}
            </p>
          )}
          {saved && (
            <p role="status" className="text-sm text-green-700">
              {t('saveSuccess')}
            </p>
          )}
          <Button type="submit" disabled={updateProfile.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {updateProfile.isPending ? t('saving') : t('save')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ProfileInput({
  id,
  label,
  value,
  onChange,
  type = 'text',
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
      />
    </div>
  );
}
