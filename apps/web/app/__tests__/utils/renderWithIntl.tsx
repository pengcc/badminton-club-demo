import React, { PropsWithChildren, Suspense } from 'react';
import { render, RenderOptions, type RenderResult } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';

// A default messages object that maps required keys to their own key strings.
// This avoids MISSING_MESSAGE warnings and lets us assert on the key labels directly.
export const defaultMessages = {
  common: {
    home: 'home',
    validation: {
      required: 'validation.required',
      email: 'validation.email',
      birthday: 'validation.birthday',
      invalidIBAN: 'validation.invalidIBAN',
      invalidName: 'validation.invalidName',
      phone: 'validation.phone'
    },
    applicationForm: {
      submissionMode: 'applicationForm.submissionMode',
      submissionModes: {
        full: 'applicationForm.submissionModes.full',
        membershipOnly: 'applicationForm.submissionModes.membershipOnly',
        sepaOnly: 'applicationForm.submissionModes.sepaOnly'
      },
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
        other: 'applicationForm.genderOptions.other'
      },
      membershipType: 'applicationForm.membershipType',
      membershipTypeSelection: 'applicationForm.membershipTypeSelection',
      membershipTypes: {
        regular: 'applicationForm.membershipTypes.regular',
        student: 'applicationForm.membershipTypes.student'
      },
      sepaTitle: 'applicationForm.sepaTitle',
      debitFrequency: 'applicationForm.debitFrequency',
      debitOptions: {
        quarterly: 'applicationForm.debitOptions.quarterly',
        annually: 'applicationForm.debitOptions.annually'
      },
      accountHolderSelection: 'applicationForm.accountHolderSelection',
      accountHolderOptions: {
        same: 'applicationForm.accountHolderOptions.same',
        different: 'applicationForm.accountHolderOptions.different'
      },
      accountHolderDetails: 'applicationForm.accountHolderDetails',
      accountHolderFirstName: 'applicationForm.accountHolderFirstName',
      accountHolderLastName: 'applicationForm.accountHolderLastName',
      accountHolderAddress: 'applicationForm.accountHolderAddress',
      bankName: 'applicationForm.bankName',
      bic: 'applicationForm.bic',
      iban: 'applicationForm.iban',
      submit: 'applicationForm.submit',
      submitting: 'applicationForm.submitting',
      submitted: 'applicationForm.submitted',
      submittedMessage: 'applicationForm.submittedMessage',
      downloadDocuments: 'applicationForm.downloadDocuments',
      downloadDocumentsDesc: 'applicationForm.downloadDocumentsDesc',
      downloadApplication: 'applicationForm.downloadApplication',
      downloadSEPA: 'applicationForm.downloadSEPA',
      downloadPackage: 'applicationForm.downloadPackage'
    }
  }
} as const;

export interface IntlRenderOptions extends Omit<RenderOptions, 'queries'> {
  locale?: string;
  messages?: any;
}

export function renderWithIntl(ui: React.ReactElement, options: IntlRenderOptions = {}): RenderResult {
  const { locale = 'en', messages = defaultMessages, ...rest } = options;

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <NextIntlClientProvider locale={locale} messages={messages} onError={() => {}}>
        <Suspense fallback={null}>{children}</Suspense>
      </NextIntlClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...rest });
}

export * from '@testing-library/react';
