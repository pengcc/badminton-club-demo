import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
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
import { MemberApplicationStatus } from '@club/shared-types/core/enums';
import { MembershipApplication } from '../../models/MembershipApplication';
import { MembershipStudentProofOperation } from '../../models/MembershipStudentProofOperation';
import { MembershipStudentProofService } from '../../services/membershipStudentProofService';
import { MEMBERSHIP_STUDENT_PROOF_OPERATION_STALE_MS } from '../../services/membershipStudentProofService';
import { MembershipStudentProofStore } from '../../services/membershipStudentProofStore';

let mongoLease: MongoTestDatabaseLease;
let privateRoot = '';
let files: MembershipStudentProofStore;
let service: MembershipStudentProofService;

async function studentApplication() {
  return MembershipApplication.create({
    verifiedEmail: `${randomUUID()}@example.test`,
    personalInfo: { email: 'student@example.test' },
    membershipType: 'student',
    bankingSummary: { present: false, complete: false },
    status: MemberApplicationStatus.PENDING,
    applicantDataUpdatedAt: new Date(),
  });
}

const upload = {
  buffer: Buffer.from('%PDF-1.4\n%%EOF'),
  mimetype: 'application/pdf',
  size: 14,
  originalname: 'proof.pdf',
};

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('membershipStudentProofService');
  mongoLease.assertOwnedDatabase();
  privateRoot = await mkdtemp(path.join(tmpdir(), 'membership-proof-service-'));
  files = new MembershipStudentProofStore(privateRoot);
  service = new MembershipStudentProofService(files);
  await Promise.all([
    MembershipApplication.syncIndexes(),
    MembershipStudentProofOperation.syncIndexes(),
  ]);
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await Promise.all([
    MembershipApplication.deleteMany({}),
    MembershipStudentProofOperation.deleteMany({}),
  ]);
  await files.resetForTests();
  vi.restoreAllMocks();
});

afterAll(async () => {
  try {
    await mongoLease.release();
  } finally {
    if (privateRoot) await rm(privateRoot, { recursive: true, force: true });
  }
});

describe('MembershipStudentProofService durable cleanup ownership', () => {
  it('retains a promoted proof in the journal when application save and compensation both fail', async () => {
    const application = await studentApplication();
    vi.spyOn(MembershipApplication.prototype, 'save').mockRejectedValueOnce(
      new Error('database unavailable')
    );
    const remove = vi
      .spyOn(files, 'removeOwned')
      .mockRejectedValueOnce(new Error('filesystem unavailable'));

    await expect(
      service.replaceApplicantProofs(application.id, [], [upload])
    ).rejects.toThrow('database unavailable');
    const operation = await MembershipStudentProofOperation.findOne({
      applicationId: application._id,
    }).lean();
    expect(operation).toMatchObject({
      phase: 'new-files-uncommitted',
      retryCount: 1,
      lastReasonCode: 'FILE_CLEANUP_FAILED',
    });
    await expect(
      files.readOwned(application.id, operation!.fileIds[0])
    ).resolves.toEqual(upload.buffer);

    remove.mockRestore();
    await expect(
      service.processPendingOperations(
        new Date(Date.now() + MEMBERSHIP_STUDENT_PROOF_OPERATION_STALE_MS + 1)
      )
    ).resolves.toEqual([
      expect.objectContaining({
        outcome: 'deleted',
        phase: 'new-files-uncommitted',
      }),
    ]);
    await expect(
      files.readOwned(application.id, operation!.fileIds[0])
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(
      await MembershipStudentProofOperation.findById(operation!._id)
    ).toBeNull();
  });

  it('commits replacement while retaining failed old-file cleanup for retry', async () => {
    const application = await studentApplication();
    const [oldProof] = await files.stageAndPromote(application.id, [upload]);
    application.studentProof = [oldProof];
    await application.save();
    const remove = vi
      .spyOn(files, 'removeOwned')
      .mockRejectedValueOnce(new Error('filesystem unavailable'));

    const proofs = await service.replaceApplicantProofs(
      application.id,
      [],
      [{ ...upload, originalname: 'replacement.pdf' }]
    );
    expect(proofs).toHaveLength(1);
    expect(proofs[0].id).not.toBe(oldProof.id);
    expect(
      (await MembershipApplication.findById(application.id).lean())
        ?.studentProof[0].id
    ).toBe(proofs[0].id);
    const operation = await MembershipStudentProofOperation.findOne({
      applicationId: application._id,
    }).lean();
    expect(operation).toMatchObject({
      phase: 'old-files-pending-deletion',
      fileIds: [oldProof.id],
      lastReasonCode: 'FILE_CLEANUP_FAILED',
    });
    await expect(files.readOwned(application.id, oldProof.id)).resolves.toEqual(
      upload.buffer
    );

    remove.mockRestore();
    await service.processPendingOperations(
      new Date(Date.now() + MEMBERSHIP_STUDENT_PROOF_OPERATION_STALE_MS + 1)
    );
    await expect(
      files.readOwned(application.id, oldProof.id)
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      files.readOwned(application.id, proofs[0].id)
    ).resolves.toEqual(upload.buffer);
    expect(
      await MembershipStudentProofOperation.countDocuments({
        applicationId: application._id,
      })
    ).toBe(0);
  });

  it('commits administrator removal while retaining failed byte cleanup for retry', async () => {
    const application = await studentApplication();
    const [proof] = await files.stageAndPromote(application.id, [upload]);
    application.studentProof = [proof];
    await application.save();
    const remove = vi
      .spyOn(files, 'removeOwned')
      .mockRejectedValueOnce(new Error('filesystem unavailable'));

    await expect(
      service.deleteForAdmin(application.id, proof.id)
    ).resolves.toBeUndefined();
    expect(
      (await MembershipApplication.findById(application.id).lean())
        ?.studentProof
    ).toEqual([]);
    expect(
      await MembershipStudentProofOperation.findOne({
        applicationId: application._id,
      }).lean()
    ).toMatchObject({
      phase: 'old-files-pending-deletion',
      fileIds: [proof.id],
    });

    remove.mockRestore();
    await service.processPendingOperations(
      new Date(Date.now() + MEMBERSHIP_STUDENT_PROOF_OPERATION_STALE_MS + 1)
    );
    await expect(
      files.readOwned(application.id, proof.id)
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(
      await MembershipStudentProofOperation.countDocuments({
        applicationId: application._id,
      })
    ).toBe(0);
  });
});
