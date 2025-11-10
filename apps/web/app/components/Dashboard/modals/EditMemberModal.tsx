'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@app/components/ui/button';
import { Input } from '@app/components/ui/input';
import { Label } from '@app/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@app/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@app/components/ui/radio-group';
import { Checkbox } from '@app/components/ui/checkbox';
import { X, Save, Mail, Calendar, User as UserIcon, Edit2 } from 'lucide-react';
import { UserService } from '@app/services/userService';
import { User, UserFormData } from '@app/lib/types';
import { UserRole, Gender, MembershipStatus } from '@club/shared-types/core/enums';
import { MEMBER_ROLES, GENDERS, MEMBERSHIP_STATUSES } from '@app/lib/constants/member-options';

interface EditMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: User | null;
  onMemberUpdated: (member: User) => void;
}

export default function EditMemberModal({ isOpen, onClose, member, onMemberUpdated }: EditMemberModalProps) {
  const t = useTranslations('dashboard');
  const tCommon = useTranslations('common');
  const updateUserMutation = UserService.useUpdateUser();

  const [formData, setFormData] = useState<UserFormData>({
    firstName: '',
    lastName: '',
    email: '',
    gender: '',
    dateOfBirth: '',
    role: UserRole.MEMBER,
    membershipStatus: MembershipStatus.ACTIVE,
    isPlayer: false
  });

  const [originalData, setOriginalData] = useState<UserFormData | null>(null);
  const [errors, setErrors] = useState<Partial<UserFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load member data when modal opens
  useEffect(() => {
    if (isOpen && member) {
      const memberFormData: UserFormData = {
        firstName: member.firstName || '',
        lastName: member.lastName || '',
        email: member.email || '',
        gender: member.gender || '',
        dateOfBirth: member.dateOfBirth ? member.dateOfBirth.split('T')[0] : '',
        role: member.role || UserRole.MEMBER,
        membershipStatus: member.membershipStatus || MembershipStatus.ACTIVE,
        isPlayer: member.isPlayer || false
      };

      setFormData(memberFormData);
      setOriginalData(memberFormData);
      setErrors({});
    }
  }, [isOpen, member]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Partial<UserFormData> = {};

    // Required field validations
    if (!formData.firstName.trim()) {
      newErrors.firstName = t('form.validation.firstNameRequired');
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = t('form.validation.lastNameRequired');
    }

    if (!formData.email.trim()) {
      newErrors.email = t('form.validation.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('form.validation.emailInvalid');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const hasChanges = (): boolean => {
    if (!originalData) return false;

    return Object.keys(formData).some(key => {
      const formKey = key as keyof UserFormData;
      return (formData as any)[formKey] !== (originalData as any)[formKey];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm() || !member) {
      return;
    }

    if (!hasChanges()) {
      onClose();
      return;
    }

    setIsSubmitting(true);

    try {
      // Update the member via service
      const updatedMember = await updateUserMutation.mutateAsync({
        id: member.id,
        formData
      });

      onMemberUpdated(updatedMember as any);
      onClose();
    } catch (error: any) {
      console.error('Error updating member:', error);
      // Show error message to user
      alert(`${t('alerts.updateMemberFailed')}: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof UserFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Clear error when user starts typing
    if ((errors as any)[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleCancel = () => {
    if (hasChanges()) {
      const confirmDiscard = window.confirm('You have unsaved changes. Are you sure you want to discard them?');
      if (!confirmDiscard) {
        return;
      }
    }
    onClose();
  };

  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Edit2 className="h-5 w-5" />
            {t('modals.editMember.title')}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">{t('modals.editMember.basicInfo') || t('modals.addMember.basicInfo')}</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-firstName" className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4" />
                    {t('form.firstName')} *
                  </Label>
                  <Input
                    id="edit-firstName"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    placeholder={t('form.placeholders.enterFirstName')}
                    className={errors.firstName ? 'border-red-500' : ''}
                  />
                  {errors.firstName && (
                    <p className="text-sm text-red-500">{errors.firstName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-lastName" className="flex items-center gap-2">
                    <UserIcon className="h-4 w-4" />
                    {t('form.lastName')} *
                  </Label>
                  <Input
                    id="edit-lastName"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    placeholder={t('form.placeholders.enterLastName')}
                    className={errors.lastName ? 'border-red-500' : ''}
                  />
                  {errors.lastName && (
                    <p className="text-sm text-red-500">{errors.lastName}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {t('form.emailAddress')} *
                  </Label>
                  <Input
                    id="edit-email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder={t('form.placeholders.enterEmail')}
                    className={errors.email ? 'border-red-500' : ''}
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500">{errors.email}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('form.gender')}</Label>
                  <RadioGroup
                    value={formData.gender}
                    onValueChange={(value) => handleInputChange('gender', value as Gender)}
                    className="flex gap-6"
                  >
                    {GENDERS.map(({ value, i18nKey }) => (
                      <div key={value} className="flex items-center space-x-2">
                        <RadioGroupItem value={value} id={`edit-gender-${value}`} />
                        <Label htmlFor={`edit-gender-${value}`}>{t(i18nKey)}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-dateOfBirth" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {t('form.dateOfBirth')}
                  </Label>
                  <Input
                    id="edit-dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Membership Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">{t('modals.editMember.membershipDetails') || t('modals.addMember.membershipDetails')}</h3>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('role')}</Label>
                  <RadioGroup
                    value={formData.role}
                    onValueChange={(value) => handleInputChange('role', value as UserRole)}
                    className="space-y-2"
                  >
                    {MEMBER_ROLES.map(({ value, i18nKey }) => (
                      <div key={value} className="flex items-center space-x-2">
                        <RadioGroupItem value={value} id={`edit-role-${value}`} />
                        <Label htmlFor={`edit-role-${value}`}>{t(i18nKey)}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div className="space-y-2">
                  <Label>{t('status')}</Label>
                  <RadioGroup
                    value={formData.membershipStatus}
                    onValueChange={(value) => handleInputChange('membershipStatus', value as MembershipStatus)}
                    className="space-y-2"
                  >
                    {MEMBERSHIP_STATUSES.map(({ value, i18nKey }) => (
                      <div key={value} className="flex items-center space-x-2">
                        <RadioGroupItem value={value} id={`edit-status-${value}`} />
                        <Label htmlFor={`edit-status-${value}`}>{t(i18nKey)}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit-isPlayer"
                  checked={formData.isPlayer}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInputChange('isPlayer', e.target.checked)}
                />
                <Label htmlFor="edit-isPlayer">{t('form.registerAsPlayer')}</Label>
            </div>
          </div>

            {/* Form Actions */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                className="sm:order-1"
                disabled={isSubmitting}
              >
                {t('buttons.cancel')}
              </Button>
              <Button
                type="submit"
                className="sm:order-2 flex-1 hover:bg-primary hover:text-primary-foreground"
                disabled={isSubmitting || !hasChanges()}
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                    {t('buttons.save')}...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    {t('buttons.saveChanges')}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}