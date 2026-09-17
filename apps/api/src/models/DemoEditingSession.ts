import { model, Schema, type Types } from 'mongoose';

export const DEMO_EDITING_SINGLETON_KEY = 'showcase-public-demo';

export interface DemoEditingSessionDocument {
  singletonKey: typeof DEMO_EDITING_SINGLETON_KEY;
  state: 'idle' | 'active' | 'cleanup-blocked';
  leaseId?: string;
  authSessionId?: Types.ObjectId;
  startedAt?: Date;
  expiresAt?: Date;
  mutationCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const demoEditingSessionSchema = new Schema<DemoEditingSessionDocument>(
  {
    singletonKey: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
    },
    state: {
      type: String,
      enum: ['idle', 'active', 'cleanup-blocked'],
      required: true,
      default: 'idle',
    },
    leaseId: { type: String },
    authSessionId: { type: Schema.Types.ObjectId, ref: 'AuthSession' },
    startedAt: { type: Date },
    expiresAt: { type: Date },
    mutationCount: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true, versionKey: false }
);

export const DemoEditingSession = model<DemoEditingSessionDocument>(
  'DemoEditingSession',
  demoEditingSessionSchema
);
