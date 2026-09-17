import React, { PropsWithChildren, Suspense } from 'react';
import {
  render,
  RenderOptions,
  type RenderResult,
} from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

// A default messages object that maps required keys to their own key strings.
// This avoids MISSING_MESSAGE warnings and lets us assert on the key labels directly.
export const defaultMessages = {
  common: {
    home: 'home',
    registrationAccess: {
      checking: 'registrationAccess.checking',
      unavailableTitle: 'registrationAccess.unavailableTitle',
      unavailableDescription: 'registrationAccess.unavailableDescription',
    },
    registrationAccessAdmin: {
      title: 'Controlled registration access',
      description:
        'One shared link grants access to the application form. Every application still requires administrator approval.',
      loading: 'Loading registration link',
      loadFailed: 'The registration link status could not be loaded.',
      refreshFailed:
        'The current link could not be refreshed. The last loaded state remains visible.',
      retry: 'Retry',
      status: 'Current status',
      noLink: 'No link has been generated.',
      activeGeneration: 'Current version {generation}',
      expired: 'No active link. The previous link is expired.',
      expires: 'Expires: {date}',
      doesNotExpire: 'No automatic expiry',
      expiryLabel: 'Expiry',
      expiry30Days: '30 days',
      expiry90Days: '90 days',
      expiry180Days: '180 days',
      expiryNone: 'No automatic expiry',
      languageLabel: 'Link language',
      generate: 'Generate registration link',
      rotate: 'Invalidate and generate new link',
      generated: 'Registration link generated',
      replaced: 'Registration link replaced',
      updateFailed: 'Registration link could not be updated',
      currentLink: 'Current registration link',
      linkUnavailable: 'Current link cannot be displayed',
      linkUnavailableDescription:
        'This existing version remains valid, but its complete link was not retained. Replace it only if you need a new retrievable link.',
      copyLabel: 'Copy registration link',
      copied: 'Link copied',
      copyFailed: 'Link could not be copied',
    },
    validation: {
      required: 'validation.required',
      email: 'validation.email',
      birthday: 'validation.birthday',
      invalidIBAN: 'validation.invalidIBAN',
      invalidName: 'validation.invalidName',
      phone: 'validation.phone',
    },
    applicationForm: {
      personalInfo: 'applicationForm.personalInfo',
      firstName: 'applicationForm.firstName',
      lastName: 'applicationForm.lastName',
      email: 'applicationForm.email',
      address: 'applicationForm.address',
      postalCode: 'applicationForm.postalCode',
      city: 'applicationForm.city',
      country: 'applicationForm.country',
      phone: 'applicationForm.phone',
      birthday: 'applicationForm.birthday',
      gender: 'applicationForm.gender',
      genderOptions: {
        female: 'applicationForm.genderOptions.female',
        male: 'applicationForm.genderOptions.male',
        other: 'applicationForm.genderOptions.other',
      },
      membershipType: 'applicationForm.membershipType',
      membershipTypeSelection: 'applicationForm.membershipTypeSelection',
      membershipTypes: {
        regular: 'applicationForm.membershipTypes.regular',
        student: 'applicationForm.membershipTypes.student',
      },
      sepaTitle: 'applicationForm.sepaTitle',
      debitFrequency: 'applicationForm.debitFrequency',
      debitOptions: {
        quarterly: 'applicationForm.debitOptions.quarterly',
        annually: 'applicationForm.debitOptions.annually',
      },
      accountHolderSelection: 'applicationForm.accountHolderSelection',
      accountHolderOptions: {
        same: 'Applicant',
        different: 'Another account holder',
      },
      accountHolderDetails: 'applicationForm.accountHolderDetails',
      accountHolderFirstName: 'applicationForm.accountHolderFirstName',
      accountHolderLastName: 'applicationForm.accountHolderLastName',
      accountHolderAddress: 'applicationForm.accountHolderAddress',
      bankName: 'applicationForm.bankName',
      bic: 'applicationForm.bic',
      iban: 'applicationForm.iban',
    },
    membershipApplicant: {
      verifyTitle: 'Verify your email',
      accessTitle: 'View membership application',
      emailPrivacy:
        'We use a single-use email link to keep your saved application private.',
      email: 'Email address',
      send: 'Send secure link',
      sending: 'Sending…',
      requestFailed:
        'The secure link could not be requested. Please try again.',
      retry: 'Try again',
      sent: 'If the request is eligible, a single-use link will arrive shortly. It expires after 30 minutes.',
      title: 'Membership application',
      status: 'Status: {status}',
      statusLabels: {
        draft: 'Draft',
        pending: 'Pending review',
        approved: 'Approved',
        rejected: 'Rejected',
        withdrawn: 'Withdrawn',
      },
      loading: 'Loading application…',
      sessionInvalid:
        'This access session is invalid or expired. Request a new link.',
      accessOpening: 'Opening your application…',
      accessInvalid:
        'This single-use link is invalid or expired. Request a new link from the Membership page.',
      retentionNotice:
        'Privacy: inactive drafts are deleted after 30 days. Submitted applications remain available during review; approved, rejected, or withdrawn applications and their private proof files are deleted after 90 days. Approved Member account, banking, and onboarding records remain separate.',
      personal: 'Personal details',
      verifiedEmail: 'Verified email',
      select: 'Select…',
      germany: 'Germany',
      motivation: 'Motivation',
      banking: 'Bank details',
      addBank: 'Add bank details now',
      removeBank: 'Remove saved bank details',
      frequency: 'Debit frequency',
      quarterly: 'Quarterly',
      annually: 'Annually',
      bankLater:
        'You can submit without bank details and add them later while the application is pending. Complete bank details are required before approval.',
      requiredToSubmit: 'Required to submit',
      optional: 'Optional',
      missingRequiredCount:
        '{count, plural, one {# required field remaining} other {# required fields remaining}}',
      fieldNeedsCorrection: 'Check this entry.',
      decision: 'Decision',
      save: 'Save',
      saveSuccess: 'Saved on the server. You can safely continue later.',
      saveFailed: 'Save failed. Your changes are still unsaved.',
      submit: 'Submit application',
      submitSuccess:
        'Application submitted for review. You may still correct it while pending.',
      submitFailed:
        'Submission failed. Complete every required personal field and membership type.',
      submitNeedsCorrection:
        'Submission needs correction. Review the highlighted fields.',
      proofTitle: 'Student proof',
      proofGuidance:
        'Proof is optional for submission, but please provide it promptly. Missing proof may delay review. Upload at most two PDF, JPEG, or PNG files of 10 MB each. HEIC is not supported; convert it first.',
      proofRemove: 'Remove',
      proofSize: '{size} KB',
      proofSave: 'Save proof files',
      proofSaveSuccess: 'Student proof files were saved privately.',
      proofSaveFailed:
        'Student proof upload failed. Use at most two PDF, JPEG, or PNG files of 10 MB each.',
      documentsTitle: 'Current documents',
      documentsGuidance:
        'Documents are generated from the latest saved data and are not stored by the club.',
      receiptReset:
        'Saved changes invalidated a previously received signed document. Generate, sign, and deliver the affected document again.',
      downloadApplication: 'Download application PDF',
      downloadSepa: 'Download SEPA PDF',
      documentGenerateFailed:
        'The current document could not be generated. Save complete data and try again.',
      emailCurrentDocuments: 'Email current PDFs to {email}',
      applicationDocument: 'Membership Application',
      sepaDocument: 'SEPA mandate',
      emailSelectedDocuments: 'Email selected PDFs',
      emailDocumentsSuccess:
        'Current documents were sent to the verified email.',
      emailDocumentsFailed: 'The documents could not be emailed.',
      changeEmail: 'Change verified email',
      verifyNewEmail: 'Verify new email',
      emailChangeSuccess:
        'If eligible, a verification link will arrive at the new address.',
      emailChangeFailed: 'The email change request could not be started.',
      communicationLanguage: 'Language for application messages',
      localeChangeFailed:
        'The message language could not be updated. Please try again.',
      localeLabels: {
        de: 'German',
        en: 'English',
        zh: 'Chinese',
      },
      withdraw: 'Withdraw application',
      confirmWithdraw: 'Confirm withdrawal',
      withdrawDescription:
        'This immediately ends applicant access. A new application is subject to the cooldown and creation limits.',
      cancel: 'Cancel',
      confirmWithdrawAction: 'Yes, withdraw',
      withdrawSuccess:
        'Application withdrawn. This applicant session is now closed.',
      withdrawFailed:
        'The application could not be withdrawn. Please try again.',
      leaveTitle: 'Leave with unsaved changes?',
      leaveDescription: 'Your latest edits have not been saved on the server.',
      saveAndLeave: 'Save draft and leave',
      leaveWithoutSaving: 'Leave without saving',
      continueEditing: 'Continue editing',
      saveLeaveFailed:
        'Could not save all changes. You are still on this page and your changes remain unsaved.',
      saveLeavePartialFailed:
        'Application details were saved, but proof changes are still unsaved. You are still on this page.',
      saveLeaveProofPartialFailed:
        'Proof changes were saved, but application details are still unsaved. You are still on this page.',
    },
  },
} as const;

export interface IntlRenderOptions extends Omit<RenderOptions, 'queries'> {
  locale?: string;
  messages?: any;
}

export function renderWithIntl(
  ui: React.ReactElement,
  options: IntlRenderOptions = {}
): RenderResult {
  const { locale = 'en', messages = defaultMessages, ...rest } = options;

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <NextIntlClientProvider
        locale={locale}
        messages={messages}
        onError={() => {}}
      >
        <Suspense fallback={null}>{children}</Suspense>
      </NextIntlClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...rest });
}

export * from '@testing-library/react';
