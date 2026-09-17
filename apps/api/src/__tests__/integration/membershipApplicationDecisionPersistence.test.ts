import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import mongoose from 'mongoose';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  AccountOnboardingStatus,
  Gender,
  MemberApplicationStatus,
  MembershipStatus,
  AccountKind,
  Capability,
} from '@club/shared-types/core/enums';
import { MembershipApplication } from '../../models/MembershipApplication';
import { User } from '../../models/User';
import EmailService from '../../services/emailService';
import { MembershipApplicationDecisionDeliveryService } from '../../services/membershipApplicationDecisionDeliveryService';
import { MembershipApplicationService } from '../../services/membershipApplicationService';

let mongoLease: MongoTestDatabaseLease;
const reviewerId = new mongoose.Types.ObjectId();

async function pending() {
  return MembershipApplication.create({
    verifiedEmail: 'decision@example.test',
    personalInfo: {
      firstName: 'Decision',
      lastName: 'Applicant',
      email: 'decision@example.test',
      phone: '+49123456789',
      dateOfBirth: '1990-01-01',
      gender: Gender.FEMALE,
      address: {
        street: 'Main 1',
        city: 'Berlin',
        postalCode: '10115',
        country: 'DE',
      },
    },
    membershipType: 'regular',
    bankingSummary: { present: false, complete: false },
    signedApplicationReceipt: {
      receivedAt: new Date(),
      receivedBy: reviewerId,
    },
    signedSepaReceipt: { receivedAt: new Date(), receivedBy: reviewerId },
    status: MemberApplicationStatus.PENDING,
    submittedAt: new Date(),
    applicantDataUpdatedAt: new Date(),
  });
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('membershipApplicationDecision');
  mongoLease.assertOwnedDatabase();
  await Promise.all([MembershipApplication.syncIndexes(), User.syncIndexes()]);
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await Promise.all([
    MembershipApplication.deleteMany({}),
    User.deleteMany({}),
  ]);
  vi.restoreAllMocks();
  vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue();
});

afterAll(async () => {
  await mongoLease.release();
});

describe('Membership Application decision delivery persistence', () => {
  it('saves internal review notes without resetting signed-document receipts', async () => {
    const source = await pending();
    await MembershipApplicationService.updateApplication(source.id, {
      reviewNote: 'Internal review progress',
    });
    const stored = await MembershipApplication.findById(source.id).lean();
    expect(stored?.reviewNote).toBe('Internal review progress');
    expect(stored?.signedApplicationReceipt?.resetAt).toBeUndefined();
    expect(stored?.signedSepaReceipt?.resetAt).toBeUndefined();
  });

  it('commits rejection with separate internal/applicant facts and retries failed delivery', async () => {
    const source = await pending();
    vi.mocked(EmailService.sendFromTemplate).mockRejectedValueOnce(
      Object.assign(new Error('message rejected'), { code: 'EMESSAGE' })
    );
    const rejected = await MembershipApplicationService.rejectApplication(
      source.id,
      reviewerId.toString(),
      'Applicant-visible capacity reason',
      'Internal board note'
    );
    expect(rejected).toMatchObject({
      status: MemberApplicationStatus.REJECTED,
      rejectionReason: 'Applicant-visible capacity reason',
      reviewNote: 'Internal board note',
      decisionNotificationStatus: 'failed',
    });
    expect(vi.mocked(EmailService.sendFromTemplate).mock.calls[0]?.[3]).toEqual(
      expect.objectContaining({
        reason: 'Applicant-visible capacity reason',
      })
    );
    expect(
      vi.mocked(EmailService.sendFromTemplate).mock.calls[0]?.[3]
    ).not.toHaveProperty('reviewNote');

    vi.mocked(EmailService.sendFromTemplate).mockResolvedValueOnce();
    await expect(
      MembershipApplicationDecisionDeliveryService.deliver(source.id)
    ).resolves.toBe('sent');
    expect(
      (await MembershipApplication.findById(source.id))
        ?.decisionNotificationStatus
    ).toBe('sent');
  });

  it('leaves a failed correction message retryable without changing application workflow state', async () => {
    const source = await pending();
    const sender = await User.create({
      _id: reviewerId,
      email: 'admin@example.test',
      firstName: 'Admin',
      lastName: 'User',
      password: 'Test-Only-Password-1!',
      gender: Gender.FEMALE,
      dateOfBirth: '1980-01-01',
      accountKind: AccountKind.PERSON,
      administratorDesignation: true,
      displayName: 'Administrator',
      capabilities: [Capability.ADMINISTRATION],
      membershipStatus: MembershipStatus.ACTIVE,
      accountOnboardingStatus: AccountOnboardingStatus.READY,
    });
    vi.mocked(EmailService.sendFromTemplate).mockRejectedValueOnce(
      new Error('smtp unavailable')
    );
    await expect(
      MembershipApplicationService.contactApplicant(
        source.id,
        sender.id,
        'Please correct the address'
      )
    ).rejects.toThrow('smtp unavailable');
    expect((await MembershipApplication.findById(source.id))?.status).toBe(
      MemberApplicationStatus.PENDING
    );
    expect(
      JSON.stringify(await MembershipApplication.findById(source.id).lean())
    ).not.toMatch(/supplement|correction.*status/i);

    vi.mocked(EmailService.sendFromTemplate).mockResolvedValueOnce();
    await expect(
      MembershipApplicationService.contactApplicant(
        source.id,
        sender.id,
        'Please correct the address'
      )
    ).resolves.toBeUndefined();
    expect(
      vi.mocked(EmailService.sendFromTemplate).mock.calls.at(-1)?.[3]
    ).toMatchObject({
      message: 'Please correct the address',
      senderName: 'Admin User',
    });
  });

  it('recovers a stale claimed decision delivery without reopening the terminal decision', async () => {
    const source = await pending();
    await MembershipApplication.findByIdAndUpdate(source.id, {
      $set: {
        status: MemberApplicationStatus.REJECTED,
        rejectionReason: 'Capacity',
        rejectedAt: new Date(),
        decisionNotificationKind: 'rejection',
        decisionNotificationStatus: 'claimed',
        decisionNotificationClaimedAt: new Date(Date.now() - 11 * 60 * 1000),
      },
    });
    await expect(
      MembershipApplicationDecisionDeliveryService.deliver(source.id)
    ).resolves.toBe('sent');
    expect((await MembershipApplication.findById(source.id))?.status).toBe(
      MemberApplicationStatus.REJECTED
    );
  });
});
