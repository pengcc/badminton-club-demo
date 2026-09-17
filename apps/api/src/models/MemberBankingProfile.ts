import type { Domain } from '@club/shared-types/domain/membershipApplication';
import { Schema, model, type Document, type Types } from 'mongoose';

export interface IMemberBankingProfile extends Document {
  userId: Types.ObjectId;
  encryptedBanking: Domain.BankingEncryptionEnvelope;
  bankingSummary: Domain.BankingSummary;
  sourceApplicationId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

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
    present: { type: Boolean, required: true },
    complete: { type: Boolean, required: true },
    ibanLastFour: { type: String },
  },
  { _id: false }
);

const schema = new Schema<IMemberBankingProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    encryptedBanking: { type: encryptionEnvelopeSchema, required: true },
    bankingSummary: { type: bankingSummarySchema, required: true },
    sourceApplicationId: {
      type: Schema.Types.ObjectId,
      ref: 'MembershipApplication',
      required: true,
    },
  },
  { timestamps: true, collection: 'member_banking_profiles' }
);

schema.index({ sourceApplicationId: 1 });

export const MemberBankingProfile = model<IMemberBankingProfile>(
  'MemberBankingProfile',
  schema
);
