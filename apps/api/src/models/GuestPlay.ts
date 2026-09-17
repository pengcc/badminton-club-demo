import type { Document, Types } from 'mongoose';
import { Schema, model } from 'mongoose';
import type {
  GuestPlayLocale,
  GuestPlayNotificationStatus,
  GuestPlayStatus,
} from '@club/shared-types/api/guestPlay';

export interface IGuestPlayNotificationEntry {
  status: GuestPlayNotificationStatus;
  attempts: number;
  lastAttemptAt?: Date;
  recipients: string[];
  sentAt?: Date;
  error?: 'configuration' | 'transport' | 'unknown';
  claimedAt?: Date;
  claimId?: string;
}

export interface IGuestPlay extends Document {
  memberId: Types.ObjectId;
  memberName: string;
  memberEmail: string;
  guestCount: number;
  message?: string;
  status: GuestPlayStatus;
  adminNotes?: string;
  decisionBy?: Types.ObjectId;
  decisionAt?: Date;
  appointment: {
    locationId: string;
    timeSlotId: string;
    locationName: string;
    locationAddress: string;
    localDate: string;
    startTime: string;
    endTime: string;
    startAt: Date;
  };
  activeRequestKey?: string;
  archived: boolean;
  archivedAt?: Date;
  archivedBy?: Types.ObjectId;
  notifications: {
    memberReceipt: IGuestPlayNotificationEntry;
    administratorAlert: IGuestPlayNotificationEntry;
    decisionEmail: IGuestPlayNotificationEntry;
  };
  locale: GuestPlayLocale;
  createdAt: Date;
  updatedAt: Date;
  __v: number;
}

const notificationEntrySchema = new Schema<IGuestPlayNotificationEntry>(
  {
    status: {
      type: String,
      enum: [
        'not_attempted',
        'not_configured',
        'sending',
        'sent',
        'failed',
        'uncertain',
      ],
      default: 'not_attempted',
      required: true,
    },
    attempts: { type: Number, default: 0, required: true, min: 0 },
    lastAttemptAt: Date,
    recipients: { type: [String], default: [], required: true },
    sentAt: Date,
    error: { type: String, enum: ['configuration', 'transport', 'unknown'] },
    claimedAt: Date,
    claimId: String,
  },
  { _id: false }
);

const emptyNotifications = () => ({
  memberReceipt: { status: 'not_attempted', attempts: 0, recipients: [] },
  administratorAlert: { status: 'not_attempted', attempts: 0, recipients: [] },
  decisionEmail: { status: 'not_attempted', attempts: 0, recipients: [] },
});

const notificationStateSchema = new Schema(
  {
    memberReceipt: { type: notificationEntrySchema, required: true },
    administratorAlert: { type: notificationEntrySchema, required: true },
    decisionEmail: { type: notificationEntrySchema, required: true },
  },
  { _id: false }
);

const guestPlaySchema = new Schema<IGuestPlay>(
  {
    memberId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    memberName: { type: String, required: true, trim: true, maxlength: 100 },
    memberEmail: { type: String, required: true, lowercase: true, trim: true },
    guestCount: { type: Number, required: true, min: 1, max: 5 },
    message: { type: String, trim: true, maxlength: 1000 },
    status: {
      type: String,
      enum: ['pending', 'approved', 'declined', 'cancelled'],
      default: 'pending',
      required: true,
    },
    adminNotes: { type: String, trim: true, maxlength: 1000 },
    decisionBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decisionAt: Date,
    appointment: {
      type: {
        locationId: { type: String, required: true },
        timeSlotId: { type: String, required: true },
        locationName: { type: String, required: true, trim: true },
        locationAddress: { type: String, required: true, trim: true },
        localDate: { type: String, required: true },
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
        startAt: { type: Date, required: true },
      },
      required: true,
      _id: false,
    },
    activeRequestKey: { type: String },
    archived: { type: Boolean, default: false, required: true },
    archivedAt: Date,
    archivedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    notifications: {
      type: notificationStateSchema,
      default: emptyNotifications,
      required: true,
    } as never,
    locale: {
      type: String,
      enum: ['de', 'en', 'zh'],
      default: 'de',
      required: true,
    },
  },
  { timestamps: true, collection: 'guestplays' }
);

guestPlaySchema.index({ memberId: 1, createdAt: -1 });
guestPlaySchema.index({ status: 1, archived: 1, createdAt: -1 });
guestPlaySchema.index(
  { activeRequestKey: 1 },
  {
    unique: true,
    partialFilterExpression: { activeRequestKey: { $type: 'string' } },
    name: 'one_active_guest_play_request_per_member_opportunity',
  }
);

export const GuestPlay = model<IGuestPlay>('GuestPlay', guestPlaySchema);
