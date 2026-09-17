import { Schema, model } from 'mongoose';

export type RegistrationAccessExpiryMode =
  | '30_days'
  | '90_days'
  | '180_days'
  | 'none';

export interface RegistrationAccessDocument {
  _id: string;
  tokenDigest: string;
  recoverableToken?: string;
  expiryMode: RegistrationAccessExpiryMode;
  expiresAt: Date | null;
  generation: number;
  updatedBy: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const registrationAccessSchema = new Schema<RegistrationAccessDocument>(
  {
    _id: { type: String, required: true },
    tokenDigest: { type: String, required: true, select: false },
    recoverableToken: {
      type: String,
      match: /^[A-Za-z0-9_-]{12}$/,
      select: false,
    },
    expiryMode: {
      type: String,
      enum: ['30_days', '90_days', '180_days', 'none'],
      required: true,
    },
    expiresAt: { type: Date, default: null },
    generation: { type: Number, required: true, min: 1 },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, versionKey: false }
);
export const RegistrationAccess = model<RegistrationAccessDocument>(
  'RegistrationAccess',
  registrationAccessSchema
);
