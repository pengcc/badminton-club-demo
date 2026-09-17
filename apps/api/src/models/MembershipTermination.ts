import type { Document, Types } from 'mongoose';
import { Schema, model } from 'mongoose';
import {
  MembershipTerminationSource,
  MembershipTerminationStatus,
  AccountKind,
} from '@club/shared-types/core/enums';

interface ActorSnapshot {
  id: Types.ObjectId;
  email: string;
  accountKind: AccountKind;
  displayName: string;
}

interface ProcessingFailureSnapshot {
  code: string;
  message: string;
  failedAt: Date;
}

export interface IMembershipTermination extends Document {
  userId: Types.ObjectId;
  status: MembershipTerminationStatus;
  isOpen: boolean;
  source: MembershipTerminationSource;
  requestedAt: Date;
  requestedBy: ActorSnapshot;
  requestedEffectiveDate: string;
  requestNote?: string;
  requestIdempotencyKey: string;
  requestIntentFingerprint: string;
  approvedAt?: Date;
  approvedBy?: ActorSnapshot;
  confirmedEffectiveDate?: string;
  approvalNote?: string;
  approvalIdempotencyKey?: string;
  approvalIntentFingerprint?: string;
  rejectedAt?: Date;
  rejectedBy?: ActorSnapshot;
  rejectionReason?: string;
  rejectionIdempotencyKey?: string;
  rejectionIntentFingerprint?: string;
  lastProcessingFailure?: ProcessingFailureSnapshot;
  effectiveAt?: Date;
  lifecycleIdempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const actorSnapshotSchema = new Schema<ActorSnapshot>(
  {
    id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    accountKind: {
      type: String,
      enum: Object.values(AccountKind),
      required: true,
    },
    displayName: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const processingFailureSnapshotSchema = new Schema<ProcessingFailureSnapshot>(
  {
    code: { type: String, required: true, trim: true, maxlength: 100 },
    message: { type: String, required: true, trim: true, maxlength: 500 },
    failedAt: { type: Date, required: true },
  },
  { _id: false }
);

const membershipTerminationSchema = new Schema<IMembershipTermination>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(MembershipTerminationStatus),
      required: true,
      index: true,
    },
    isOpen: { type: Boolean, required: true, default: true },
    source: {
      type: String,
      enum: Object.values(MembershipTerminationSource),
      required: true,
    },
    requestedAt: { type: Date, required: true },
    requestedBy: { type: actorSnapshotSchema, required: true },
    requestedEffectiveDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    requestNote: { type: String, trim: true, maxlength: 1000 },
    requestIdempotencyKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    requestIntentFingerprint: { type: String, required: true },
    approvedAt: Date,
    approvedBy: actorSnapshotSchema,
    confirmedEffectiveDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    approvalNote: { type: String, trim: true, maxlength: 1000 },
    approvalIdempotencyKey: { type: String, unique: true, sparse: true },
    approvalIntentFingerprint: String,
    rejectedAt: Date,
    rejectedBy: actorSnapshotSchema,
    rejectionReason: { type: String, trim: true, maxlength: 1000 },
    rejectionIdempotencyKey: { type: String, unique: true, sparse: true },
    rejectionIntentFingerprint: String,
    lastProcessingFailure: processingFailureSnapshotSchema,
    effectiveAt: Date,
    lifecycleIdempotencyKey: String,
  },
  {
    timestamps: true,
    collection: 'membership_terminations',
  }
);

membershipTerminationSchema.index(
  { userId: 1, isOpen: 1 },
  {
    unique: true,
    partialFilterExpression: { isOpen: true },
    name: 'one_open_termination_per_user',
  }
);
membershipTerminationSchema.index({ status: 1, confirmedEffectiveDate: 1 });

membershipTerminationSchema.pre('validate', function validateState(next) {
  const approvedOrEffective =
    this.status === MembershipTerminationStatus.APPROVED ||
    this.status === MembershipTerminationStatus.EFFECTIVE;
  if (
    approvedOrEffective &&
    (!this.approvedAt ||
      !this.approvedBy ||
      !this.confirmedEffectiveDate ||
      !this.approvalIdempotencyKey ||
      !this.approvalIntentFingerprint)
  ) {
    return next(
      new Error('Approved termination requires complete approval facts')
    );
  }
  const hasRejectionFacts = Boolean(
    this.rejectedAt ||
      this.rejectedBy ||
      this.rejectionReason ||
      this.rejectionIdempotencyKey ||
      this.rejectionIntentFingerprint
  );
  const hasApprovalFacts = Boolean(
    this.approvedAt ||
      this.approvedBy ||
      this.confirmedEffectiveDate ||
      this.approvalIdempotencyKey ||
      this.approvalIntentFingerprint ||
      this.effectiveAt ||
      this.lifecycleIdempotencyKey ||
      this.lastProcessingFailure
  );
  if (approvedOrEffective && hasRejectionFacts) {
    return next(new Error('Approved termination cannot have rejection facts'));
  }
  if (
    this.status === MembershipTerminationStatus.PENDING_REVIEW &&
    (hasApprovalFacts || hasRejectionFacts)
  ) {
    return next(new Error('Pending termination cannot have review facts'));
  }
  if (
    this.status === MembershipTerminationStatus.EFFECTIVE &&
    (!this.effectiveAt || this.isOpen)
  ) {
    return next(
      new Error('Effective termination must be closed with an effective time')
    );
  }
  const rejected = this.status === MembershipTerminationStatus.REJECTED;
  if (
    rejected &&
    (!this.rejectedAt ||
      !this.rejectedBy ||
      !this.rejectionReason ||
      !this.rejectionIdempotencyKey ||
      !this.rejectionIntentFingerprint ||
      this.isOpen ||
      this.source !== MembershipTerminationSource.ONLINE)
  ) {
    return next(
      new Error('Rejected termination requires complete rejection facts')
    );
  }
  if (rejected && hasApprovalFacts) {
    return next(new Error('Rejected termination cannot have approval facts'));
  }
  if (
    (this.status === MembershipTerminationStatus.PENDING_REVIEW ||
      this.status === MembershipTerminationStatus.APPROVED) &&
    !this.isOpen
  ) {
    return next(
      new Error('Pending and approved terminations must remain open')
    );
  }
  next();
});

export const MembershipTermination = model<IMembershipTermination>(
  'MembershipTermination',
  membershipTerminationSchema
);
