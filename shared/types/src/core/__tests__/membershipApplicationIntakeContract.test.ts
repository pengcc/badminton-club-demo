import { describe, expect, it } from 'vitest';
import { Gender, MemberApplicationStatus } from '../enums';
import {
  getBankingSummary,
  getMembershipApplicationSubmissionReadiness,
  membershipApplicationSchema,
  normalizeBankingInfo,
  personalInfoSchema,
} from '../../domain/membershipApplication';

const base = {
  id: 'application-1',
  verifiedEmail: 'applicant@example.test',
  personalInfo: { email: 'applicant@example.test' },
  bankingSummary: { present: false, complete: false },
  studentProof: [],
  applicantDataUpdatedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('Membership Application intake contract', () => {
  const completeSubmission = {
    personalInfo: {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'applicant@example.test',
      dateOfBirth: '1990-01-01',
      gender: Gender.FEMALE,
      address: {
        street: 'Test 1',
        city: 'Berlin',
        postalCode: '10115',
        country: 'DE',
      },
    },
    membershipType: 'regular',
  } as const;

  it('uses complete core data plus Membership type as the shared submission boundary', () => {
    expect(
      getMembershipApplicationSubmissionReadiness(completeSubmission)
    ).toEqual({ ready: true, fields: [] });
    expect(
      getMembershipApplicationSubmissionReadiness({
        personalInfo: {
          ...completeSubmission.personalInfo,
          address: undefined,
        },
      })
    ).toEqual({
      ready: false,
      fields: ['street', 'city', 'postalCode', 'membershipType'],
    });
  });

  it('identifies invalid supplied optional phone without adding banking or proof fields', () => {
    expect(
      getMembershipApplicationSubmissionReadiness({
        ...completeSubmission,
        personalInfo: {
          ...completeSubmission.personalInfo,
          phone: 'invalid',
        },
        bankingInfo: undefined,
        studentProof: [],
      })
    ).toEqual({ ready: false, fields: ['phone'] });
  });

  it('accepts an incomplete draft and rejects the same data as pending', () => {
    expect(
      membershipApplicationSchema.parse({
        ...base,
        status: MemberApplicationStatus.DRAFT,
      })
    ).toMatchObject({
      status: MemberApplicationStatus.DRAFT,
      communicationLocale: 'de',
    });
    expect(() =>
      membershipApplicationSchema.parse({
        ...base,
        status: MemberApplicationStatus.PENDING,
      })
    ).toThrow('complete core applicant data');
  });

  it('accepts complete pending core data without medical fields', () => {
    const pending = membershipApplicationSchema.parse({
      ...base,
      status: MemberApplicationStatus.PENDING,
      membershipType: 'regular',
      personalInfo: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'applicant@example.test',
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
    });
    expect(pending).not.toHaveProperty('medicalInfo');
  });

  it.each([
    '1',
    '+49 (1)-2 3',
    '+49 30 1234 5678',
    '(030) 1234-5678',
    '12345678',
  ])('accepts maintained submitted phone format %j', (phone) => {
    expect(
      personalInfoSchema.safeParse({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'applicant@example.test',
        phone,
        dateOfBirth: '1990-01-01',
        gender: Gender.FEMALE,
        address: {
          street: 'Test 1',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
      }).success
    ).toBe(true);
  });

  it('accepts complete pending data without a phone', () => {
    expect(
      membershipApplicationSchema.safeParse({
        ...base,
        status: MemberApplicationStatus.PENDING,
        membershipType: 'regular',
        personalInfo: {
          firstName: '李',
          lastName: "D'Angelo",
          email: 'applicant@example.test',
          dateOfBirth: '2000-02-29',
          gender: Gender.NON_BINARY,
          address: {
            street: 'Test 1',
            city: 'Berlin',
            postalCode: '10115',
            country: 'Deutschland',
          },
        },
      }).success
    ).toBe(true);
  });

  it('rejects a non-German submitted address', () => {
    expect(
      personalInfoSchema.safeParse({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'applicant@example.test',
        dateOfBirth: '1990-01-01',
        gender: Gender.FEMALE,
        address: {
          street: 'Test 1',
          city: 'Paris',
          postalCode: '10115',
          country: 'France',
        },
      }).success
    ).toBe(false);
  });

  it.each([
    '2026-02-30',
    '9999-99-99',
    '2025-02-29',
    `${new Date().getFullYear() + 1}-01-01`,
  ])('rejects impossible or future submitted birth date %s', (dateOfBirth) => {
    expect(
      personalInfoSchema.safeParse({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'applicant@example.test',
        phone: '+49123456789',
        dateOfBirth,
        gender: Gender.FEMALE,
        address: {
          street: 'Test 1',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
      }).success
    ).toBe(false);
  });

  it.each([
    '2000-02-29',
    '1990-01-01',
  ])('accepts real non-future birth date %s', (dateOfBirth) => {
    expect(
      personalInfoSchema.safeParse({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'applicant@example.test',
        phone: '+49123456789',
        dateOfBirth,
        gender: Gender.FEMALE,
        address: {
          street: 'Test 1',
          city: 'Berlin',
          postalCode: '10115',
          country: 'DE',
        },
      }).success
    ).toBe(true);
  });

  it('keeps partial phone and birth-date text saveable in drafts', () => {
    expect(
      membershipApplicationSchema.safeParse({
        ...base,
        status: MemberApplicationStatus.DRAFT,
        personalInfo: {
          email: 'applicant@example.test',
          phone: '1',
          dateOfBirth: '2026-02',
        },
      }).success
    ).toBe(true);
  });

  it('drops different-payer identity from same-payer input and derives completeness', () => {
    const same = normalizeBankingInfo({
      accountHolderType: 'same',
      bankName: 'Test Bank',
      iban: 'DE02 1203 0000 0000 2020 51',
      debitFrequency: 'annually',
    });
    expect(same).not.toHaveProperty('accountHolderFirstName');
    expect(getBankingSummary(same)).toEqual({
      present: true,
      complete: true,
      ibanLastFour: '2051',
    });
    expect(
      getBankingSummary({ accountHolderType: 'different', iban: 'DE02' })
    ).toEqual({ present: true, complete: false });
  });
});
