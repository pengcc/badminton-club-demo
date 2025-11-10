'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@app/components/ui/card';
import { Button } from '@app/components/ui/button';
import { Label } from '@app/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@app/components/ui/radio-group';
import { FormField } from '@app/components/FormField';
import { submitMembershipApplication, generateMembershipApplicationPDF, generateSEPAMandatePDF, generateMembershipPackagePDF } from '@app/lib/api';
import { validateForm, formatIBAN, cleanIBAN, type FormData } from '@app/lib/validation';


export default function MembershipFormClient() {
  const t = useTranslations('common');
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submissionData, setSubmissionData] = useState<any>(null);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    address: '',
    phone: '',
    birthday: '',
    gender: '',
    city: '',
    postalCode: '',
    country: 'Deutschland',
    membershipType: 'regular',
    debitFrequency: '',
    accountHolderFirstName: '',
    accountHolderLastName: '',
    accountHolderAddress: '',
    bankName: '',
    bic: '',
    hasConditions: false,
    conditions: '',
    canParticipate: true,
    motivation: '',
    iban: 'DE'
  });

  const [accountHolderType, setAccountHolderType] = useState<'same' | 'different' | ''>('');
  const [submissionMode, setSubmissionMode] = useState<'full' | 'membership-only' | 'sepa-only'>('full');

  const errors = validateForm(formData, t, accountHolderType || undefined, submissionMode === 'full', submissionMode);
  const isFormValid = Object.keys(errors).length === 0;

  const membershipTypeOptions = [
    { value: 'regular', label: t('applicationForm.membershipTypes.regular') },
    { value: 'student', label: t('applicationForm.membershipTypes.student') },
  ];

  const genderOptions = [
    { value: 'female', label: t('applicationForm.genderOptions.female') },
    { value: 'male', label: t('applicationForm.genderOptions.male') },
    { value: 'non-binary', label: t('applicationForm.genderOptions.other') },
  ];

  const debitOptions = [
    { value: 'quarterly', label: t('applicationForm.debitOptions.quarterly') },
    { value: 'annually', label: t('applicationForm.debitOptions.annually') },
  ];

  const handleFieldChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAccountHolderTypeChange = (type: 'same' | 'different') => {
    setAccountHolderType(type);

    if (type === 'same') {
      // Fill account holder fields with applicant information
      setFormData(prev => ({
        ...prev,
        accountHolderFirstName: prev.firstName,
        accountHolderLastName: prev.lastName,
        accountHolderAddress: `${prev.address}, ${prev.postalCode} ${prev.city}, ${prev.country}`
      }));

      // Mark destination and source fields as touched so validation errors are visible immediately
      const fieldsToTouch = [
        'accountHolderFirstName', 'accountHolderLastName', 'accountHolderAddress',
        'firstName', 'lastName', 'email', 'address', 'postalCode', 'city', 'country'
      ];
      setTouchedFields(prev => new Set([...prev, ...fieldsToTouch]));
    } else {
      // Clear account holder fields
      setFormData(prev => ({
        ...prev,
        accountHolderFirstName: '',
        accountHolderLastName: '',
        accountHolderAddress: ''
      }));

      // Remove destination fields from touched set when clearing
      const fieldsToRemove = ['accountHolderFirstName', 'accountHolderLastName', 'accountHolderAddress'];
      setTouchedFields(prev => {
        const updated = new Set(prev);
        fieldsToRemove.forEach(f => updated.delete(f));
        return updated;
      });
    }
  };

  // Handle submission mode change
  const handleSubmissionModeChange = (mode: 'full' | 'membership-only' | 'sepa-only') => {
    setSubmissionMode(mode);

    if (mode === 'sepa-only') {
      // For SEPA-only mode, reset account holder selection and clear membership fields
      setAccountHolderType('');
      // Clear membership-related fields and personal info for sepa-only mode
      setFormData(prev => ({
        ...prev,
        firstName: '',
        lastName: '',
        address: '',
        phone: '',
        birthday: '',
        gender: '',
        city: '',
        postalCode: '',
        country: 'Deutschland',
        membershipType: 'regular',
        hasConditions: false,
        conditions: '',
        canParticipate: true,
        motivation: ''
      }));
      // Mark required SEPA-only fields as touched so errors show immediately
      const requiredSepaFields = [
        'accountHolderFirstName', 'accountHolderLastName', 'accountHolderAddress',
        'email', 'debitFrequency', 'bankName', 'iban'
      ];
      setTouchedFields(prev => {
        const updated = new Set(prev);
        // Remove membership-only fields from touched to reduce noise
        const membershipFields = [
          'firstName', 'lastName', 'address', 'phone', 'birthday', 'gender',
          'city', 'postalCode', 'country', 'membershipType'
        ];
        membershipFields.forEach(f => updated.delete(f));
        requiredSepaFields.forEach(f => updated.add(f));
        return updated;
      });
    } else if (mode === 'membership-only') {
      // Clear SEPA-related fields for membership-only mode
      setFormData(prev => ({
        ...prev,
        debitFrequency: '',
        accountHolderFirstName: '',
        accountHolderLastName: '',
        accountHolderAddress: '',
        bankName: '',
        bic: '',
        iban: 'DE'
      }));
      setAccountHolderType('');
      // Mark required membership-only fields as touched
      const requiredMembershipFields = [
        'firstName', 'lastName', 'email', 'address', 'phone',
        'birthday', 'gender', 'city', 'postalCode', 'country', 'membershipType'
      ];
      setTouchedFields(prev => {
        const updated = new Set(prev);
        // Remove SEPA-only fields from touched to reduce noise
        const sepaFields = [
          'debitFrequency', 'bankName', 'iban',
          'accountHolderFirstName', 'accountHolderLastName', 'accountHolderAddress', 'bic'
        ];
        sepaFields.forEach(f => updated.delete(f));
        requiredMembershipFields.forEach(f => updated.add(f));
        return updated;
      });
    } else {
      // Full mode - reset account holder selection (no default)
      setAccountHolderType('');
      // Mark both membership and SEPA required fields as touched (account holder fields may depend on selection)
      const membershipFields = [
        'firstName', 'lastName', 'email', 'address', 'phone',
        'birthday', 'gender', 'city', 'postalCode', 'country', 'membershipType'
      ];
      const sepaFields = ['debitFrequency', 'bankName', 'iban'];
      setTouchedFields(prev => new Set([...prev, ...membershipFields, ...sepaFields]));
    }
  };

  const handleFieldBlur = (field: string) => {
    setTouchedFields(prev => new Set([...prev, field]));
  };

  const getFieldError = (field: string) => {
    return touchedFields.has(field) ? errors[field] : undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched
    const allFields = Object.keys(formData);
    setTouchedFields(new Set(allFields));

    if (!isFormValid) {
      // Focus on first error field for better UX
      const firstErrorField = Object.keys(errors)[0];
      if (firstErrorField) {
        const errorElement = document.querySelector(`[name="${firstErrorField}"]`) as HTMLElement;
        errorElement?.focus();
      }

      // Announce error to screen readers
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.textContent = 'Please correct the errors in the form';
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 1000);

      return;
    }

    setIsSubmitting(true);

    try {
      // Transform form data based on submission mode
      let submissionData: any;

      if (submissionMode === 'sepa-only') {
        // SEPA-only submission - account holder information required
        submissionData = {
          type: 'sepa-only',
          personalInfo: {
            firstName: formData.accountHolderFirstName.trim(),
            lastName: formData.accountHolderLastName.trim(),
            email: formData.email.trim().toLowerCase()
          },
          bankingInfo: {
            accountHolder: `${formData.accountHolderFirstName.trim()} ${formData.accountHolderLastName.trim()}`.trim(),
            iban: cleanIBAN(formData.iban),
            bic: formData.bic.trim(),
            bankName: formData.bankName.trim(),
            accountHolderAddress: formData.accountHolderAddress.trim(),
            debitFrequency: formData.debitFrequency
          }
        };
      } else if (submissionMode === 'membership-only') {
        // Membership-only submission
        submissionData = {
          type: 'membership-only',
          personalInfo: {
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            email: formData.email.trim().toLowerCase(),
            phone: formData.phone.trim(),
            dateOfBirth: formData.birthday,
            gender: formData.gender,
            address: {
              street: formData.address.trim(),
              city: formData.city.trim(),
              postalCode: formData.postalCode.trim(),
              country: formData.country.trim()
            }
          },
          membershipType: formData.membershipType,
          motivation: formData.motivation?.trim()
        };
      } else {
        // Full application mode
        submissionData = {
          type: 'full',
          personalInfo: {
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            email: formData.email.trim().toLowerCase(),
            phone: formData.phone.trim(),
            dateOfBirth: formData.birthday,
            gender: formData.gender,
            address: {
              street: formData.address.trim(),
              city: formData.city.trim(),
              postalCode: formData.postalCode.trim(),
              country: formData.country.trim()
            }
          },
          membershipType: formData.membershipType,
          motivation: formData.motivation?.trim()
        };

        // Include banking info in full mode with SEPA
        submissionData.bankingInfo = {
          accountHolder: (accountHolderType === 'same' || !accountHolderType)
            ? `${formData.firstName.trim()} ${formData.lastName.trim()}`.trim()
            : `${formData.accountHolderFirstName.trim()} ${formData.accountHolderLastName.trim()}`.trim(),
          iban: cleanIBAN(formData.iban),
          bic: formData.bic.trim(),
          bankName: formData.bankName.trim(),
          accountHolderAddress: (accountHolderType === 'same' || !accountHolderType)
            ? `${formData.address.trim()}, ${formData.postalCode.trim()} ${formData.city.trim()}, ${formData.country.trim()}`
            : formData.accountHolderAddress.trim(),
          debitFrequency: formData.debitFrequency
        };
      }

      await submitMembershipApplication(submissionData);
      setIsSubmitted(true);

      // Store submission data for PDF generation
      setSubmissionData(submissionData);

      // Scroll to top for success message
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      console.error('Form submission error:', error);

      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadPDF = async (type: 'application' | 'sepa' | 'package') => {
    try {
      if (!submissionData) {
        alert('No submission data available for PDF generation');
        return;
      }

      let pdfBlob: Blob;
      let filename: string;
      const timestamp = new Date().toISOString().slice(0, 10);
      const namePrefix = `${submissionData.personalInfo.firstName}_${submissionData.personalInfo.lastName}`;

      switch (type) {
        case 'application':
          pdfBlob = await generateMembershipApplicationPDF(submissionData);
          filename = `${namePrefix}_Aufnahmeantrag_${timestamp}.pdf`;
          break;
        case 'sepa':
          if (!submissionData.bankingInfo) {
            alert('No banking information available for SEPA mandate');
            return;
          }
          pdfBlob = await generateSEPAMandatePDF(submissionData.personalInfo, submissionData.bankingInfo);
          filename = `${namePrefix}_SEPA_Mandat_${timestamp}.pdf`;
          break;
        case 'package':
          if (!submissionData.bankingInfo) {
            alert('Banking information required for complete package');
            return;
          }
          pdfBlob = await generateMembershipPackagePDF(submissionData);
          filename = `${namePrefix}_Mitgliedschaftspaket_${timestamp}.pdf`;
          break;
        default:
          return;
      }

      // Create download link
      const url = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  if (isSubmitted) {
    return (
      <Card className="text-center">
        <CardContent className="pt-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold mb-4 text-green-700">
            {t('applicationForm.submitted')}
          </h1>
          <p className="text-muted-foreground mb-4">
            {t('applicationForm.submittedMessage')}
          </p>

          {/* PDF Download Section */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6">
            <h3 className="text-lg font-semibold mb-3">{t('applicationForm.downloadDocuments')}</h3>
            <p className="text-sm text-gray-600 mb-4">
              {t('applicationForm.downloadDocumentsDesc')}
            </p>
            <div className="space-y-2 sm:space-y-0 sm:space-x-3 sm:flex">
              <Button
                onClick={() => downloadPDF('application')}
                variant="outline"
                className="w-full sm:w-auto"
              >
                📄 {t('applicationForm.downloadApplication')}
              </Button>
              {submissionData?.bankingInfo && (
                <Button
                  onClick={() => downloadPDF('sepa')}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  🏦 {t('applicationForm.downloadSEPA')}
                </Button>
              )}
              {submissionData?.bankingInfo && (
                <Button
                  onClick={() => downloadPDF('package')}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  📦 {t('applicationForm.downloadPackage')}
                </Button>
              )}
            </div>
          </div>
          <Button onClick={() => router.push('/')} className="mt-4">
            {t('home')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 sm:p-8">
        {/* Submission Mode Selector */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">{t('applicationForm.submissionMode')}</h2>
          <RadioGroup
            value={submissionMode}
            onValueChange={handleSubmissionModeChange}
            className="space-y-3"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="full" id="mode-full" />
              <Label htmlFor="mode-full" className="cursor-pointer">
                {t('applicationForm.submissionModes.full')}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="membership-only" id="mode-membership" />
              <Label htmlFor="mode-membership" className="cursor-pointer">
                {t('applicationForm.submissionModes.membershipOnly')}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="sepa-only" id="mode-sepa" />
              <Label htmlFor="mode-sepa" className="cursor-pointer">
                {t('applicationForm.submissionModes.sepaOnly')}
              </Label>
            </div>
          </RadioGroup>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8 membership-form" noValidate>
          {/* Personal Information Section - Only for full and membership-only modes */}
          {(submissionMode === 'full' || submissionMode === 'membership-only') && (
            <section className="form-section">
              <h2 className="text-2xl font-semibold mb-6 pb-2 border-b">
                {t('applicationForm.personalInfo')}
              </h2>

              <div className="grid gap-6">
                {/* Name Fields - Always required */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label={t('applicationForm.firstName')}
                    value={formData.firstName}
                    onChange={(value) => handleFieldChange('firstName', value)}
                    onBlur={() => handleFieldBlur('firstName')}
                    required
                    error={getFieldError('firstName')}
                    name="firstName"
                  />
                  <FormField
                    label={t('applicationForm.lastName')}
                    value={formData.lastName}
                    onChange={(value) => handleFieldChange('lastName', value)}
                    onBlur={() => handleFieldBlur('lastName')}
                    required
                    error={getFieldError('lastName')}
                    name="lastName"
                  />
                </div>

                {/* Email - Always required */}
                <FormField
                  label={t('applicationForm.email')}
                  type="email"
                  value={formData.email}
                  onChange={(value) => handleFieldChange('email', value)}
                  onBlur={() => handleFieldBlur('email')}
                  required
                  error={getFieldError('email')}
                  name="email"
                />

                {/* Address Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    label={t('applicationForm.address')}
                    value={formData.address}
                    onChange={(value) => handleFieldChange('address', value)}
                    onBlur={() => handleFieldBlur('address')}
                    required
                    error={getFieldError('address')}
                    name="address"
                    className="md:col-span-2"
                  />
                  <FormField
                    label={t('applicationForm.postalCode')}
                    value={formData.postalCode}
                    onChange={(value) => handleFieldChange('postalCode', value)}
                    onBlur={() => handleFieldBlur('postalCode')}
                    required
                    error={getFieldError('postalCode')}
                    name="postalCode"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label={t('applicationForm.city')}
                    value={formData.city}
                    onChange={(value) => handleFieldChange('city', value)}
                    onBlur={() => handleFieldBlur('city')}
                    required
                    error={getFieldError('city')}
                    name="city"
                  />
                  <FormField
                    label={t('applicationForm.country')}
                    value={formData.country}
                    onChange={(value) => handleFieldChange('country', value)}
                    onBlur={() => handleFieldBlur('country')}
                    required
                    error={getFieldError('country')}
                    name="country"
                  />
                </div>

                {/* Phone and Birthday */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label={t('applicationForm.phone')}
                    type="tel"
                    value={formData.phone}
                    onChange={(value) => handleFieldChange('phone', value)}
                    onBlur={() => handleFieldBlur('phone')}
                    required
                    error={getFieldError('phone')}
                    name="phone"
                  />
                  <FormField
                    label={t('applicationForm.birthday')}
                    type="date"
                    value={formData.birthday}
                    onChange={(value) => handleFieldChange('birthday', value)}
                    onBlur={() => handleFieldBlur('birthday')}
                    required
                    error={getFieldError('birthday')}
                    name="birthday"
                  />
                </div>

                {/* Gender */}
                <div className="space-y-3">
                  <Label required>{t('applicationForm.gender')}</Label>
                  <RadioGroup
                    value={formData.gender}
                    onValueChange={(value) => {
                      handleFieldChange('gender', value);
                      handleFieldBlur('gender');
                    }}
                    className="flex flex-wrap gap-6"
                    aria-invalid={!!getFieldError('gender')}
                    aria-describedby={getFieldError('gender') ? 'gender-error' : undefined}
                  >
                    {genderOptions.map((option) => {
                      const optionId = `gender-${option.value}`;
                      return (
                        <div key={option.value} className="flex items-center space-x-2">
                          <RadioGroupItem
                            value={option.value}
                            id={optionId}
                          />
                          <Label htmlFor={optionId} className="cursor-pointer">
                            {option.label}
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                  {getFieldError('gender') && (
                    <p className="text-sm text-destructive mt-1" id="gender-error">
                      {getFieldError('gender')?.[0]}
                    </p>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* Contact Information Section - Only for SEPA-only mode */}
          {submissionMode === 'sepa-only' && (
            <section className="form-section">
              <h2 className="text-2xl font-semibold mb-6 pb-2 border-b">
                {t('applicationForm.accountHolderDetails')}
              </h2>

              <div className="grid gap-6">
                {/* Account Holder Name */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label={t('applicationForm.accountHolderFirstName')}
                    value={formData.accountHolderFirstName}
                    onChange={(value) => handleFieldChange('accountHolderFirstName', value)}
                    onBlur={() => handleFieldBlur('accountHolderFirstName')}
                    required
                    error={getFieldError('accountHolderFirstName')}
                    name="accountHolderFirstName"
                  />
                  <FormField
                    label={t('applicationForm.accountHolderLastName')}
                    value={formData.accountHolderLastName}
                    onChange={(value) => handleFieldChange('accountHolderLastName', value)}
                    onBlur={() => handleFieldBlur('accountHolderLastName')}
                    required
                    error={getFieldError('accountHolderLastName')}
                    name="accountHolderLastName"
                  />
                </div>

                {/* Account Holder Address */}
                <FormField
                  label={t('applicationForm.accountHolderAddress')}
                  value={formData.accountHolderAddress}
                  onChange={(value) => handleFieldChange('accountHolderAddress', value)}
                  onBlur={() => handleFieldBlur('accountHolderAddress')}
                  required
                  error={getFieldError('accountHolderAddress')}
                  name="accountHolderAddress"
                />

                {/* Email - Required for SEPA-only */}
                <FormField
                  label={t('applicationForm.email')}
                  type="email"
                  value={formData.email}
                  onChange={(value) => handleFieldChange('email', value)}
                  onBlur={() => handleFieldBlur('email')}
                  required
                  error={getFieldError('email')}
                  name="email"
                />
              </div>
            </section>
          )}

          {/* Membership Type Section - Only for full and membership-only modes */}
          {(submissionMode === 'full' || submissionMode === 'membership-only') && (
            <section className="form-section">
              <h2 className="text-2xl font-semibold mb-6 pb-2 border-b">
                {t('applicationForm.membershipType')}
              </h2>

              <div className="space-y-3">
                <Label required>{t('applicationForm.membershipTypeSelection')}</Label>
                <RadioGroup
                  value={formData.membershipType}
                  onValueChange={(value) => {
                    handleFieldChange('membershipType', value);
                    handleFieldBlur('membershipType');
                  }}
                  className="flex flex-wrap gap-6"
                  aria-invalid={!!getFieldError('membershipType')}
                  aria-describedby={getFieldError('membershipType') ? 'membership-type-error' : undefined}
                >
                  {membershipTypeOptions.map((option) => {
                    const optionId = `membership-${option.value}`;
                    return (
                      <div key={option.value} className="flex items-center space-x-2">
                        <RadioGroupItem
                          value={option.value}
                          id={optionId}
                        />
                        <Label htmlFor={optionId} className="cursor-pointer">
                          {option.label}
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
                {getFieldError('membershipType') && (
                  <p className="text-sm text-destructive mt-1" id="membership-type-error">
                    {getFieldError('membershipType')?.[0]}
                  </p>
                )}
              </div>
            </section>
          )}

          {/* SEPA Direct Debit Section - Only for full and sepa-only modes */}
          {(submissionMode === 'full' || submissionMode === 'sepa-only') && (
            <section className="form-section">
              <h2 className="text-2xl font-semibold mb-6 pb-2 border-b">
                {t('applicationForm.sepaTitle')}
              </h2>

              <div className="space-y-6">
                {/* Debit Frequency */}
                <div className="space-y-3">
                  <Label required>{t('applicationForm.debitFrequency')}</Label>
                  <RadioGroup
                    value={formData.debitFrequency}
                    onValueChange={(value) => {
                      handleFieldChange('debitFrequency', value);
                      handleFieldBlur('debitFrequency');
                    }}
                    className="flex flex-wrap gap-6"
                    aria-invalid={!!getFieldError('debitFrequency')}
                    aria-describedby={getFieldError('debitFrequency') ? 'debit-error' : undefined}
                  >
                    {debitOptions.map((option) => {
                      const optionId = `debit-${option.value}`;
                      return (
                        <div key={option.value} className="flex items-center space-x-2">
                          <RadioGroupItem
                            value={option.value}
                            id={optionId}
                          />
                          <Label htmlFor={optionId} className="cursor-pointer">
                            {option.label}
                          </Label>
                        </div>
                      );
                    })}
                  </RadioGroup>
                  {getFieldError('debitFrequency') && (
                    <p className="text-sm text-destructive mt-1" id="debit-error">
                      {getFieldError('debitFrequency')?.[0]}
                    </p>
                  )}
                </div>

                {/* Account Holder Information - Only show for full mode */}
                {submissionMode === 'full' && (
                  <div className="space-y-4">
                    <Label required>{t('applicationForm.accountHolderSelection')}</Label>
                    <RadioGroup
                      value={accountHolderType}
                      onValueChange={handleAccountHolderTypeChange}
                      className="space-y-3"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          value="same"
                          id="account-holder-same"
                        />
                        <Label htmlFor="account-holder-same" className="cursor-pointer">
                          {t('applicationForm.accountHolderOptions.same')}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem
                          value="different"
                          id="account-holder-different"
                        />
                        <Label htmlFor="account-holder-different" className="cursor-pointer">
                          {t('applicationForm.accountHolderOptions.different')}
                        </Label>
                      </div>
                    </RadioGroup>

                    {/* Account Holder Details - Only show after user makes a selection */}
                    {(accountHolderType === 'same' || accountHolderType === 'different') && (
                      <div className="space-y-4 mt-6">
                        <h3 className="text-lg font-medium">{t('applicationForm.accountHolderDetails')}</h3>

                        {/* Account Holder Name */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            label={t('applicationForm.accountHolderFirstName')}
                            value={formData.accountHolderFirstName}
                            onChange={(value) => handleFieldChange('accountHolderFirstName', value)}
                            onBlur={() => handleFieldBlur('accountHolderFirstName')}
                            required={accountHolderType === 'different'}
                            disabled={accountHolderType === 'same'}
                            error={getFieldError('accountHolderFirstName')}
                            name="accountHolderFirstName"
                          />
                          <FormField
                            label={t('applicationForm.accountHolderLastName')}
                            value={formData.accountHolderLastName}
                            onChange={(value) => handleFieldChange('accountHolderLastName', value)}
                            onBlur={() => handleFieldBlur('accountHolderLastName')}
                            required={accountHolderType === 'different'}
                            disabled={accountHolderType === 'same'}
                            error={getFieldError('accountHolderLastName')}
                            name="accountHolderLastName"
                          />
                        </div>

                        {/* Account Holder Address */}
                        <FormField
                          label={t('applicationForm.accountHolderAddress')}
                          value={formData.accountHolderAddress}
                          onChange={(value) => handleFieldChange('accountHolderAddress', value)}
                          onBlur={() => handleFieldBlur('accountHolderAddress')}
                          required={accountHolderType === 'different'}
                          disabled={accountHolderType === 'same'}
                          error={getFieldError('accountHolderAddress')}
                          name="accountHolderAddress"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Bank Name and BIC */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label={t('applicationForm.bankName')}
                    value={formData.bankName}
                    onChange={(value) => handleFieldChange('bankName', value)}
                    onBlur={() => handleFieldBlur('bankName')}
                    required
                    error={getFieldError('bankName')}
                    name="bankName"
                  />
                  <FormField
                    label={t('applicationForm.bic')}
                    value={formData.bic}
                    onChange={(value) => handleFieldChange('bic', value)}
                    onBlur={() => handleFieldBlur('bic')}
                    error={getFieldError('bic')}
                    name="bic"
                    placeholder="Optional"
                  />
                </div>

                {/* IBAN */}
                <FormField
                  label={t('applicationForm.iban')}
                  value={formatIBAN(formData.iban)}
                  onChange={(value) => handleFieldChange('iban', cleanIBAN(value))}
                  onBlur={() => handleFieldBlur('iban')}
                  required
                  error={getFieldError('iban')}
                  placeholder="DE89 3704 0044 0532 0130 00"
                  name="iban"
                />
              </div>
            </section>
          )}

          {/* Submit Button */}
          <div className="flex justify-center pt-6">
            <Button
              type="submit"
              size="lg"
              disabled={!isFormValid || isSubmitting}
              className="w-full sm:w-auto min-w-[200px] hover:bg-primary"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {t('applicationForm.submitting')}
                </>
              ) : (
                t('applicationForm.submit')
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}