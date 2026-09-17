import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applicantMembershipApplicationResponseSchema } from '@club/shared-types/api/membershipApplication';
import {
  Gender,
  MemberApplicationStatus,
  AccountKind,
  Capability,
} from '@club/shared-types/core/enums';
import type { Domain } from '@club/shared-types/domain/membershipApplication';

vi.mock('../../middleware/auth', () => ({
  protect: (req: any, _res: any, next: any) => {
    req.user = {
      id: '507f1f77bcf86cd799439011',
      email: 'admin@example.test',
      accountKind: AccountKind.PERSON,
      displayName: 'Administrator',
      capabilities: ['administration'],
      firstName: 'Admin',
      lastName: 'User',
    };
    next();
  },
  authorizeCapability: () => (_req: any, _res: any, next: any) => next(),
}));

import routes from '../../routes/membershipApplications';
import { MembershipApplicantAccessService } from '../../services/membershipApplicantAccessService';
import { MembershipApplicationService } from '../../services/membershipApplicationService';
import { membershipStudentProofService } from '../../services/membershipStudentProofService';

const application: Domain.MembershipApplication = {
  id: '507f1f77bcf86cd799439012',
  verifiedEmail: 'applicant@example.test',
  communicationLocale: 'en',
  personalInfo: {
    firstName: 'Private',
    lastName: 'Applicant',
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
  membershipType: 'student',
  bankingSummary: { present: true, complete: true, ibanLastFour: '1234' },
  status: MemberApplicationStatus.PENDING,
  studentProof: [],
  signedApplicationReceipt: {
    receivedAt: new Date('2026-08-01T10:00:00Z'),
    receivedBy: '507f1f77bcf86cd799439013',
  },
  signedSepaReceipt: {
    receivedAt: new Date('2026-08-01T11:00:00Z'),
    receivedBy: '507f1f77bcf86cd799439014',
  },
  reviewer: '507f1f77bcf86cd799439011',
  reviewDate: new Date('2026-08-02T10:00:00Z'),
  reviewNote: 'Internal board note',
  rejectionReason: 'Applicant-visible reason',
  approvalMessage: 'Applicant-visible approval message',
  decisionNotificationKind: 'rejection',
  decisionNotificationStatus: 'failed',
  decisionNotificationClaimedAt: new Date('2026-08-02T10:01:00Z'),
  decisionNotificationAttemptedAt: new Date('2026-08-02T10:02:00Z'),
  applicantDataUpdatedAt: new Date('2026-08-01T09:00:00Z'),
  createdAt: new Date('2026-08-01T09:00:00Z'),
  updatedAt: new Date('2026-08-02T10:02:00Z'),
};

const bankingInfo: Domain.BankingInfoDraft = {
  accountHolderType: 'same',
  iban: 'DE02120300000000202051',
};

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/membership', routes);
  instance.use((error: any, _req: any, res: any, _next: any) =>
    res.status(error.statusCode ?? 500).json({ error: error.message })
  );
  return instance;
}

function applicantRequest(method: 'get' | 'patch' | 'post', path: string) {
  return request(app())
    [method](path)
    .set(
      'Cookie',
      'membership_applicant_session_aaaaaaaaaaaaaaaaaaaaaa=raw-session'
    )
    .set('Origin', process.env.FRONTEND_URL!);
}

function expectStrictApplicantData(body: unknown, bankingVisible = true) {
  const parsed = applicantMembershipApplicationResponseSchema.parse(body);
  expect(parsed.rejectionReason).toBe('Applicant-visible reason');
  expect(parsed.approvalMessage).toBe('Applicant-visible approval message');
  expect(parsed.bankingSummary).toEqual({
    present: true,
    complete: true,
    ibanLastFour: '1234',
  });
  if (bankingVisible) expect(parsed.bankingInfo).toEqual(bankingInfo);
  else expect(body).not.toHaveProperty('bankingInfo');
  expect(parsed.signedApplicationReceipt?.receivedAt).toBe(
    '2026-08-01T10:00:00.000Z'
  );
  expect(parsed.signedSepaReceipt?.receivedAt).toBe('2026-08-01T11:00:00.000Z');
  expect(body).not.toHaveProperty('signedApplicationReceipt.receivedBy');
  expect(body).not.toHaveProperty('signedSepaReceipt.receivedBy');
  for (const field of [
    'reviewer',
    'reviewerName',
    'reviewDate',
    'reviewNote',
    'decisionNotificationKind',
    'decisionNotificationStatus',
    'decisionNotificationClaimedAt',
    'decisionNotificationAttemptedAt',
    'encryptedBanking',
  ]) {
    expect(body).not.toHaveProperty(field);
  }
}

describe('Membership Application applicant response projection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(
      MembershipApplicantAccessService,
      'resolveSessionCookies'
    ).mockResolvedValue({
      applicationId: application.id,
      observedCookieNames: [
        'membership_applicant_session_aaaaaaaaaaaaaaaaaaaaaa',
      ],
      clearCookieNames: [],
    });
    vi.spyOn(
      MembershipApplicantAccessService,
      'clearSessionCookies'
    ).mockImplementation(() => undefined);
    vi.spyOn(
      MembershipApplicationService,
      'getApplicantBanking'
    ).mockResolvedValue(bankingInfo);
  });

  it('strictly projects get, save, and submit application responses', async () => {
    vi.spyOn(
      MembershipApplicationService,
      'getApplicantApplication'
    ).mockResolvedValue({
      application,
      bankingInfo,
    });
    vi.spyOn(
      MembershipApplicationService,
      'saveApplicantData'
    ).mockResolvedValue(application);
    vi.spyOn(
      MembershipApplicationService,
      'submitApplicantApplication'
    ).mockResolvedValue(application);

    const responses = [
      await applicantRequest('get', '/api/membership/applicant/application'),
      await applicantRequest(
        'patch',
        '/api/membership/applicant/application'
      ).send({ motivation: 'Updated' }),
      await applicantRequest(
        'post',
        '/api/membership/applicant/application/submit'
      ),
    ];
    for (const response of responses) {
      expect(response.status).toBe(200);
      expectStrictApplicantData(response.body.data);
    }
  });

  it.each([
    MemberApplicationStatus.DRAFT,
    MemberApplicationStatus.PENDING,
  ])('returns the applicant banking draft while the application is %s', async (status) => {
    vi.spyOn(
      MembershipApplicationService,
      'getApplicantApplication'
    ).mockResolvedValue({
      application: { ...application, status },
      bankingInfo,
    });

    const response = await applicantRequest(
      'get',
      '/api/membership/applicant/application'
    );

    expect(response.status).toBe(200);
    expectStrictApplicantData(response.body.data);
  });

  it.each([
    MemberApplicationStatus.APPROVED,
    MemberApplicationStatus.REJECTED,
  ])('keeps only masked banking state in a terminal %s response', async (status) => {
    vi.spyOn(
      MembershipApplicationService,
      'getApplicantApplication'
    ).mockResolvedValue({
      application: { ...application, status },
      bankingInfo: undefined,
    });

    const response = await applicantRequest(
      'get',
      '/api/membership/applicant/application'
    );

    expect(response.status).toBe(200);
    expectStrictApplicantData(response.body.data, false);
  });

  it('strictly projects proof replacement and returns no withdrawal body', async () => {
    vi.spyOn(
      membershipStudentProofService,
      'replaceApplicantProofs'
    ).mockResolvedValue([] as never);
    vi.spyOn(
      MembershipApplicationService,
      'getApplicantApplication'
    ).mockResolvedValue({
      application,
      bankingInfo,
    });
    vi.spyOn(
      MembershipApplicationService,
      'withdrawApplicantApplication'
    ).mockResolvedValue(application);

    const proof = await applicantRequest(
      'patch',
      '/api/membership/applicant/application/student-proof'
    )
      .field('retainedIds', '[]')
      .attach('proofs', Buffer.from('%PDF-1.4\n%%EOF'), {
        filename: 'proof.pdf',
        contentType: 'application/pdf',
      });
    expect(proof.status).toBe(200);
    expectStrictApplicantData(proof.body.data);

    const withdrawn = await applicantRequest(
      'post',
      '/api/membership/applicant/application/withdraw'
    ).send({ confirmed: true });
    expect(withdrawn.status).toBe(204);
    expect(withdrawn.text).toBe('');
    expect(
      MembershipApplicantAccessService.clearSessionCookies
    ).toHaveBeenCalledWith(expect.anything(), [
      'membership_applicant_session_aaaaaaaaaaaaaaaaaaaaaa',
    ]);
  });
});
