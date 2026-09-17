import type { Document, Types } from 'mongoose';
import { Schema, model } from 'mongoose';
import {
  AccountOnboardingTargetKind,
  type AccountOnboardingTargetKind as AccountOnboardingTargetKindValue,
} from '@club/shared-types/domain/accountOnboarding';

export enum AccountOnboardingOperationStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
}

export interface AccountOnboardingOperationResultRecord {
  userId: string;
  playerId?: string;
  targetKind: AccountOnboardingTargetKind;
  setupRequired: boolean;
  setupGeneration: number;
}

export interface IAccountOnboardingOperation extends Document {
  idempotencyKey: string;
  intentFingerprint: string;
  actorId: Types.ObjectId;
  sourceKind: 'administrator' | 'legacy_import';
  sourceReference?: string;
  normalizedEmail: string;
  targetKind: AccountOnboardingTargetKindValue;
  status: AccountOnboardingOperationStatus;
  result?: AccountOnboardingOperationResultRecord;
  errorCode?: string;
  errorMessage?: string;
}

const schema = new Schema<IAccountOnboardingOperation>(
  {
    idempotencyKey: { type: String, required: true, unique: true, trim: true },
    intentFingerprint: { type: String, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    sourceKind: {
      type: String,
      enum: ['administrator', 'legacy_import'],
      required: true,
    },
    sourceReference: { type: String, trim: true },
    normalizedEmail: { type: String, required: true, lowercase: true },
    targetKind: {
      type: String,
      enum: Object.values(AccountOnboardingTargetKind),
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(AccountOnboardingOperationStatus),
      required: true,
    },
    result: { type: Schema.Types.Mixed },
    errorCode: { type: String },
    errorMessage: { type: String },
  },
  { timestamps: true, collection: 'account_onboarding_operations' }
);

export const AccountOnboardingOperation = model<IAccountOnboardingOperation>(
  'AccountOnboardingOperation',
  schema
);
