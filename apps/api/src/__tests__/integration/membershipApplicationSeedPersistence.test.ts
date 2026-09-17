import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import {
  AccountOnboardingStatus,
  AuditAction,
  AuditEventType,
  EntityType,
  MemberApplicationStatus,
  MembershipStatus,
  AccountKind,
  Capability,
  PlayerType,
} from '@club/shared-types/core/enums';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MemberBankingProfile } from '../../models/MemberBankingProfile';
import { AuditLog } from '../../models/AuditLog';
import { AuthSession } from '../../models/AuthSession';
import { GuestPlay } from '../../models/GuestPlay';
import { MembershipApplicantSession } from '../../models/MembershipApplicantSession';
import { MembershipApplication } from '../../models/MembershipApplication';
import { MembershipApplicationAccessToken } from '../../models/MembershipApplicationAccessToken';
import { MembershipStudentProofOperation } from '../../models/MembershipStudentProofOperation';
import {
  RegistrationApprovalEvent,
  RegistrationApprovalStatus,
} from '../../models/RegistrationApprovalEvent';
import { User } from '../../models/User';
import { Player } from '../../models/Player';
import { Team } from '../../models/Team';
import { seedData } from '../../scripts/seedData';
import { bankingCryptoService } from '../../services/bankingCryptoService';
import { evaluateUserCapabilities } from '../../services/capabilityPolicyService';
import { membershipApplicationBankingIntegrityService } from '../../services/membershipApplicationBankingIntegrityService';

let mongoLease: MongoTestDatabaseLease;
let databaseName = '';
let activityUploadsRoot = '';
let contactUploadsRoot = '';
const originalDatabaseUri = process.env.MONGODB_URI;

const resetTarget = () => ({
  kind: 'test' as const,
  expectedDatabaseName: databaseName,
});

async function expectBankingReadyApprovedApplications(): Promise<void> {
  await expect(
    membershipApplicationBankingIntegrityService.verifyReady()
  ).resolves.toMatchObject({
    inspected: 8,
    ready: true,
    findings: [],
  });

  const approvedApplications = await MembershipApplication.find({
    status: MemberApplicationStatus.APPROVED,
  });
  expect(approvedApplications).toHaveLength(2);
  expect(await MemberBankingProfile.countDocuments({})).toBe(2);
  expect(await RegistrationApprovalEvent.countDocuments({})).toBe(2);

  for (const application of approvedApplications) {
    expect(application.approvedUserId).toBeDefined();
    expect(application.reviewer).toBeDefined();
    expect(application.signedApplicationReceipt?.resetAt).toBeUndefined();
    expect(application.signedSepaReceipt?.resetAt).toBeUndefined();
    expect(application).toMatchObject({
      decisionNotificationKind: 'approval',
      decisionNotificationStatus: 'pending',
    });
    expect(application.decisionNotificationClaimedAt).toBeUndefined();
    expect(application.decisionNotificationAttemptedAt).toBeUndefined();

    const user = await User.findById(application.approvedUserId);
    expect(user).toMatchObject({
      email: application.verifiedEmail,
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipStatus: MembershipStatus.ACTIVE,
      accountOnboardingStatus: AccountOnboardingStatus.READY,
    });
    expect((await user!.toView()).displayName).toBe(
      `${user!.lastName}, ${user!.firstName}`
    );
    await expect(evaluateUserCapabilities(user!)).resolves.toMatchObject({
      capabilities: expect.arrayContaining([
        Capability.AUTHENTICATED_ACCOUNT,
        Capability.CURRENT_MEMBER,
        Capability.MEMBERSHIP_SELF_SERVICE,
      ]),
      contradictions: [],
    });

    const approvalEvent = await RegistrationApprovalEvent.findOne({
      applicationId: application._id,
    }).lean();
    expect(approvalEvent).toMatchObject({
      status: RegistrationApprovalStatus.COMPLETED,
      result: {
        applicationId: application._id.toString(),
        userId: application.approvedUserId?.toString(),
        setupRequired: false,
      },
    });

    const bankingProfile = await MemberBankingProfile.findOne({
      userId: application.approvedUserId,
    }).lean();
    expect(bankingProfile?.sourceApplicationId.toString()).toBe(
      application._id.toString()
    );
    expect(bankingProfile?.bankingSummary).toMatchObject({
      present: true,
      complete: true,
    });

    const applicationBanking = bankingCryptoService.decrypt(
      application.encryptedBanking!,
      'membership-application',
      application._id.toString()
    );
    const memberBanking = bankingCryptoService.decrypt(
      bankingProfile!.encryptedBanking,
      'member-banking-profile',
      application.approvedUserId!.toString()
    );
    expect(memberBanking).toEqual(applicationBanking);
  }
}

async function expectAccountSuspendedLifecycleFixture(): Promise<void> {
  const user = await User.findOne({
    email: 'account.suspended@club.invalid',
  }).lean();
  expect(user).toMatchObject({
    membershipStatus: MembershipStatus.ACTIVE,
    accountSuspension: {
      reason: 'Local account access development scenario',
    },
  });

  const player = await Player.findOne({ userId: user!._id }).lean();
  expect(player).toMatchObject({
    type: PlayerType.MEMBER,
    isActivePlayer: true,
  });
  expect(player!.teamIds.length).toBeGreaterThan(0);
  expect(await Team.countDocuments({ _id: { $in: player!.teamIds } })).toBe(
    player!.teamIds.length
  );
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('membershipApplicationSeed');
  databaseName = mongoLease.databaseName;
  process.env.MONGODB_URI = mongoLease.uri;
  activityUploadsRoot = await mkdtemp(
    path.join(tmpdir(), `club-${databaseName}-activity-`)
  );
  contactUploadsRoot = await mkdtemp(
    path.join(tmpdir(), `club-${databaseName}-contact-`)
  );
  mongoLease.assertOwnedDatabase();
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await mongoose.connection.dropDatabase();
});

afterAll(async () => {
  try {
    await mongoLease.release();
  } finally {
    if (originalDatabaseUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalDatabaseUri;
    await rm(activityUploadsRoot, { recursive: true, force: true });
    await rm(contactUploadsRoot, { recursive: true, force: true });
  }
});

describe('Membership Application development seed persistence', () => {
  it('keeps the full reset banking-ready with canonical approved ownership', async () => {
    const staleApplicationId = new mongoose.Types.ObjectId();
    const historicalActorId = new mongoose.Types.ObjectId();
    const historicalEntityId = new mongoose.Types.ObjectId();
    await MembershipApplication.collection.insertOne({
      _id: staleApplicationId,
      status: MemberApplicationStatus.APPROVED,
    });
    await MemberBankingProfile.collection.insertOne({
      userId: new mongoose.Types.ObjectId(),
      sourceApplicationId: staleApplicationId,
      encryptedBanking: {
        keyVersion: 'obsolete',
        nonce: 'stale',
        ciphertext: 'stale',
        authTag: 'stale',
      },
      bankingSummary: { present: true, complete: true },
    });
    await RegistrationApprovalEvent.collection.insertOne({
      applicationId: staleApplicationId,
      idempotencyKey: 'stale-seed-approval',
      intentFingerprint: 'stale',
      status: RegistrationApprovalStatus.PENDING,
    });
    await AuthSession.collection.insertOne({
      userId: new mongoose.Types.ObjectId(),
      tokenDigest: 'stale-auth-session',
      generation: 0,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await GuestPlay.collection.insertOne({
      memberId: new mongoose.Types.ObjectId(),
      status: 'pending',
    });
    await MembershipApplicationAccessToken.collection.insertOne({
      purpose: 'application_access',
      tokenDigest: 'stale-application-access',
      targetKey: 'stale',
      email: 'stale@example.test',
      applicationId: staleApplicationId,
      applicantAccessEpoch: 0,
      expiresAt: new Date(Date.now() + 60_000),
      cleanupAt: new Date(Date.now() + 120_000),
    });
    await MembershipApplicantSession.collection.insertOne({
      tokenDigest: 'stale-applicant-session',
      cookieSlotId: 'stale-slot',
      applicationId: staleApplicationId,
      applicantAccessEpoch: 0,
      expiresAt: new Date(Date.now() + 60_000),
    });
    await MembershipStudentProofOperation.collection.insertOne({
      applicationId: staleApplicationId,
      fileIds: ['stale-proof.pdf'],
      phase: 'old-files-pending-deletion',
      retryCount: 0,
    });
    const historicalAudit = await AuditLog.create({
      eventType: AuditEventType.USER_UPDATED,
      entityType: EntityType.USER,
      entityId: historicalEntityId,
      actorId: historicalActorId,
      actorAccountKind: AccountKind.PERSON,
      source: 'human',
      changes: [{ field: 'sentinel', newValue: 'historical-reset-sentinel' }],
    });
    const historicalArchive = {
      _id: new Types.ObjectId(),
      eventType: AuditEventType.USER_UPDATED,
      entityType: EntityType.USER,
      entityId: historicalEntityId,
      actorId: historicalActorId,
      actorEmail: 'former-admin@example.test',
      actorAccountKind: AccountKind.PERSON,
      action: AuditAction.UPDATE,
      metadata: { source: 'historical-archive-reset-sentinel' },
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      archivedAt: new Date('2025-04-01T00:00:00.000Z'),
    };
    await mongoose.connection.db
      ?.collection('auditlogs_archive')
      .insertOne(historicalArchive);

    await seedData('all', {
      target: resetTarget(),
      activityUploadsRoot,
      contactUploadsRoot,
      publicDocumentUploadsRoot: activityUploadsRoot,
    });

    expect(await AuthSession.countDocuments()).toBe(0);
    expect(await GuestPlay.countDocuments()).toBe(0);
    expect(await MembershipApplicationAccessToken.countDocuments()).toBe(0);
    expect(await MembershipApplicantSession.countDocuments()).toBe(0);
    expect(await MembershipStudentProofOperation.countDocuments()).toBe(0);
    expect(await AuditLog.findById(historicalAudit._id).lean()).toMatchObject({
      actorId: historicalActorId,
      source: 'human',
      changes: [{ field: 'sentinel', newValue: 'historical-reset-sentinel' }],
    });
    expect(
      await mongoose.connection.db
        ?.collection('auditlogs_archive')
        .findOne({ _id: historicalArchive._id })
    ).toMatchObject({
      actorId: historicalActorId,
      actorEmail: 'former-admin@example.test',
      metadata: { source: 'historical-archive-reset-sentinel' },
    });
    await expectAccountSuspendedLifecycleFixture();
    await expectBankingReadyApprovedApplications();
  }, 120_000);

  it('keeps modular application seeding banking-ready and repeatable after user prerequisites', async () => {
    await seedData('users', { target: resetTarget() });
    const pendingSetupMember = await User.create({
      email: 'aaa.pending-setup@club.invalid',
      firstName: 'Pending',
      lastName: 'Setup',
      phone: '+49301234567',
      gender: 'female',
      dateOfBirth: '1990-01-01',
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      displayName: 'Member',
      capabilities: [Capability.AUTHENTICATED_ACCOUNT],
      membershipType: 'regular',
      membershipStatus: MembershipStatus.ACTIVE,
      accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
      address: {
        street: 'Pending Street 1',
        city: 'Berlin',
        postalCode: '10115',
        country: 'Germany',
      },
      isPlayer: false,
    });
    const userCount = await User.countDocuments({});

    await seedData('applications', { target: resetTarget() });
    expect(
      await MembershipApplication.exists({
        approvedUserId: pendingSetupMember._id,
      })
    ).toBeNull();
    expect(
      await RegistrationApprovalEvent.exists({
        'result.userId': pendingSetupMember._id.toString(),
      })
    ).toBeNull();
    await expectBankingReadyApprovedApplications();

    await seedData('applications', { target: resetTarget() });
    expect(await User.countDocuments({})).toBe(userCount);
    await expectBankingReadyApprovedApplications();
  }, 120_000);
});
