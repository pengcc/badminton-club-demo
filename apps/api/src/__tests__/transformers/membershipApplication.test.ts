import { describe, expect, it } from 'vitest';
import { Gender, MemberApplicationStatus } from '@club/shared-types/core/enums';
import type { Domain } from '@club/shared-types/domain/membershipApplication';
import {
  MembershipApplicationApiTransformer,
  MembershipApplicationPersistenceTransformer,
} from '../../transformers/membershipApplication';
import type { MembershipApplicationPersistenceType } from '../../types/persistence/membershipApplication';

const timestamps = {
  applicantDataUpdatedAt: new Date('2026-01-01T00:00:00Z'),
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
};

describe('MembershipApplication transformers', () => {
  it('normalizes the verified email and preserves dateOfBirth', () => {
    const result = MembershipApplicationApiTransformer.fromCreateRequest({
      personalInfo: {
        firstName: 'Alice',
        lastName: 'Tester',
        email: 'Alice@Example.com',
        phone: '+49123456789',
        dateOfBirth: '1990-01-15',
        gender: Gender.FEMALE,
        address: { street: 'X', city: 'Y', postalCode: '12345', country: 'DE' },
      },
      membershipType: 'regular',
    });
    expect(result.verifiedEmail).toBe('alice@example.com');
    expect(result.personalInfo.dateOfBirth).toBe('1990-01-15');
  });

  it('returns only the masked banking summary through the admin API projection', () => {
    const domain: Domain.MembershipApplication = {
      id: 'application-1',
      verifiedEmail: 'bob@example.com',
      communicationLocale: 'en',
      personalInfo: {
        firstName: 'Bob',
        lastName: 'Tester',
        email: 'bob@example.com',
        phone: '+49123456789',
        dateOfBirth: '1985-12-01',
        gender: Gender.MALE,
        address: { street: 'A', city: 'B', postalCode: '54321', country: 'DE' },
      },
      membershipType: 'student',
      bankingSummary: { present: true, complete: true, ibanLastFour: '1234' },
      status: MemberApplicationStatus.PENDING,
      studentProof: [],
      ...timestamps,
    };
    const api = MembershipApplicationApiTransformer.toApi(domain);
    expect(api.bankingSummary).toEqual({
      present: true,
      complete: true,
      ibanLastFour: '1234',
    });
    expect(api).not.toHaveProperty('bankingInfo');
  });

  it('keeps administrator review and delivery facts out of the applicant projection', () => {
    const domain: Domain.MembershipApplication = {
      id: 'application-private-review',
      verifiedEmail: 'private@example.test',
      communicationLocale: 'zh',
      personalInfo: {
        firstName: 'Private',
        lastName: 'Applicant',
        email: 'private@example.test',
      },
      bankingSummary: { present: false, complete: false },
      status: MemberApplicationStatus.REJECTED,
      studentProof: [],
      reviewNote: 'Internal board note',
      rejectionReason: 'Applicant-visible reason',
      reviewer: 'admin-1',
      reviewDate: new Date(),
      decisionNotificationKind: 'rejection',
      decisionNotificationStatus: 'failed',
      signedApplicationReceipt: {
        receivedAt: new Date(),
        receivedBy: 'admin-2',
      },
      signedSepaReceipt: { receivedAt: new Date(), receivedBy: 'admin-3' },
      ...timestamps,
    };
    const applicant =
      MembershipApplicationApiTransformer.toApplicantApi(domain);
    expect(applicant.rejectionReason).toBe('Applicant-visible reason');
    expect(applicant).not.toHaveProperty('reviewNote');
    expect(applicant).not.toHaveProperty('reviewer');
    expect(applicant).not.toHaveProperty('decisionNotificationStatus');
    expect(applicant).not.toHaveProperty('signedApplicationReceipt.receivedBy');
    expect(applicant).not.toHaveProperty('signedSepaReceipt.receivedBy');
  });

  it('maps persistence without exposing the encrypted envelope', () => {
    const persistence = {
      _id: { toString: () => 'application-2' } as never,
      verifiedEmail: 'carol@example.com',
      personalInfo: { email: 'carol@example.com', dateOfBirth: '2000-06-30' },
      membershipType: 'regular',
      encryptedBanking: {
        keyVersion: 'v1',
        nonce: 'n',
        ciphertext: 'secret',
        authTag: 't',
      },
      bankingSummary: { present: true, complete: false },
      status: MemberApplicationStatus.DRAFT,
      studentProof: [],
      ...timestamps,
    } as unknown as MembershipApplicationPersistenceType;
    const domain =
      MembershipApplicationPersistenceTransformer.toDomain(persistence);
    expect(domain.personalInfo.dateOfBirth).toBe('2000-06-30');
    expect(domain.communicationLocale).toBe('de');
    expect(domain).not.toHaveProperty('encryptedBanking');
  });
});
