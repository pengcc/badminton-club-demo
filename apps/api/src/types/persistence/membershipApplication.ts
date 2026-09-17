import type { Domain } from '@club/shared-types/domain/membershipApplication';
import type { MemberApplicationStatus } from '@club/shared-types/core/enums';
import type { Types } from 'mongoose';
import type { BaseDocument } from './base';

export interface MembershipApplicationPersistence extends BaseDocument {
  verifiedEmail: string;
  communicationLocale?: 'de' | 'en' | 'zh';
  personalInfo: Domain.PersonalInfoDraft;
  membershipType?: Domain.MembershipApplication['membershipType'];
  motivation?: string;
  encryptedBanking?: Domain.BankingEncryptionEnvelope;
  bankingSummary: Domain.BankingSummary;
  status: MemberApplicationStatus;
  studentProof: Domain.StudentProofMetadata[];
  signedApplicationReceipt?: {
    receivedAt: Date;
    receivedBy: Types.ObjectId;
    resetAt?: Date;
    resetReason?: string;
  };
  signedSepaReceipt?: {
    receivedAt: Date;
    receivedBy: Types.ObjectId;
    resetAt?: Date;
    resetReason?: string;
  };
  reviewer?:
    | Types.ObjectId
    | string
    | { _id: Types.ObjectId; firstName: string; lastName: string };
  reviewDate?: Date;
  reviewNote?: string;
  rejectionReason?: string;
  approvalMessage?: string;
  decisionNotificationKind?: 'approval' | 'rejection';
  decisionNotificationStatus?:
    | 'pending'
    | 'claimed'
    | 'sent'
    | 'failed'
    | 'uncertain';
  decisionNotificationClaimedAt?: Date;
  decisionNotificationAttemptedAt?: Date;
  submittedAt?: Date;
  approvedAt?: Date;
  rejectedAt?: Date;
  withdrawnAt?: Date;
  applicantDataUpdatedAt: Date;
  approvedUserId?: Types.ObjectId;
  retentionClaimedAt?: Date;
}

export type MembershipApplicationPersistenceType =
  MembershipApplicationPersistence;
