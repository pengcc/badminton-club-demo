import { randomUUID } from 'node:crypto';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
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
  AuditEventType,
  Gender,
  MemberApplicationStatus,
  MembershipStatus,
  MembershipType,
  AccountKind,
  Capability,
  EntityType,
} from '@club/shared-types/core/enums';
import { AuditLog } from '../../models/AuditLog';
import { MembershipApplication } from '../../models/MembershipApplication';
import { MembershipApplicationAccessToken } from '../../models/MembershipApplicationAccessToken';
import { MembershipApplicantSession } from '../../models/MembershipApplicantSession';
import { MembershipStudentProofOperation } from '../../models/MembershipStudentProofOperation';
import { MemberBankingProfile } from '../../models/MemberBankingProfile';
import {
  RegistrationApprovalEvent,
  RegistrationApprovalStatus,
} from '../../models/RegistrationApprovalEvent';
import { User } from '../../models/User';
import EmailService from '../../services/emailService';
import { MembershipApplicationRetentionService } from '../../services/membershipApplicationRetentionService';
import { TERMINAL_RETENTION_MS } from '../../services/membershipApplicationRetentionPolicy';
import { MembershipStudentProofStore } from '../../services/membershipStudentProofStore';
import { MEMBERSHIP_STUDENT_PROOF_OPERATION_STALE_MS } from '../../services/membershipStudentProofService';
import { PasswordSetupDeliveryService } from '../../services/passwordSetupDeliveryService';
import { MembershipApplicationService } from '../../services/membershipApplicationService';

let mongoLease: MongoTestDatabaseLease;
let privateRoot = '';
let store: MembershipStudentProofStore;
let service: MembershipApplicationRetentionService;
const now = new Date('2026-08-07T12:00:00.000Z');

async function application(status: MemberApplicationStatus, terminalAt?: Date) {
  const id = new mongoose.Types.ObjectId();
  return MembershipApplication.create({
    _id: id,
    verifiedEmail: `${id}@example.test`,
    personalInfo: {
      firstName: 'Retention',
      lastName: 'Test',
      email: `${id}@example.test`,
    },
    membershipType: MembershipType.REGULAR,
    bankingSummary: { present: false, complete: false },
    status,
    applicantDataUpdatedAt:
      status === MemberApplicationStatus.DRAFT
        ? new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000)
        : now,
    ...(status === MemberApplicationStatus.APPROVED
      ? { approvedAt: terminalAt }
      : {}),
    ...(status === MemberApplicationStatus.REJECTED
      ? { rejectedAt: terminalAt }
      : {}),
    ...(status === MemberApplicationStatus.WITHDRAWN
      ? { withdrawnAt: terminalAt }
      : {}),
  });
}

async function attachProof(applicationId: string) {
  const [proof] = await store.stageAndPromote(applicationId, [
    {
      buffer: Buffer.from('%PDF-test'),
      mimetype: 'application/pdf',
      size: 9,
      originalname: 'proof.pdf',
    },
  ]);
  await MembershipApplication.findByIdAndUpdate(applicationId, {
    $set: { studentProof: [proof] },
  });
  return proof;
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('membershipApplicationRetention');
  mongoLease.assertOwnedDatabase();
  privateRoot = await mkdtemp(path.join(tmpdir(), 'membership-retention-'));
  store = new MembershipStudentProofStore(privateRoot);
  service = new MembershipApplicationRetentionService(store);
  await Promise.all([
    MembershipApplication.syncIndexes(),
    MembershipApplicationAccessToken.syncIndexes(),
    MembershipApplicantSession.syncIndexes(),
    MemberBankingProfile.syncIndexes(),
    RegistrationApprovalEvent.syncIndexes(),
    User.syncIndexes(),
    MembershipStudentProofOperation.syncIndexes(),
    AuditLog.syncIndexes(),
  ]);
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await Promise.all([
    MembershipApplication.deleteMany({}),
    MembershipApplicationAccessToken.deleteMany({}),
    MembershipApplicantSession.deleteMany({}),
    MemberBankingProfile.deleteMany({}),
    RegistrationApprovalEvent.deleteMany({}),
    User.deleteMany({}),
    MembershipStudentProofOperation.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
  await store.resetForTests();
  vi.restoreAllMocks();
  vi.spyOn(EmailService, 'sendFromTemplate').mockResolvedValue();
});

afterAll(async () => {
  try {
    await mongoLease.release();
  } finally {
    if (privateRoot) await rm(privateRoot, { recursive: true, force: true });
  }
});

describe('Membership Application retention persistence', () => {
  it('deletes due draft/terminal records proof-first while preserving pending and incomplete approved cutovers', async () => {
    const draft = await application(MemberApplicationStatus.DRAFT);
    const draftProof = await attachProof(draft.id);
    const pending = await application(MemberApplicationStatus.PENDING);
    await MembershipApplication.findByIdAndUpdate(pending.id, {
      $set: { applicantDataUpdatedAt: new Date(0) },
    });
    const rejected = await application(
      MemberApplicationStatus.REJECTED,
      new Date(now.getTime() - TERMINAL_RETENTION_MS)
    );
    const unsafeApproved = await application(
      MemberApplicationStatus.APPROVED,
      new Date(now.getTime() - TERMINAL_RETENTION_MS)
    );
    await MembershipApplicantSession.create({
      tokenDigest: randomUUID().replaceAll('-', '').padEnd(64, '0'),
      cookieSlotId: 'a'.repeat(22),
      applicationId: draft._id,
      applicantAccessEpoch: 0,
      expiresAt: new Date(now.getTime() + 60_000),
    });
    await MembershipApplicationAccessToken.create({
      purpose: 'application_access',
      tokenDigest: randomUUID().replaceAll('-', '').padEnd(64, '0'),
      targetKey: draft.id,
      email: draft.verifiedEmail,
      applicationId: draft._id,
      expiresAt: new Date(now.getTime() + 60_000),
      cleanupAt: new Date(now.getTime() + 60_000),
    });
    const orphanApplicationId = new mongoose.Types.ObjectId();
    await MembershipApplicantSession.create({
      tokenDigest: randomUUID().replaceAll('-', '').padEnd(64, '1'),
      cookieSlotId: 'b'.repeat(22),
      applicationId: orphanApplicationId,
      applicantAccessEpoch: 0,
      expiresAt: now,
    });
    await MembershipApplicationAccessToken.create({
      purpose: 'application_access',
      tokenDigest: randomUUID().replaceAll('-', '').padEnd(64, '1'),
      targetKey: orphanApplicationId.toString(),
      email: 'expired@example.test',
      applicationId: orphanApplicationId,
      expiresAt: new Date(now.getTime() - 60_000),
      cleanupAt: now,
    });

    const result = await service.processDue(now);

    expect(result).toMatchObject({
      deletedCount: 2,
      skippedCount: 1,
      failureCount: 0,
      expiredTokenCount: 1,
      expiredSessionCount: 1,
    });
    expect(await MembershipApplication.findById(draft.id)).toBeNull();
    expect(await MembershipApplication.findById(rejected.id)).toBeNull();
    expect(await MembershipApplication.findById(pending.id)).not.toBeNull();
    expect(
      await MembershipApplication.findById(unsafeApproved.id)
    ).not.toBeNull();
    expect(
      await MembershipApplicantSession.countDocuments({
        applicationId: draft._id,
      })
    ).toBe(0);
    expect(
      await MembershipApplicationAccessToken.countDocuments({
        applicationId: draft._id,
      })
    ).toBe(0);
    await expect(
      store.readOwned(draft.id, draftProof.id)
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(EmailService.sendFromTemplate).not.toHaveBeenCalled();
  });

  it('preserves Member banking and approval provenance and supports setup recovery after application deletion', async () => {
    const approved = await application(
      MemberApplicationStatus.APPROVED,
      new Date(now.getTime() - TERMINAL_RETENTION_MS)
    );
    const user = await User.create({
      email: approved.verifiedEmail,
      firstName: 'Retention',
      lastName: 'Member',
      gender: Gender.FEMALE,
      dateOfBirth: '1990-01-01',
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      displayName: 'Member',
      capabilities: [Capability.AUTHENTICATED_ACCOUNT],
      membershipStatus: MembershipStatus.ACTIVE,
      membershipType: MembershipType.REGULAR,
      accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
      passwordSetupGeneration: 1,
      passwordSetupExpiresAt: new Date(now.getTime() + 60_000),
    });
    approved.approvedUserId = user._id;
    await approved.save();
    await MemberBankingProfile.create({
      userId: user._id,
      sourceApplicationId: approved._id,
      encryptedBanking: {
        keyVersion: 'test',
        nonce: 'n',
        ciphertext: 'c',
        authTag: 't',
      },
      bankingSummary: { present: true, complete: true, ibanLastFour: '2051' },
    });
    await RegistrationApprovalEvent.create({
      applicationId: approved._id,
      idempotencyKey: `approval-${approved.id}`,
      intentFingerprint: randomUUID(),
      status: RegistrationApprovalStatus.COMPLETED,
      result: {
        applicationId: approved.id,
        userId: user.id,
        setupGeneration: 1,
        setupRequired: true,
      },
    });

    await expect(service.processDue(now)).resolves.toMatchObject({
      deletedCount: 1,
      failureCount: 0,
    });
    expect(await MembershipApplication.findById(approved.id)).toBeNull();
    expect(
      await MemberBankingProfile.countDocuments({ userId: user._id })
    ).toBe(1);
    expect(
      await RegistrationApprovalEvent.countDocuments({
        applicationId: approved._id,
      })
    ).toBe(1);
    await expect(
      PasswordSetupDeliveryService.reissueForApplication(approved.id)
    ).resolves.toMatchObject({
      generation: 2,
      deliveryStatus: 'sent',
    });
  });

  it('accepts intentional account deletion proof but rejects unexplained missing banking', async () => {
    const approved = await application(
      MemberApplicationStatus.APPROVED,
      new Date(now.getTime() - TERMINAL_RETENTION_MS)
    );
    const deletedUserId = new mongoose.Types.ObjectId();
    approved.approvedUserId = deletedUserId;
    await approved.save();
    await RegistrationApprovalEvent.create({
      applicationId: approved._id,
      idempotencyKey: `approval-${approved.id}`,
      intentFingerprint: randomUUID(),
      status: RegistrationApprovalStatus.COMPLETED,
      result: {
        applicationId: approved.id,
        userId: deletedUserId.toString(),
        setupGeneration: 1,
        setupRequired: false,
      },
    });

    await expect(service.processDue(now)).resolves.toMatchObject({
      deletedCount: 0,
      skippedCount: 1,
    });
    expect(await MembershipApplication.findById(approved.id)).not.toBeNull();

    await AuditLog.create({
      eventType: AuditEventType.USER_DELETED,
      entityType: EntityType.USER,
      entityId: deletedUserId,
      actorId: new mongoose.Types.ObjectId(),
      actorAccountKind: AccountKind.PERSON,
      source: 'human',
      reason: 'Administrator confirmed permanent deletion',
      changes: [{ field: 'physicalCleanup', newValue: true }],
    });

    await expect(service.processDue(now)).resolves.toMatchObject({
      deletedCount: 1,
      skippedCount: 0,
    });
    expect(await MembershipApplication.findById(approved.id)).toBeNull();
  });

  it('retries safely after proof or database failure and treats missing files as success', async () => {
    const proofFailure = await application(
      MemberApplicationStatus.WITHDRAWN,
      new Date(now.getTime() - TERMINAL_RETENTION_MS)
    );
    await attachProof(proofFailure.id);
    const remove = vi
      .spyOn(store, 'removeOwned')
      .mockRejectedValueOnce(new Error('filesystem unavailable'));
    await expect(service.processDue(now)).resolves.toMatchObject({
      deletedCount: 0,
      failureCount: 1,
    });
    expect(
      await MembershipApplication.findById(proofFailure.id)
    ).not.toBeNull();
    remove.mockRestore();
    await expect(service.processDue(now)).resolves.toMatchObject({
      deletedCount: 1,
      failureCount: 0,
    });

    const databaseFailure = await application(
      MemberApplicationStatus.REJECTED,
      new Date(now.getTime() - TERMINAL_RETENTION_MS)
    );
    const proof = await attachProof(databaseFailure.id);
    const deleteOne = vi
      .spyOn(MembershipApplication, 'deleteOne')
      .mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.processDue(now)).resolves.toMatchObject({
      deletedCount: 0,
      failureCount: 1,
    });
    expect(
      await MembershipApplication.findById(databaseFailure.id)
    ).not.toBeNull();
    await expect(
      store.readOwned(databaseFailure.id, proof.id)
    ).rejects.toMatchObject({ statusCode: 404 });
    deleteOne.mockRestore();
    await expect(service.processDue(now)).resolves.toMatchObject({
      deletedCount: 1,
      failureCount: 0,
    });
  });

  it('claims one cleanup invocation and rejects an applicant mutation while that claim is active', async () => {
    const draft = await application(MemberApplicationStatus.DRAFT);
    await MembershipApplication.findByIdAndUpdate(draft.id, {
      $set: { retentionClaimedAt: new Date() },
    });
    await expect(
      MembershipApplicationService.saveApplicantData(draft.id, {
        motivation: 'late change',
      })
    ).rejects.toThrow('cleanup is in progress');

    await MembershipApplication.findByIdAndUpdate(draft.id, {
      $unset: { retentionClaimedAt: 1 },
    });
    const remove = vi.spyOn(store, 'removeOwned');
    const results = await Promise.all([
      service.processDue(now),
      service.processDue(now),
    ]);
    expect(results.reduce((sum, result) => sum + result.deletedCount, 0)).toBe(
      1
    );
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('retries crash-equivalent uncommitted and committed proof operations for non-terminal applications', async () => {
    const pending = await application(MemberApplicationStatus.PENDING);
    const prepared = store.prepareUploads([
      {
        buffer: Buffer.from('%PDF-uncommitted'),
        mimetype: 'application/pdf',
        size: 16,
        originalname: 'private.pdf',
      },
    ]);
    const uncommitted = await MembershipStudentProofOperation.create({
      applicationId: pending._id,
      fileIds: prepared.map((proof) => proof.id),
      phase: 'new-files-uncommitted',
    });
    const crashStagingDirectory = path.join(
      privateRoot,
      '.staging',
      'membership-student-proof',
      pending.id
    );
    const crashStagedPath = path.join(crashStagingDirectory, prepared[0].id);
    await mkdir(crashStagingDirectory, { recursive: true });
    await writeFile(crashStagedPath, prepared[0].buffer);

    const oldProof = await attachProof(pending.id);
    await MembershipApplication.findByIdAndUpdate(pending.id, {
      $set: { studentProof: [] },
    });
    await MembershipStudentProofOperation.create({
      applicationId: pending._id,
      fileIds: [oldProof.id],
      phase: 'old-files-pending-deletion',
    });
    await MembershipStudentProofOperation.updateMany(
      { applicationId: pending._id },
      {
        $set: {
          updatedAt: new Date(
            now.getTime() - MEMBERSHIP_STUDENT_PROOF_OPERATION_STALE_MS - 1
          ),
        },
      },
      { timestamps: false }
    );

    const result = await service.processDue(now);
    expect(result).toMatchObject({
      proofOperationDeletedCount: 2,
      proofOperationFailureCount: 0,
    });
    expect(
      await MembershipStudentProofOperation.countDocuments({
        applicationId: pending._id,
      })
    ).toBe(0);
    await expect(access(crashStagedPath)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(
      store.readOwned(pending.id, prepared[0].id)
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      store.readOwned(pending.id, oldProof.id)
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(await MembershipApplication.findById(pending.id)).not.toBeNull();
    expect(uncommitted.phase).toBe('new-files-uncommitted');
  });

  it('does not clean a fresh uncommitted journal while its request may still be in flight', async () => {
    const pending = await application(MemberApplicationStatus.PENDING);
    const prepared = store.prepareUploads([
      {
        buffer: Buffer.from('%PDF-in-flight'),
        mimetype: 'application/pdf',
        size: 14,
        originalname: 'private.pdf',
      },
    ]);
    const operation = await MembershipStudentProofOperation.create({
      applicationId: pending._id,
      fileIds: [prepared[0].id],
      phase: 'new-files-uncommitted',
    });
    await store.promotePrepared(pending.id, prepared);

    await expect(service.processDue(new Date())).resolves.toMatchObject({
      proofOperationDeletedCount: 0,
      proofOperationFailureCount: 0,
    });
    expect(
      await MembershipStudentProofOperation.findById(operation._id)
    ).not.toBeNull();
    await expect(store.readOwned(pending.id, prepared[0].id)).resolves.toEqual(
      prepared[0].buffer
    );
  });

  it('recovers idempotently when byte deletion succeeds before journal deletion fails', async () => {
    const pending = await application(MemberApplicationStatus.PENDING);
    const prepared = store.prepareUploads([
      {
        buffer: Buffer.from('%PDF-idempotent'),
        mimetype: 'application/pdf',
        size: 15,
        originalname: 'private.pdf',
      },
    ]);
    const operation = await MembershipStudentProofOperation.create({
      applicationId: pending._id,
      fileIds: [prepared[0].id],
      phase: 'new-files-uncommitted',
    });
    await store.promotePrepared(pending.id, prepared);
    await MembershipStudentProofOperation.updateOne(
      { _id: operation._id },
      {
        $set: {
          updatedAt: new Date(
            now.getTime() - MEMBERSHIP_STUDENT_PROOF_OPERATION_STALE_MS - 1
          ),
        },
      },
      { timestamps: false }
    );
    const removeJournal = vi
      .spyOn(MembershipStudentProofOperation, 'deleteOne')
      .mockRejectedValueOnce(new Error('database unavailable'));

    await expect(service.processDue(now)).resolves.toMatchObject({
      proofOperationFailureCount: 1,
    });
    await expect(
      store.readOwned(pending.id, prepared[0].id)
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(
      await MembershipStudentProofOperation.findById(operation._id)
    ).not.toBeNull();
    removeJournal.mockRestore();
    await MembershipStudentProofOperation.updateOne(
      { _id: operation._id },
      {
        $set: {
          updatedAt: new Date(
            now.getTime() - MEMBERSHIP_STUDENT_PROOF_OPERATION_STALE_MS - 1
          ),
        },
      },
      { timestamps: false }
    );
    await expect(service.processDue(now)).resolves.toMatchObject({
      proofOperationDeletedCount: 1,
      proofOperationFailureCount: 0,
    });
    expect(
      await MembershipStudentProofOperation.findById(operation._id)
    ).toBeNull();
  });

  it('keeps a terminal application while any journal ID is still an active proof', async () => {
    const withdrawn = await application(
      MemberApplicationStatus.WITHDRAWN,
      new Date(now.getTime() - TERMINAL_RETENTION_MS)
    );
    const proof = await attachProof(withdrawn.id);
    await MembershipStudentProofOperation.create({
      applicationId: withdrawn._id,
      fileIds: [proof.id],
      phase: 'old-files-pending-deletion',
    });
    await MembershipStudentProofOperation.updateMany(
      { applicationId: withdrawn._id },
      {
        $set: {
          updatedAt: new Date(
            now.getTime() - MEMBERSHIP_STUDENT_PROOF_OPERATION_STALE_MS - 1
          ),
        },
      },
      { timestamps: false }
    );

    const result = await service.processDue(now);
    expect(result.proofOperations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          applicationId: withdrawn.id,
          phase: 'old-files-pending-deletion',
          outcome: 'failed',
          reasonCode: 'ACTIVE_PROOF_REFERENCE',
        }),
      ])
    );
    expect(await MembershipApplication.findById(withdrawn.id)).not.toBeNull();
    expect(
      await MembershipStudentProofOperation.countDocuments({
        applicationId: withdrawn._id,
      })
    ).toBe(1);
    await expect(
      store.readOwned(withdrawn.id, proof.id)
    ).resolves.toBeInstanceOf(Buffer);
  });
});
