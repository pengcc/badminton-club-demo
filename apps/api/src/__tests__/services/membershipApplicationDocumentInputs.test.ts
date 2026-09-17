import { describe, expect, it } from 'vitest';
import { Gender } from '@club/shared-types/core/enums';
import {
  captureMembershipDocumentInputs,
  resetChangedSignedDocumentReceipts,
} from '../../services/membershipApplicationDocumentInputs';

const source = {
  personalInfo: {
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@example.test',
    phone: '+49123456789',
    dateOfBirth: '1990-01-01',
    gender: Gender.FEMALE,
    address: {
      street: 'Test 1',
      city: 'Berlin',
      postalCode: '10115',
      country: 'DE',
    },
  },
  membershipType: 'regular' as const,
};
const sameBanking = {
  accountHolderType: 'same' as const,
  bankName: 'Bank',
  iban: 'DE02120300000000202051',
  bic: 'BYLADEM1001',
  debitFrequency: 'quarterly' as const,
};

describe('canonical Membership Application document input reset policy', () => {
  it('keeps applicant and same-account-holder identity explicit in the SEPA input', () => {
    expect(
      captureMembershipDocumentInputs(source as never, sameBanking).sepa
    ).toMatchObject({
      applicantName: 'Ada Lovelace',
      bankingInfo: {
        accountHolder: 'Ada Lovelace',
        accountHolderAddress: 'Test 1, 10115 Berlin, Deutschland',
        debitFrequency: 'quarterly',
      },
    });
  });

  it('resets both documents when same-payer name/address data changes', () => {
    const before = captureMembershipDocumentInputs(
      source as never,
      sameBanking
    );
    const after = captureMembershipDocumentInputs(
      {
        ...source,
        personalInfo: { ...source.personalInfo, firstName: 'Augusta' },
      } as never,
      sameBanking
    );
    const receipts: any = {
      signedApplicationReceipt: { receivedAt: new Date(), receivedBy: 'actor' },
      signedSepaReceipt: { receivedAt: new Date(), receivedBy: 'actor' },
      signedDocumentResetHistory: [],
    };
    expect(resetChangedSignedDocumentReceipts(receipts, before, after)).toEqual(
      { applicationReset: true, sepaReset: true }
    );
    expect(receipts.signedApplicationReceipt.resetReason).toBe(
      'applicant_application_data_changed'
    );
    expect(receipts.signedSepaReceipt.resetReason).toBe(
      'applicant_sepa_data_changed'
    );
    expect(receipts.signedDocumentResetHistory).toEqual([
      expect.objectContaining({
        documentKind: 'application',
        reasonCategory: 'applicant_application_data_changed',
      }),
      expect.objectContaining({
        documentKind: 'sepa',
        reasonCategory: 'applicant_sepa_data_changed',
      }),
    ]);
  });

  it('does not reset SEPA for applicant-only changes with a different payer', () => {
    const different = {
      ...sameBanking,
      accountHolderType: 'different' as const,
      accountHolderFirstName: 'Grace',
      accountHolderLastName: 'Hopper',
      accountHolderAddress: 'Other 2',
    };
    const before = captureMembershipDocumentInputs(source as never, different);
    const after = captureMembershipDocumentInputs(
      {
        ...source,
        personalInfo: { ...source.personalInfo, phone: '+49999999' },
      } as never,
      different
    );
    const receipts: any = {
      signedApplicationReceipt: { receivedAt: new Date(), receivedBy: 'actor' },
      signedSepaReceipt: { receivedAt: new Date(), receivedBy: 'actor' },
    };
    expect(resetChangedSignedDocumentReceipts(receipts, before, after)).toEqual(
      { applicationReset: true, sepaReset: false }
    );
    expect(receipts.signedSepaReceipt.resetAt).toBeUndefined();
  });

  it('keeps another account holder separate and resets SEPA when the rendered applicant name changes', () => {
    const different = {
      ...sameBanking,
      accountHolderType: 'different' as const,
      accountHolderFirstName: 'Grace',
      accountHolderLastName: 'Hopper',
      accountHolderAddress: 'Other 2',
    };
    const before = captureMembershipDocumentInputs(source as never, different);
    const after = captureMembershipDocumentInputs(
      {
        ...source,
        personalInfo: { ...source.personalInfo, lastName: 'Byron' },
      } as never,
      different
    );
    expect(before.sepa).toMatchObject({
      applicantName: 'Ada Lovelace',
      bankingInfo: {
        accountHolder: 'Grace Hopper',
        accountHolderAddress: 'Other 2',
      },
    });
    const receipts: any = {
      signedSepaReceipt: { receivedAt: new Date(), receivedBy: 'actor' },
    };
    expect(resetChangedSignedDocumentReceipts(receipts, before, after)).toEqual(
      { applicationReset: false, sepaReset: true }
    );
  });

  it.each([
    [
      'contact',
      { personalInfo: { ...source.personalInfo, email: 'new@example.test' } },
    ],
    ['membership', { membershipType: 'student' as const }],
  ])('resets the Membership Application for %s changes', (_category, change) => {
    const before = captureMembershipDocumentInputs(
      source as never,
      sameBanking
    );
    const after = captureMembershipDocumentInputs(
      { ...source, ...change } as never,
      sameBanking
    );
    const receipts: any = {
      signedApplicationReceipt: { receivedAt: new Date(), receivedBy: 'actor' },
    };
    expect(resetChangedSignedDocumentReceipts(receipts, before, after)).toEqual(
      { applicationReset: true, sepaReset: false }
    );
  });

  it.each([
    [
      'payer mode',
      {
        ...sameBanking,
        accountHolderType: 'different' as const,
        accountHolderFirstName: 'Grace',
        accountHolderLastName: 'Hopper',
        accountHolderAddress: 'Other 2',
      },
    ],
    [
      'payer name',
      {
        ...sameBanking,
        accountHolderType: 'different' as const,
        accountHolderFirstName: 'Grace',
        accountHolderLastName: 'Hopper',
        accountHolderAddress: 'Other 2',
      },
    ],
    ['bank details', { ...sameBanking, bankName: 'Changed Bank' }],
    ['bank removal', undefined],
  ])('resets only SEPA for %s changes that leave application data unchanged', (_category, banking) => {
    const beforeBanking =
      _category === 'payer name'
        ? {
            ...sameBanking,
            accountHolderType: 'different' as const,
            accountHolderFirstName: 'Ada',
            accountHolderLastName: 'Payer',
            accountHolderAddress: 'Other 2',
          }
        : sameBanking;
    const before = captureMembershipDocumentInputs(
      source as never,
      beforeBanking
    );
    const after = captureMembershipDocumentInputs(source as never, banking);
    const receipts: any = {
      signedApplicationReceipt: { receivedAt: new Date(), receivedBy: 'actor' },
      signedSepaReceipt: { receivedAt: new Date(), receivedBy: 'actor' },
    };
    expect(resetChangedSignedDocumentReceipts(receipts, before, after)).toEqual(
      { applicationReset: false, sepaReset: true }
    );
  });

  it('does not reset either receipt when proof or review-only state changes outside canonical PDF inputs', () => {
    const before = captureMembershipDocumentInputs(
      source as never,
      sameBanking
    );
    const after = captureMembershipDocumentInputs(source as never, sameBanking);
    const receipts: any = {
      signedApplicationReceipt: { receivedAt: new Date(), receivedBy: 'actor' },
      signedSepaReceipt: { receivedAt: new Date(), receivedBy: 'actor' },
    };
    expect(resetChangedSignedDocumentReceipts(receipts, before, after)).toEqual(
      { applicationReset: false, sepaReset: false }
    );
  });
});
