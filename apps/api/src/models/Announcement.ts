import type { Document, Types } from 'mongoose';
import { Schema, model } from 'mongoose';
import {
  AnnouncementType,
  announcementDisplayDateSchema,
  announcementExternalLinkSchema,
  type AnnouncementTranslations,
} from '@club/shared-types/api/announcement';
import { Language } from '@club/shared-types/core/enums';

export { AnnouncementType };

/**
 * Announcement Model
 *
 * Manages homepage announcements with multi-language support.
 * Each announcement can have different content per language.
 */

export interface IAnnouncementContent {
  title: string;
  content: string;
}

export interface IAnnouncement extends Document {
  // Multi-language content
  translations: AnnouncementTranslations;

  // Metadata
  type: AnnouncementType;
  displayDate: string; // Display date (e.g., "2025.08.01")
  externalLink: string;
  isActive: boolean; // Visibility toggle
  order: number; // Display order (lower = higher priority)
  demoScratchLeaseId?: string;

  // Audit fields
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const announcementContentSchema = new Schema<IAnnouncementContent>(
  {
    title: {
      type: String,
      // required: true, // Allow empty strings
      maxlength: [200, 'Title too long'],
    },
    content: {
      type: String,
      // required: true, // Allow empty strings
      maxlength: [2000, 'Content too long'],
    },
  },
  { _id: false }
);

const announcementSchema = new Schema<IAnnouncement>(
  {
    translations: {
      [Language.GERMAN]: {
        type: announcementContentSchema,
        required: true,
      },
      [Language.ENGLISH]: {
        type: announcementContentSchema,
        required: true,
      },
      [Language.CHINESE]: {
        type: announcementContentSchema,
        required: true,
      },
    },
    type: {
      type: String,
      enum: Object.values(AnnouncementType),
      default: AnnouncementType.INFO,
      required: true,
    },
    displayDate: {
      type: String,
      required: true,
      validate: {
        validator: (value: string) =>
          announcementDisplayDateSchema.safeParse(value).success,
        message: 'Display date must be a valid date in YYYY.MM.DD format',
      },
    },
    externalLink: {
      type: String,
      default: '',
      maxlength: 1000,
      validate: {
        validator: (value: string) =>
          announcementExternalLinkSchema.safeParse(value).success,
        message: 'External link must be empty or a valid HTTP(S) URL',
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
      min: 0,
    },
    demoScratchLeaseId: {
      type: String,
      required: false,
      select: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying
announcementSchema.index({ isActive: 1, order: 1 });
announcementSchema.index(
  { demoScratchLeaseId: 1 },
  {
    unique: true,
    partialFilterExpression: { demoScratchLeaseId: { $type: 'string' } },
    name: 'unique_demo_announcement_per_lease',
  }
);

export const Announcement = model<IAnnouncement>(
  'Announcement',
  announcementSchema
);
