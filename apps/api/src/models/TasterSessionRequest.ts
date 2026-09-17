import type { Document, Types } from 'mongoose';
import { Schema, model } from 'mongoose';
import type {
  TasterSessionDeclineReason,
  TasterSessionDeliveryStatus,
  TasterSessionPlayerLevel,
  TasterSessionStatus,
} from '@club/shared-types/api/tasterSessionRequest';
import {
  TASTER_SESSION_COLLECTION,
  TASTER_SESSION_INDEX_MANIFEST,
} from '../config/tasterSessionPersistence';

export interface ITasterSessionRequest extends Document {
  name: string;
  email: string;
  playerLevel: TasterSessionPlayerLevel;
  message?: string;
  status: TasterSessionStatus;
  adminNotes?: string;
  declineReason?: TasterSessionDeclineReason;
  declineReasonDetails?: string;
  dispositionBy?: Types.ObjectId;
  dispositionAt?: Date;
  preference?: {
    optionId: string;
    startsAt: Date;
    locationId: string;
    locationName: string;
    timeSlotId?: string;
    locationAddress?: string;
    localDate?: string;
    startTime?: string;
    endTime?: string;
    participationNote?: string;
  };
  archived: boolean;
  archivedAt?: Date;
  archivedBy?: Types.ObjectId;
  delivery: {
    status: TasterSessionDeliveryStatus;
    attemptId?: string;
    claimedAt?: Date;
    attemptedAt?: Date;
  };
  locale: 'de' | 'en' | 'zh';
  createdAt: Date;
  updatedAt: Date;
  __v: number;
}

export const tasterSessionRequestSchema = new Schema<ITasterSessionRequest>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    playerLevel: {
      type: String,
      enum: ['beginner', 'experienced'],
      required: true,
    },
    message: { type: String, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ['pending', 'invited', 'declined'],
      default: 'pending',
      required: true,
    },
    adminNotes: { type: String, trim: true, maxlength: 1000 },
    declineReason: { type: String, enum: ['no_capacity', 'other'] },
    declineReasonDetails: { type: String, trim: true, maxlength: 500 },
    dispositionBy: { type: Schema.Types.ObjectId, ref: 'User' },
    dispositionAt: Date,
    preference: {
      type: {
        optionId: { type: String, required: true },
        startsAt: { type: Date, required: true },
        locationId: { type: String, required: true },
        locationName: { type: String, required: true, trim: true },
        timeSlotId: { type: String },
        locationAddress: { type: String, trim: true },
        localDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
        startTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
        endTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
        participationNote: { type: String, trim: true, maxlength: 500 },
      },
      required: false,
      _id: false,
    },
    archived: { type: Boolean, default: false, required: true },
    archivedAt: Date,
    archivedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    delivery: {
      type: {
        status: {
          type: String,
          enum: ['not_requested', 'in_progress', 'sent', 'failed', 'uncertain'],
          default: 'not_requested',
          required: true,
        },
        attemptId: String,
        claimedAt: Date,
        attemptedAt: Date,
      },
      default: () => ({ status: 'not_requested' }),
      required: true,
      _id: false,
    },
    locale: {
      type: String,
      enum: ['de', 'en', 'zh'],
      default: 'de',
      required: true,
    },
  },
  {
    timestamps: true,
    collection: TASTER_SESSION_COLLECTION,
    autoIndex: false,
  }
);

for (const { keys, options } of TASTER_SESSION_INDEX_MANIFEST) {
  tasterSessionRequestSchema.index(keys, options);
}

export const TasterSessionRequestModel = model<ITasterSessionRequest>(
  'TasterSessionRequest',
  tasterSessionRequestSchema
);
