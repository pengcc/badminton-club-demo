import type { Domain } from '@club/shared-types/domain/membershipApplication';
import {
  Gender,
  MemberApplicationStatus,
  MembershipType,
} from '@club/shared-types/core/enums';
import { Schema, model, type Document, type Types } from 'mongoose';

export interface IMembershipApplication extends Document {
  verifiedEmail: string;
  communicationLocale: 'de' | 'en' | 'zh';
  applicantAccessEpoch: number;
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
  signedDocumentResetHistory: Array<{
    documentKind: 'application' | 'sepa';
    reasonCategory: string;
    resetAt: Date;
  }>;
  reviewer?: Types.ObjectId;
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
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema(
  {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    postalCode: { type: String, trim: true },
    country: { type: String, trim: true },
  },
  { _id: false }
);

const personalInfoSchema = new Schema(
  {
    firstName: { type: String, trim: true, maxlength: 50 },
    lastName: { type: String, trim: true, maxlength: 50 },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true, maxlength: 40 },
    dateOfBirth: { type: String, trim: true, maxlength: 10 },
    gender: { type: String, enum: Object.values(Gender) },
    address: { type: addressSchema },
  },
  { _id: false }
);

const encryptionEnvelopeSchema = new Schema<Domain.BankingEncryptionEnvelope>(
  {
    keyVersion: { type: String, required: true },
    nonce: { type: String, required: true },
    ciphertext: { type: String, required: true },
    authTag: { type: String, required: true },
  },
  { _id: false }
);

const bankingSummarySchema = new Schema<Domain.BankingSummary>(
  {
    present: { type: Boolean, required: true, default: false },
    complete: { type: Boolean, required: true, default: false },
    ibanLastFour: { type: String },
  },
  { _id: false }
);

const proofSchema = new Schema(
  {
    id: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: {
      type: String,
      enum: ['application/pdf', 'image/jpeg', 'image/png'],
      required: true,
    },
    size: { type: Number, required: true, max: 10 * 1024 * 1024 },
    createdAt: { type: Date, required: true },
  },
  { _id: false }
);

const receiptSchema = new Schema(
  {
    receivedAt: { type: Date, required: true },
    receivedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    resetAt: { type: Date },
    resetReason: { type: String },
  },
  { _id: false }
);

const receiptResetSchema = new Schema(
  {
    documentKind: {
      type: String,
      enum: ['application', 'sepa'],
      required: true,
    },
    reasonCategory: { type: String, required: true },
    resetAt: { type: Date, required: true },
  },
  { _id: false }
);

const membershipApplicationSchema = new Schema<IMembershipApplication>(
  {
    verifiedEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    communicationLocale: {
      type: String,
      enum: ['de', 'en', 'zh'],
      default: 'de',
    },
    applicantAccessEpoch: { type: Number, required: true, default: 0, min: 0 },
    personalInfo: { type: personalInfoSchema, default: {} },
    membershipType: { type: String, enum: Object.values(MembershipType) },
    motivation: { type: String, trim: true, maxlength: 2000 },
    encryptedBanking: { type: encryptionEnvelopeSchema },
    bankingSummary: {
      type: bankingSummarySchema,
      required: true,
      default: { present: false, complete: false },
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(MemberApplicationStatus),
      default: MemberApplicationStatus.DRAFT,
    },
    studentProof: { type: [proofSchema], default: [] },
    signedApplicationReceipt: { type: receiptSchema },
    signedSepaReceipt: { type: receiptSchema },
    signedDocumentResetHistory: { type: [receiptResetSchema], default: [] },
    reviewer: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewDate: { type: Date },
    reviewNote: { type: String, trim: true },
    rejectionReason: { type: String, trim: true },
    approvalMessage: { type: String, trim: true },
    decisionNotificationKind: { type: String, enum: ['approval', 'rejection'] },
    decisionNotificationStatus: {
      type: String,
      enum: ['pending', 'claimed', 'sent', 'failed', 'uncertain'],
    },
    decisionNotificationClaimedAt: { type: Date },
    decisionNotificationAttemptedAt: { type: Date },
    submittedAt: { type: Date },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    withdrawnAt: { type: Date },
    applicantDataUpdatedAt: { type: Date, required: true, default: Date.now },
    approvedUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    retentionClaimedAt: { type: Date },
  },
  { timestamps: true, optimisticConcurrency: true }
);

membershipApplicationSchema.index(
  { verifiedEmail: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: {
        $in: [MemberApplicationStatus.DRAFT, MemberApplicationStatus.PENDING],
      },
    },
    name: 'one_current_membership_application_per_email',
  }
);
membershipApplicationSchema.index({ status: 1, submittedAt: -1 });
membershipApplicationSchema.index({ status: 1, applicantDataUpdatedAt: 1 });

export const MembershipApplication = model<IMembershipApplication>(
  'MembershipApplication',
  membershipApplicationSchema
);
