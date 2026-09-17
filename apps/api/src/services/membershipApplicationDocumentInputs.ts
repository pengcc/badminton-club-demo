import {
  completeBankingInfoSchema,
  personalInfoSchema,
  type Domain,
} from '@club/shared-types/domain/membershipApplication';
import type { IMembershipApplication } from '../models/MembershipApplication';
import type { MembershipApplicationData, SepaMandateData } from './pdfService';

export interface MembershipDocumentInputs {
  application?: MembershipApplicationData;
  sepa?: SepaMandateData;
}

export function mapMembershipApplicationPdfInput(
  source: Pick<IMembershipApplication, 'personalInfo' | 'membershipType'>
): MembershipApplicationData | undefined {
  const personal = personalInfoSchema.safeParse(source.personalInfo);
  if (!personal.success || !source.membershipType) return undefined;
  return {
    personalInfo: personal.data,
    membershipType: source.membershipType,
  };
}

export function mapSepaPdfInput(
  source: Pick<IMembershipApplication, 'personalInfo'>,
  banking: Domain.BankingInfoDraft | undefined
): MembershipDocumentInputs['sepa'] {
  const personal = personalInfoSchema.safeParse(source.personalInfo);
  const complete = completeBankingInfoSchema.safeParse(banking);
  if (!personal.success || !complete.success) return undefined;
  const accountHolder =
    complete.data.accountHolderType === 'same'
      ? `${personal.data.firstName} ${personal.data.lastName}`
      : `${complete.data.accountHolderFirstName} ${complete.data.accountHolderLastName}`;
  const accountHolderAddress =
    complete.data.accountHolderType === 'same'
      ? `${personal.data.address.street}, ${personal.data.address.postalCode} ${personal.data.address.city}, ${personal.data.address.country}`
      : complete.data.accountHolderAddress;
  return {
    applicantName: `${personal.data.firstName} ${personal.data.lastName}`,
    bankingInfo: {
      accountHolder,
      accountHolderAddress,
      iban: complete.data.iban,
      bic: complete.data.bic,
      bankName: complete.data.bankName,
      debitFrequency: complete.data.debitFrequency,
    },
  };
}

export function captureMembershipDocumentInputs(
  source: Pick<IMembershipApplication, 'personalInfo' | 'membershipType'>,
  banking: Domain.BankingInfoDraft | undefined
): MembershipDocumentInputs {
  return {
    application: mapMembershipApplicationPdfInput(source),
    sepa: mapSepaPdfInput(source, banking),
  };
}

function changed(before: unknown, after: unknown): boolean {
  return JSON.stringify(before) !== JSON.stringify(after);
}

export function resetChangedSignedDocumentReceipts(
  application: Pick<
    IMembershipApplication,
    'signedApplicationReceipt' | 'signedSepaReceipt'
  > &
    Partial<Pick<IMembershipApplication, 'signedDocumentResetHistory'>>,
  before: MembershipDocumentInputs,
  after: MembershipDocumentInputs,
  now = new Date()
): { applicationReset: boolean; sepaReset: boolean } {
  const applicationReset = Boolean(
    application.signedApplicationReceipt &&
      !application.signedApplicationReceipt.resetAt &&
      changed(before.application, after.application)
  );
  const sepaReset = Boolean(
    application.signedSepaReceipt &&
      !application.signedSepaReceipt.resetAt &&
      changed(before.sepa, after.sepa)
  );
  if (applicationReset && application.signedApplicationReceipt) {
    application.signedApplicationReceipt.resetAt = now;
    application.signedApplicationReceipt.resetReason =
      'applicant_application_data_changed';
    application.signedDocumentResetHistory?.push({
      documentKind: 'application',
      reasonCategory: 'applicant_application_data_changed',
      resetAt: now,
    });
  }
  if (sepaReset && application.signedSepaReceipt) {
    application.signedSepaReceipt.resetAt = now;
    application.signedSepaReceipt.resetReason = 'applicant_sepa_data_changed';
    application.signedDocumentResetHistory?.push({
      documentKind: 'sepa',
      reasonCategory: 'applicant_sepa_data_changed',
      resetAt: now,
    });
  }
  return { applicationReset, sepaReset };
}
