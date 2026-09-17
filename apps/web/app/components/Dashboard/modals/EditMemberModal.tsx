'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import {
  LockKeyhole,
  MapPin,
  Save,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import type { Gender } from '@club/shared-types/core/enums';
import { MembershipStatus } from '@club/shared-types/core/enums';
import {
  updateUserSchema,
  type UpdateUserInput,
} from '@club/shared-types/schemas';
import type { User } from '@app/lib/types';
import { UserService } from '@app/services/userService';
import { GENDERS } from '@app/lib/constants/member-options';
import { Button } from '@app/components/ui/button';
import { Input } from '@app/components/ui/input';
import { Label } from '@app/components/ui/label';
import { Modal } from '@app/components/ui/modal';
import { RadioGroup, RadioGroupItem } from '@app/components/ui/radio-group';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@app/components/ui/card';

interface EditMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: User | null;
  onMemberUpdated: (member: User) => void;
  profileOnly?: boolean;
}

export default function EditMemberModal({
  isOpen,
  onClose,
  member,
  onMemberUpdated,
  profileOnly = false,
}: EditMemberModalProps) {
  const t = useTranslations('dashboard');
  const updateProfile = UserService.useUpdateUser();
  const updateDesignation = UserService.useSetAdministratorDesignation();
  const transitionMembership = UserService.useTransitionMembershipActivity();
  const suspendAccount = UserService.useSuspendAccount();
  const unsuspendAccount = UserService.useUnsuspendAccount();
  const [membershipReason, setMembershipReason] = useState('');
  const [accountSuspensionReason, setAccountSuspensionReason] = useState('');
  const [accountAccessError, setAccountAccessError] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [designationError, setDesignationError] = useState(false);
  const [membershipError, setMembershipError] = useState(false);
  const [correctingProfile, setCorrectingProfile] = useState(false);
  const [hasAddress, setHasAddress] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty, dirtyFields },
  } = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema) as any,
  });

  useEffect(() => {
    if (!isOpen || !member) return;
    reset({
      firstName: member.firstName,
      lastName: member.lastName,
      phone: member.phone,
      gender: member.gender as Gender | undefined,
      dateOfBirth: member.dateOfBirth?.split('T')[0],
      address: member.address,
    });
    setMembershipReason('');
    setAccountSuspensionReason('');
    setAccountAccessError(false);
    setProfileError(false);
    setDesignationError(false);
    setMembershipError(false);
    setCorrectingProfile(false);
    setHasAddress(Boolean(member.address));
  }, [isOpen, member, reset]);

  if (!isOpen || !member) return null;

  const saveProfile = async (data: UpdateUserInput) => {
    if (!correctingProfile || !isDirty) return;
    setProfileError(false);
    try {
      const formData: UpdateUserInput = {};
      if (dirtyFields.firstName) formData.firstName = data.firstName;
      if (dirtyFields.lastName) formData.lastName = data.lastName;
      if (dirtyFields.dateOfBirth) formData.dateOfBirth = data.dateOfBirth;
      if (dirtyFields.gender) formData.gender = data.gender;
      if (dirtyFields.phone) formData.phone = data.phone || null;
      if (dirtyFields.address) {
        formData.address = hasAddress ? data.address : null;
      }
      const updated = await updateProfile.mutateAsync({
        id: member.id,
        formData,
      });
      onMemberUpdated(updated);
      onClose();
    } catch {
      setProfileError(true);
    }
  };

  const setDesignation = async () => {
    setDesignationError(false);
    try {
      const updated = await updateDesignation.mutateAsync({
        id: member.id,
        designated: !member.administratorDesignation,
      });
      onMemberUpdated(updated);
    } catch {
      setDesignationError(true);
    }
  };

  const transitionActivity = async () => {
    if (!membershipReason.trim()) return;
    const targetStatus =
      member.membershipStatus === MembershipStatus.ACTIVE
        ? MembershipStatus.PASSIVE
        : MembershipStatus.ACTIVE;
    setMembershipError(false);
    try {
      const updated = await transitionMembership.mutateAsync({
        id: member.id,
        targetStatus,
        reason: membershipReason.trim(),
      });
      onMemberUpdated(updated);
      setMembershipReason('');
    } catch {
      setMembershipError(true);
    }
  };

  const updateAccountAccess = async () => {
    setAccountAccessError(false);
    try {
      const updated = member.accountSuspension
        ? await unsuspendAccount.mutateAsync({ id: member.id })
        : await suspendAccount.mutateAsync({
            id: member.id,
            reason: accountSuspensionReason.trim(),
          });
      onMemberUpdated(updated);
      setAccountSuspensionReason('');
    } catch {
      setAccountAccessError(true);
    }
  };

  const gender = watch('gender');
  const memberGender = GENDERS.find(({ value }) => value === member.gender);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={
        profileOnly
          ? t('modals.editMember.profileTitle')
          : t('modals.editMember.title')
      }
    >
      <Card className="flex max-h-[90vh] w-full max-w-2xl flex-col">
        <CardHeader className="border-b">
          <CardTitle>
            {profileOnly
              ? t('modals.editMember.profileTitle')
              : t('modals.editMember.title')}
          </CardTitle>
          <CardAction>
            <Button type="button" variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">{t('modals.editMember.close')}</span>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="overflow-y-auto p-6">
          <form
            id="edit-member-form"
            onSubmit={handleSubmit(saveProfile)}
            className="space-y-6"
          >
            {!profileOnly && (
              <div className="rounded-md border p-4">
                <p className="text-sm font-medium">{member.email}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('modals.editMember.emailWorkflow')}
                </p>
              </div>
            )}

            <div className="rounded-md border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="flex items-center gap-2 font-medium">
                    <UserRound className="h-4 w-4" aria-hidden="true" />
                    {t('modals.editMember.profileTitle')}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('modals.editMember.profileHelp')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCorrectingProfile((value) => !value)}
                >
                  {correctingProfile
                    ? t('modals.editMember.stopCorrecting')
                    : t('modals.editMember.correctProfile')}
                </Button>
              </div>
              {!correctingProfile && (
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">
                      {t('form.firstName')}
                    </dt>
                    <dd className="font-medium">{member.firstName}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t('form.lastName')}
                    </dt>
                    <dd className="font-medium">{member.lastName}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">{t('form.phone')}</dt>
                    <dd className="font-medium">
                      {member.phone || t('memberList.notProvided')}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t('form.dateOfBirth')}
                    </dt>
                    <dd className="font-medium">{member.dateOfBirth}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">
                      {t('form.gender')}
                    </dt>
                    <dd className="font-medium">
                      {memberGender
                        ? t(memberGender.i18nKey)
                        : t('memberList.notProvided')}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">
                      {t('modals.editMember.address')}
                    </dt>
                    <dd className="font-medium">
                      {member.address
                        ? `${member.address.street}, ${member.address.postalCode} ${member.address.city}, ${member.address.country}`
                        : t('memberList.notProvided')}
                    </dd>
                  </div>
                </dl>
              )}
            </div>

            {correctingProfile && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-firstName">
                      {t('form.firstName')}
                    </Label>
                    <Input id="edit-firstName" {...register('firstName')} />
                    {errors.firstName && (
                      <p className="text-sm text-destructive">
                        {errors.firstName.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-lastName">{t('form.lastName')}</Label>
                    <Input id="edit-lastName" {...register('lastName')} />
                    {errors.lastName && (
                      <p className="text-sm text-destructive">
                        {errors.lastName.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-phone">{t('form.phone')}</Label>
                    <Input id="edit-phone" {...register('phone')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-dateOfBirth">
                      {t('form.dateOfBirth')}
                    </Label>
                    <Input
                      id="edit-dateOfBirth"
                      type="date"
                      {...register('dateOfBirth')}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>{t('form.gender')}</Label>
                  <RadioGroup
                    value={gender ?? ''}
                    onValueChange={(value) =>
                      setValue('gender', value as Gender, { shouldDirty: true })
                    }
                    className="flex flex-wrap gap-4"
                  >
                    {GENDERS.map(({ value, i18nKey }) => (
                      <div key={value} className="flex items-center gap-2">
                        <RadioGroupItem
                          value={value}
                          id={`edit-gender-${value}`}
                        />
                        <Label htmlFor={`edit-gender-${value}`}>
                          {t(i18nKey)}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                <div className="space-y-4 rounded-md border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="flex items-center gap-2 font-medium">
                        <MapPin className="h-4 w-4" aria-hidden="true" />
                        {t('modals.editMember.address')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {t('modals.editMember.addressHelp')}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setHasAddress((value) => !value);
                        setValue(
                          'address',
                          hasAddress
                            ? null
                            : {
                                street: '',
                                postalCode: '',
                                city: '',
                                country: 'Deutschland',
                              },
                          { shouldDirty: true }
                        );
                      }}
                    >
                      {hasAddress
                        ? t('modals.editMember.removeAddress')
                        : t('modals.editMember.addAddress')}
                    </Button>
                  </div>
                  {hasAddress && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="edit-street">
                          {t('modals.editMember.street')}
                        </Label>
                        <Input
                          id="edit-street"
                          {...register('address.street')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-postalCode">
                          {t('modals.editMember.postalCode')}
                        </Label>
                        <Input
                          id="edit-postalCode"
                          {...register('address.postalCode')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-city">
                          {t('modals.editMember.city')}
                        </Label>
                        <Input id="edit-city" {...register('address.city')} />
                      </div>
                      <div className="space-y-2">
                        <Label>{t('modals.editMember.country')}</Label>
                        <p className="rounded-md border bg-muted px-3 py-2 text-sm">
                          {t('modals.editMember.germany')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                {profileError && (
                  <p role="alert" className="text-sm text-destructive">
                    {t('modals.editMember.profileError')}
                  </p>
                )}
              </>
            )}

            {!profileOnly && (
              <div className="rounded-md border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="flex items-center gap-2 font-medium">
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      {t('modals.editMember.administratorResponsibility')}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t('modals.editMember.administratorHelp')}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={
                      member.administratorDesignation
                        ? 'destructive'
                        : 'outline'
                    }
                    disabled={updateDesignation.isPending}
                    onClick={() => void setDesignation()}
                  >
                    {member.administratorDesignation
                      ? t('modals.editMember.revokeAdministrator')
                      : t('modals.editMember.grantAdministrator')}
                  </Button>
                </div>
                {designationError && (
                  <p role="alert" className="mt-3 text-sm text-destructive">
                    {t('modals.editMember.designationError')}
                  </p>
                )}
              </div>
            )}

            {!profileOnly && (
              <div className="rounded-md border p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="flex items-center gap-2 font-medium">
                      <LockKeyhole className="h-4 w-4" aria-hidden="true" />
                      {t('modals.editMember.accountAccess')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t('modals.editMember.accountAccessHelp')}
                    </p>
                    <p className="text-sm font-medium">
                      {member.accountSuspension
                        ? t('modals.editMember.accountSuspended')
                        : t('modals.editMember.accountActive')}
                    </p>
                    {member.accountSuspension && (
                      <p className="text-sm text-muted-foreground">
                        {t('modals.editMember.accountSuspensionReason', {
                          reason: member.accountSuspension.reason,
                        })}
                      </p>
                    )}
                  </div>
                  {member.accountSuspension && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={unsuspendAccount.isPending}
                      onClick={() => void updateAccountAccess()}
                    >
                      {t('modals.editMember.unsuspendAccount')}
                    </Button>
                  )}
                </div>
                {!member.accountSuspension && (
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="account-suspension-reason">
                        {t('modals.editMember.accountSuspensionReasonLabel')}
                      </Label>
                      <Input
                        id="account-suspension-reason"
                        value={accountSuspensionReason}
                        onChange={(event) =>
                          setAccountSuspensionReason(event.target.value)
                        }
                        maxLength={1000}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={
                        suspendAccount.isPending ||
                        !accountSuspensionReason.trim()
                      }
                      onClick={() => void updateAccountAccess()}
                    >
                      {t('modals.editMember.suspendAccount')}
                    </Button>
                  </div>
                )}
                {accountAccessError && (
                  <p role="alert" className="mt-3 text-sm text-destructive">
                    {t('modals.editMember.accountAccessError')}
                  </p>
                )}
              </div>
            )}

            {!profileOnly &&
              (member.membershipStatus === MembershipStatus.ACTIVE ||
                member.membershipStatus === MembershipStatus.PASSIVE) && (
                <div className="rounded-md border p-4">
                  <p className="font-medium">
                    {t('modals.editMember.membershipActivity')}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('modals.editMember.membershipActivityHelp')}
                  </p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="membership-activity-reason">
                        {t('modals.editMember.membershipActivityReason')}
                      </Label>
                      <Input
                        id="membership-activity-reason"
                        value={membershipReason}
                        onChange={(event) =>
                          setMembershipReason(event.target.value)
                        }
                        maxLength={500}
                      />
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={
                        transitionMembership.isPending ||
                        !membershipReason.trim()
                      }
                      onClick={() => void transitionActivity()}
                    >
                      {member.membershipStatus === MembershipStatus.ACTIVE
                        ? t('modals.editMember.setPassive')
                        : t('modals.editMember.setActive')}
                    </Button>
                  </div>
                  {membershipError && (
                    <p role="alert" className="mt-3 text-sm text-destructive">
                      {t('modals.editMember.membershipError')}
                    </p>
                  )}
                </div>
              )}
          </form>
        </CardContent>
        <div className="flex justify-end gap-3 border-t p-4">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('modals.editMember.cancel')}
          </Button>
          <Button
            form="edit-member-form"
            type="submit"
            disabled={!correctingProfile || !isDirty || updateProfile.isPending}
          >
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            {t('modals.editMember.saveCorrections')}
          </Button>
        </div>
      </Card>
    </Modal>
  );
}
