import { model, Schema, type Types } from 'mongoose';

export interface AuthSessionDocument {
  tokenDigest: string;
  userId: Types.ObjectId;
  authSessionGeneration: number;
  expiresAt: Date;
  createdAt: Date;
}

const authSessionSchema = new Schema<AuthSessionDocument>(
  {
    tokenDigest: {
      type: String,
      required: true,
      unique: true,
      select: false,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    authSessionGeneration: {
      type: Number,
      required: true,
      min: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthSession = model<AuthSessionDocument>(
  'AuthSession',
  authSessionSchema
);
