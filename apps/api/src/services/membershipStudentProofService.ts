import mongoose, { Types } from 'mongoose';
import { MemberApplicationStatus } from '@club/shared-types/core/enums';
import { MembershipApplication } from '../models/MembershipApplication';
import {
  MembershipStudentProofOperation,
  type MembershipStudentProofOperationPhase,
  type MembershipStudentProofOperationReason,
} from '../models/MembershipStudentProofOperation';
import { config } from '../config';
import { AppError } from '../utils/errors';
import {
  MEMBERSHIP_STUDENT_PROOF_MAX_FILES,
  MembershipStudentProofStore,
  type MembershipStudentProofUpload,
} from './membershipStudentProofStore';
import { RETENTION_CLAIM_STALE_MS } from './membershipApplicationRetentionPolicy';

export interface MembershipStudentProofCleanupResult {
  applicationId: string;
  operationId: string;
  phase: MembershipStudentProofOperationPhase;
  outcome: 'deleted' | 'failed';
  reasonCode?: MembershipStudentProofOperationReason;
}

export const MEMBERSHIP_STUDENT_PROOF_OPERATION_STALE_MS = 15 * 60 * 1000;

export class MembershipStudentProofService {
  constructor(private readonly files: MembershipStudentProofStore) {}

  private assertApplicantCanReplace(
    application: {
      status: MemberApplicationStatus;
      membershipType?: string;
      retentionClaimedAt?: Date;
      studentProof: Array<{ id: string }>;
    },
    retainedIds: string[],
    uploadCount: number
  ): void {
    if (
      application.retentionClaimedAt &&
      application.retentionClaimedAt.getTime() >
        Date.now() - RETENTION_CLAIM_STALE_MS
    ) {
      throw AppError.conflict(
        'Application cleanup is in progress; retry shortly'
      );
    }
    if (
      ![
        MemberApplicationStatus.DRAFT,
        MemberApplicationStatus.PENDING,
      ].includes(application.status)
    ) {
      throw AppError.conflict('Application proof is read-only');
    }
    if (application.membershipType !== 'student') {
      throw AppError.conflict(
        'Student proof is available only for student applications'
      );
    }
    const currentIds = application.studentProof.map((proof) => proof.id);
    if (
      new Set(retainedIds).size !== retainedIds.length ||
      retainedIds.some((id) => !currentIds.includes(id))
    ) {
      throw AppError.conflict('Student proof ownership could not be verified');
    }
    if (retainedIds.length + uploadCount > MEMBERSHIP_STUDENT_PROOF_MAX_FILES) {
      throw new AppError(
        'At most two student proof files are allowed',
        400,
        'PROOF_LIMIT_EXCEEDED'
      );
    }
  }

  private async recordRetry(
    operation: { _id: Types.ObjectId; retryCount: number },
    reasonCode: MembershipStudentProofOperationReason
  ): Promise<void> {
    await MembershipStudentProofOperation.updateOne(
      { _id: operation._id },
      {
        $set: {
          retryCount: Math.min(operation.retryCount + 1, 100),
          lastReasonCode: reasonCode,
        },
      }
    ).catch(() => undefined);
  }

  async cleanupOperation(
    operationId: string | Types.ObjectId
  ): Promise<MembershipStudentProofCleanupResult> {
    const operation =
      await MembershipStudentProofOperation.findById(operationId).lean();
    if (!operation) {
      return {
        applicationId: '',
        operationId: operationId.toString(),
        phase: 'old-files-pending-deletion',
        outcome: 'deleted',
      };
    }
    const applicationId = operation.applicationId.toString();
    const base = {
      applicationId,
      operationId: operation._id.toString(),
      phase: operation.phase,
    };
    let application;
    try {
      application = await MembershipApplication.findById(
        operation.applicationId
      )
        .select('studentProof')
        .lean();
    } catch {
      await this.recordRetry(operation, 'DATABASE_CLEANUP_FAILED');
      return {
        ...base,
        outcome: 'failed',
        reasonCode: 'DATABASE_CLEANUP_FAILED',
      };
    }
    const activeIds = new Set(
      application?.studentProof.map((proof) => proof.id) ?? []
    );
    if (operation.fileIds.some((id) => activeIds.has(id))) {
      await this.recordRetry(operation, 'ACTIVE_PROOF_REFERENCE');
      return {
        ...base,
        outcome: 'failed',
        reasonCode: 'ACTIVE_PROOF_REFERENCE',
      };
    }
    try {
      await this.files.removeOwned(applicationId, operation.fileIds);
    } catch {
      await this.recordRetry(operation, 'FILE_CLEANUP_FAILED');
      return { ...base, outcome: 'failed', reasonCode: 'FILE_CLEANUP_FAILED' };
    }
    try {
      await MembershipStudentProofOperation.deleteOne({ _id: operation._id });
      return { ...base, outcome: 'deleted' };
    } catch {
      await this.recordRetry(operation, 'JOURNAL_CLEANUP_FAILED');
      return {
        ...base,
        outcome: 'failed',
        reasonCode: 'JOURNAL_CLEANUP_FAILED',
      };
    }
  }

  async processPendingOperations(
    now = new Date()
  ): Promise<MembershipStudentProofCleanupResult[]> {
    const operations = await MembershipStudentProofOperation.find({
      updatedAt: {
        $lte: new Date(
          now.getTime() - MEMBERSHIP_STUDENT_PROOF_OPERATION_STALE_MS
        ),
      },
    })
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    const results: MembershipStudentProofCleanupResult[] = [];
    for (const operation of operations)
      results.push(await this.cleanupOperation(operation._id));
    return results;
  }

  async replaceApplicantProofs(
    applicationId: string,
    retainedIds: string[],
    uploads: MembershipStudentProofUpload[]
  ) {
    const application =
      await MembershipApplication.findById(applicationId).lean();
    if (!application) throw AppError.notFound('Application not found');
    this.assertApplicantCanReplace(application, retainedIds, uploads.length);
    const prepared = this.files.prepareUploads(uploads);
    const promotedMetadata = prepared.map(
      ({ buffer: _buffer, ...proof }) => proof
    );
    const journal =
      prepared.length > 0
        ? await MembershipStudentProofOperation.create({
            applicationId,
            fileIds: prepared.map((proof) => proof.id),
            phase: 'new-files-uncommitted',
          })
        : undefined;

    try {
      await this.files.promotePrepared(applicationId, prepared);
      const committed = await mongoose.connection.transaction(
        async (session) => {
          const current =
            await MembershipApplication.findById(applicationId).session(
              session
            );
          if (!current) throw AppError.notFound('Application not found');
          this.assertApplicantCanReplace(current, retainedIds, uploads.length);
          const previous = current.studentProof;
          const retained = previous.filter((proof) =>
            retainedIds.includes(proof.id)
          );
          const removedIds = previous
            .filter((proof) => !retainedIds.includes(proof.id))
            .map((proof) => proof.id);
          current.studentProof = [...retained, ...promotedMetadata];
          current.applicantDataUpdatedAt = new Date();
          await current.save({ session });

          let cleanupOperationId: Types.ObjectId | undefined;
          if (journal) {
            if (removedIds.length > 0) {
              await MembershipStudentProofOperation.updateOne(
                { _id: journal._id },
                {
                  $set: {
                    fileIds: removedIds,
                    phase: 'old-files-pending-deletion',
                  },
                  $unset: { lastReasonCode: 1 },
                },
                { session }
              );
              cleanupOperationId = journal._id;
            } else {
              await MembershipStudentProofOperation.deleteOne(
                { _id: journal._id },
                { session }
              );
            }
          } else if (removedIds.length > 0) {
            const [created] = await MembershipStudentProofOperation.create(
              [
                {
                  applicationId,
                  fileIds: removedIds,
                  phase: 'old-files-pending-deletion',
                },
              ],
              { session }
            );
            cleanupOperationId = created._id;
          }
          return { proofs: current.studentProof, cleanupOperationId };
        }
      );
      if (committed.cleanupOperationId) {
        await this.cleanupOperation(committed.cleanupOperationId).catch(
          () => undefined
        );
      }
      return committed.proofs;
    } catch (error) {
      if (journal)
        await this.cleanupOperation(journal._id).catch(() => undefined);
      throw error;
    }
  }

  async readForAdmin(applicationId: string, proofId: string) {
    const application =
      await MembershipApplication.findById(applicationId).lean();
    if (!application || application.status === MemberApplicationStatus.DRAFT) {
      throw AppError.notFound('Student proof not found');
    }
    const proof = application.studentProof.find(
      (candidate) => candidate.id === proofId
    );
    if (!proof) throw AppError.notFound('Student proof not found');
    return {
      metadata: proof,
      buffer: await this.files.readOwned(applicationId, proofId),
    };
  }

  async deleteForAdmin(applicationId: string, proofId: string) {
    const operationId = await mongoose.connection.transaction(
      async (session) => {
        const application =
          await MembershipApplication.findById(applicationId).session(session);
        if (
          !application ||
          application.status === MemberApplicationStatus.DRAFT
        ) {
          throw AppError.notFound('Student proof not found');
        }
        const proof = application.studentProof.find(
          (candidate) => candidate.id === proofId
        );
        if (!proof) throw AppError.notFound('Student proof not found');
        application.studentProof = application.studentProof.filter(
          (candidate) => candidate.id !== proofId
        );
        await application.save({ session });
        const [operation] = await MembershipStudentProofOperation.create(
          [
            {
              applicationId,
              fileIds: [proofId],
              phase: 'old-files-pending-deletion',
            },
          ],
          { session }
        );
        return operation._id;
      }
    );
    await this.cleanupOperation(operationId).catch(() => undefined);
  }
}

export const membershipStudentProofService = new MembershipStudentProofService(
  new MembershipStudentProofStore(config.privateUploadsRoot)
);
