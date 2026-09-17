import { Schema, model, type Types } from 'mongoose';

export interface MembershipApplicantSessionDocument {
  tokenDigest: string;
  cookieSlotId: string;
  applicationId: Types.ObjectId;
  applicantAccessEpoch: number;
  expiresAt: Date;
  createdAt: Date;
}

const schema = new Schema<MembershipApplicantSessionDocument>(
  {
    tokenDigest: { type: String, required: true, unique: true, select: false },
    cookieSlotId: { type: String, required: true, unique: true },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: 'MembershipApplication',
      required: true,
      index: true,
    },
    applicantAccessEpoch: { type: Number, required: true, default: 0, min: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false }, versionKey: false }
);

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
schema.index({ applicationId: 1, applicantAccessEpoch: 1 });

export const MembershipApplicantSession =
  model<MembershipApplicantSessionDocument>(
    'MembershipApplicantSession',
    schema
  );
