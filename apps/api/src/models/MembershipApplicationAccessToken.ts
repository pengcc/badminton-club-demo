import { Schema, model, type Types } from 'mongoose';

export type MembershipApplicationTokenPurpose =
  | 'initial_verification'
  | 'application_access'
  | 'email_change';

export interface MembershipApplicationAccessTokenDocument {
  purpose: MembershipApplicationTokenPurpose;
  tokenDigest: string;
  targetKey: string;
  email: string;
  locale: 'de' | 'en' | 'zh';
  applicationId?: Types.ObjectId;
  applicantAccessEpoch: number;
  registrationGeneration?: number;
  registrationIssuedAt?: Date;
  expiresAt: Date;
  cleanupAt: Date;
  createdAt: Date;
}

const schema = new Schema<MembershipApplicationAccessTokenDocument>(
  {
    purpose: {
      type: String,
      enum: ['initial_verification', 'application_access', 'email_change'],
      required: true,
    },
    tokenDigest: { type: String, required: true, unique: true, select: false },
    targetKey: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    locale: { type: String, enum: ['de', 'en', 'zh'], default: 'de' },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'MembershipApplication',
    },
    applicantAccessEpoch: { type: Number, required: true, default: 0, min: 0 },
    registrationGeneration: { type: Number },
    registrationIssuedAt: { type: Date },
    expiresAt: { type: Date, required: true },
    cleanupAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

schema.index({ purpose: 1, targetKey: 1 }, { unique: true });
schema.index({ cleanupAt: 1 }, { expireAfterSeconds: 0 });

export const MembershipApplicationAccessToken =
  model<MembershipApplicationAccessTokenDocument>(
    'MembershipApplicationAccessToken',
    schema
  );
