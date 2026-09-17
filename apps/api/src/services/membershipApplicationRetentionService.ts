import {
  AuditEventType,
  MemberApplicationStatus,
} from '@club/shared-types/core/enums';
import { AuditLog } from '../models/AuditLog';
import {
  MembershipApplication,
  type IMembershipApplication,
} from '../models/MembershipApplication';
import { MembershipApplicationAccessToken } from '../models/MembershipApplicationAccessToken';
import { MembershipApplicantSession } from '../models/MembershipApplicantSession';
import { MembershipStudentProofOperation } from '../models/MembershipStudentProofOperation';
import { MemberBankingProfile } from '../models/MemberBankingProfile';
import { User } from '../models/User';
import {
  RegistrationApprovalEvent,
  RegistrationApprovalStatus,
} from '../models/RegistrationApprovalEvent';
import { config } from '../config';
import { MembershipStudentProofStore } from './membershipStudentProofStore';
import {
  MembershipStudentProofService,
  type MembershipStudentProofCleanupResult,
} from './membershipStudentProofService';
import {
  DRAFT_RETENTION_MS,
  RETENTION_CLAIM_STALE_MS,
  TERMINAL_RETENTION_MS,
  isMembershipApplicationRetentionDue,
} from './membershipApplicationRetentionPolicy';

export interface MembershipApplicationRetentionItem {
  applicationId: string;
  outcome: 'deleted' | 'skipped' | 'failed';
  reasonCode?:
    | 'APPROVED_CUTOVER_INCOMPLETE'
    | 'NO_LONGER_DUE'
    | 'ALREADY_REMOVED'
    | 'PROOF_CLEANUP_FAILED'
    | 'PROOF_OPERATION_PENDING'
    | 'DATABASE_CLEANUP_FAILED';
}

export interface MembershipApplicationRetentionResult {
  deletedCount: number;
  skippedCount: number;
  failureCount: number;
  expiredTokenCount: number;
  expiredSessionCount: number;
  proofOperationDeletedCount: number;
  proofOperationFailureCount: number;
  proofOperations: MembershipStudentProofCleanupResult[];
  items: MembershipApplicationRetentionItem[];
}

export class MembershipApplicationRetentionService {
  private readonly proofService: MembershipStudentProofService;

  constructor(private readonly files: MembershipStudentProofStore) {
    this.proofService = new MembershipStudentProofService(files);
  }

  private async approvedCutoverIsSafe(
    application: IMembershipApplication
  ): Promise<boolean> {
    if (!application.approvedUserId) return false;
    const [banking, approval, user, deletionAudit] = await Promise.all([
      MemberBankingProfile.exists({
        sourceApplicationId: application._id,
        userId: application.approvedUserId,
      }),
      RegistrationApprovalEvent.exists({
        applicationId: application._id,
        status: RegistrationApprovalStatus.COMPLETED,
        'result.userId': application.approvedUserId.toString(),
      }),
      User.exists({ _id: application.approvedUserId }),
      AuditLog.exists({
        eventType: AuditEventType.USER_DELETED,
        entityId: application.approvedUserId,
      }),
    ]);
    return Boolean(approval && (banking || (!user && deletionAudit)));
  }

  private async processOne(
    application: IMembershipApplication,
    now: Date
  ): Promise<MembershipApplicationRetentionItem> {
    const applicationId = application._id.toString();
    const claimed = await MembershipApplication.findOneAndUpdate(
      {
        _id: application._id,
        $or: [
          { retentionClaimedAt: { $exists: false } },
          {
            retentionClaimedAt: {
              $lte: new Date(now.getTime() - RETENTION_CLAIM_STALE_MS),
            },
          },
        ],
      },
      { $set: { retentionClaimedAt: now }, $inc: { __v: 1 } },
      { new: true }
    );
    if (!claimed || !isMembershipApplicationRetentionDue(claimed, now)) {
      if (claimed)
        await MembershipApplication.updateOne(
          { _id: claimed._id, retentionClaimedAt: now },
          { $unset: { retentionClaimedAt: 1 }, $inc: { __v: 1 } }
        );
      return { applicationId, outcome: 'skipped', reasonCode: 'NO_LONGER_DUE' };
    }
    if (
      claimed.status === MemberApplicationStatus.APPROVED &&
      !(await this.approvedCutoverIsSafe(claimed))
    ) {
      await MembershipApplication.updateOne(
        { _id: claimed._id, retentionClaimedAt: now },
        { $unset: { retentionClaimedAt: 1 }, $inc: { __v: 1 } }
      );
      return {
        applicationId,
        outcome: 'skipped',
        reasonCode: 'APPROVED_CUTOVER_INCOMPLETE',
      };
    }

    if (
      await MembershipStudentProofOperation.exists({
        applicationId: claimed._id,
      })
    ) {
      await MembershipApplication.updateOne(
        { _id: claimed._id, retentionClaimedAt: now },
        { $unset: { retentionClaimedAt: 1 }, $inc: { __v: 1 } }
      );
      return {
        applicationId,
        outcome: 'failed',
        reasonCode: 'PROOF_OPERATION_PENDING',
      };
    }

    try {
      await this.files.removeOwned(
        applicationId,
        claimed.studentProof.map((proof) => proof.id)
      );
    } catch {
      await MembershipApplication.updateOne(
        { _id: claimed._id, retentionClaimedAt: now },
        { $unset: { retentionClaimedAt: 1 }, $inc: { __v: 1 } }
      ).catch(() => undefined);
      return {
        applicationId,
        outcome: 'failed',
        reasonCode: 'PROOF_CLEANUP_FAILED',
      };
    }

    try {
      const current = await MembershipApplication.findOne({
        _id: application._id,
        retentionClaimedAt: now,
      });
      if (!current)
        return {
          applicationId,
          outcome: 'skipped',
          reasonCode: 'ALREADY_REMOVED',
        };
      if (!isMembershipApplicationRetentionDue(current, now)) {
        await MembershipApplication.updateOne(
          { _id: current._id, retentionClaimedAt: now },
          { $unset: { retentionClaimedAt: 1 }, $inc: { __v: 1 } }
        );
        return {
          applicationId,
          outcome: 'skipped',
          reasonCode: 'NO_LONGER_DUE',
        };
      }
      if (
        await MembershipStudentProofOperation.exists({
          applicationId: current._id,
        })
      ) {
        await MembershipApplication.updateOne(
          { _id: current._id, retentionClaimedAt: now },
          { $unset: { retentionClaimedAt: 1 }, $inc: { __v: 1 } }
        );
        return {
          applicationId,
          outcome: 'failed',
          reasonCode: 'PROOF_OPERATION_PENDING',
        };
      }
      await MembershipApplicantSession.deleteMany({
        applicationId: application._id,
      });
      await MembershipApplicationAccessToken.deleteMany({
        applicationId: application._id,
      });
      const deleted = await MembershipApplication.deleteOne({
        _id: application._id,
        retentionClaimedAt: now,
      });
      return deleted.deletedCount === 1
        ? { applicationId, outcome: 'deleted' }
        : { applicationId, outcome: 'skipped', reasonCode: 'ALREADY_REMOVED' };
    } catch {
      await MembershipApplication.updateOne(
        { _id: application._id, retentionClaimedAt: now },
        { $unset: { retentionClaimedAt: 1 }, $inc: { __v: 1 } }
      ).catch(() => undefined);
      return {
        applicationId,
        outcome: 'failed',
        reasonCode: 'DATABASE_CLEANUP_FAILED',
      };
    }
  }

  async processDue(
    now = new Date()
  ): Promise<MembershipApplicationRetentionResult> {
    const proofOperations =
      await this.proofService.processPendingOperations(now);
    const [expiredTokens, expiredSessions, applications] = await Promise.all([
      MembershipApplicationAccessToken.deleteMany({ cleanupAt: { $lte: now } }),
      MembershipApplicantSession.deleteMany({ expiresAt: { $lte: now } }),
      MembershipApplication.find({
        $or: [
          {
            status: MemberApplicationStatus.DRAFT,
            applicantDataUpdatedAt: {
              $lte: new Date(now.getTime() - DRAFT_RETENTION_MS),
            },
          },
          {
            status: MemberApplicationStatus.APPROVED,
            approvedAt: {
              $lte: new Date(now.getTime() - TERMINAL_RETENTION_MS),
            },
          },
          {
            status: MemberApplicationStatus.REJECTED,
            rejectedAt: {
              $lte: new Date(now.getTime() - TERMINAL_RETENTION_MS),
            },
          },
          {
            status: MemberApplicationStatus.WITHDRAWN,
            withdrawnAt: {
              $lte: new Date(now.getTime() - TERMINAL_RETENTION_MS),
            },
          },
        ],
      }),
    ]);

    const items: MembershipApplicationRetentionItem[] = [];
    for (const application of applications)
      items.push(await this.processOne(application, now));
    return {
      deletedCount: items.filter((item) => item.outcome === 'deleted').length,
      skippedCount: items.filter((item) => item.outcome === 'skipped').length,
      failureCount: items.filter((item) => item.outcome === 'failed').length,
      expiredTokenCount: expiredTokens.deletedCount,
      expiredSessionCount: expiredSessions.deletedCount,
      proofOperationDeletedCount: proofOperations.filter(
        (item) => item.outcome === 'deleted'
      ).length,
      proofOperationFailureCount: proofOperations.filter(
        (item) => item.outcome === 'failed'
      ).length,
      proofOperations,
      items,
    };
  }
}

export const membershipApplicationRetentionService =
  new MembershipApplicationRetentionService(
    new MembershipStudentProofStore(config.privateUploadsRoot)
  );
