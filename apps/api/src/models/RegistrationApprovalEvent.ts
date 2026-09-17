import type { Document, Types } from 'mongoose';
import { Schema, model } from 'mongoose';

export enum RegistrationApprovalStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
}

export interface RegistrationApprovalResultRecord {
  applicationId: string;
  userId: string;
  playerId?: string;
  setupGeneration: number;
  setupRequired: boolean;
}

export interface IRegistrationApprovalEvent extends Document {
  applicationId: Types.ObjectId;
  idempotencyKey: string;
  intentFingerprint: string;
  status: RegistrationApprovalStatus;
  result?: RegistrationApprovalResultRecord;
}

const schema = new Schema<IRegistrationApprovalEvent>(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'MembershipApplication',
      required: true,
      unique: true,
    },
    idempotencyKey: { type: String, required: true, unique: true, trim: true },
    intentFingerprint: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(RegistrationApprovalStatus),
      required: true,
    },
    result: { type: Schema.Types.Mixed },
  },
  { timestamps: true, collection: 'registration_approval_events' }
);

export const RegistrationApprovalEvent = model<IRegistrationApprovalEvent>(
  'RegistrationApprovalEvent',
  schema
);
