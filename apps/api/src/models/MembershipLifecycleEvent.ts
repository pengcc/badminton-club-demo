import type { Document, Types } from 'mongoose';
import { Schema, model } from 'mongoose';
import { MembershipLifecycleOperation } from '@club/shared-types/domain/membershipLifecycle';

export enum MembershipLifecycleEventStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface IMembershipLifecycleEvent extends Document {
  idempotencyKey: string;
  commandFingerprint: string;
  operation: MembershipLifecycleOperation;
  userId: Types.ObjectId;
  status: MembershipLifecycleEventStatus;
  result?: Record<string, unknown>;
  attemptCount: number;
  errorCode?: string;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const membershipLifecycleEventSchema = new Schema<IMembershipLifecycleEvent>(
  {
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    commandFingerprint: {
      type: String,
      required: true,
    },
    operation: {
      type: String,
      enum: Object.values(MembershipLifecycleOperation),
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(MembershipLifecycleEventStatus),
      required: true,
      index: true,
    },
    result: { type: Schema.Types.Mixed },
    attemptCount: { type: Number, required: true, default: 1, min: 1 },
    errorCode: { type: String },
    errorMessage: { type: String },
  },
  {
    timestamps: true,
    collection: 'membership_lifecycle_events',
  }
);

membershipLifecycleEventSchema.index({ userId: 1, createdAt: -1 });

export const MembershipLifecycleEvent = model<IMembershipLifecycleEvent>(
  'MembershipLifecycleEvent',
  membershipLifecycleEventSchema
);
