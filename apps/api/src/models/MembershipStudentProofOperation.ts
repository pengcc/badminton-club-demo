import { Schema, model, type Types } from 'mongoose';

export type MembershipStudentProofOperationPhase =
  | 'new-files-uncommitted'
  | 'old-files-pending-deletion';

export type MembershipStudentProofOperationReason =
  | 'ACTIVE_PROOF_REFERENCE'
  | 'FILE_CLEANUP_FAILED'
  | 'JOURNAL_CLEANUP_FAILED'
  | 'DATABASE_CLEANUP_FAILED';

export interface MembershipStudentProofOperationDocument {
  applicationId: Types.ObjectId;
  fileIds: string[];
  phase: MembershipStudentProofOperationPhase;
  retryCount: number;
  lastReasonCode?: MembershipStudentProofOperationReason;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<MembershipStudentProofOperationDocument>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'MembershipApplication',
      required: true,
      index: true,
    },
    fileIds: {
      type: [String],
      required: true,
      validate: {
        validator: (values: string[]) =>
          values.length >= 1 &&
          values.length <= 2 &&
          values.every((value) => /^[a-f\d-]+\.(pdf|jpg|png)$/i.test(value)),
        message: 'Proof operation file IDs are invalid',
      },
    },
    phase: {
      type: String,
      enum: ['new-files-uncommitted', 'old-files-pending-deletion'],
      required: true,
    },
    retryCount: { type: Number, required: true, default: 0, min: 0, max: 100 },
    lastReasonCode: {
      type: String,
      enum: [
        'ACTIVE_PROOF_REFERENCE',
        'FILE_CLEANUP_FAILED',
        'JOURNAL_CLEANUP_FAILED',
        'DATABASE_CLEANUP_FAILED',
      ],
    },
  },
  { timestamps: true, versionKey: false }
);

schema.index({ phase: 1, updatedAt: 1 });

export const MembershipStudentProofOperation =
  model<MembershipStudentProofOperationDocument>(
    'MembershipStudentProofOperation',
    schema
  );
