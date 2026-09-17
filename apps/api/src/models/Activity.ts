import type { Document, Types } from 'mongoose';
import { Schema, model } from 'mongoose';
import { Language } from '@club/shared-types/core/enums';
import type { LocalizedText } from '@club/shared-types/api/localizedContent';

/**
 * Activity Model
 *
 * Manages club activities with multi-language support, image uploads,
 * and optional video links. Covers past recaps, photo galleries,
 * match highlights, and future events.
 */

export interface IActivityTranslation {
  name: string;
  description: string;
}

export interface IActivity extends Document {
  // Multi-language content
  translations: {
    [Language.GERMAN]: IActivityTranslation;
    [Language.ENGLISH]: IActivityTranslation;
    [Language.CHINESE]: IActivityTranslation;
  };

  // Media
  images: string[]; // Array of uploaded image URLs
  videoLink: string; // Optional video URL
  videoDescription: LocalizedText; // Localized description for the video link

  // Metadata
  isVisible: boolean; // Visibility toggle
  order: number; // Display order (lower = higher priority)

  // Audit fields
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const activityTranslationSchema = new Schema<IActivityTranslation>(
  {
    name: {
      type: String,
      maxlength: [200, 'Activity name too long'],
    },
    description: {
      type: String,
      maxlength: [5000, 'Description too long'],
    },
  },
  { _id: false }
);

const activitySchema = new Schema<IActivity>(
  {
    translations: {
      [Language.GERMAN]: {
        type: activityTranslationSchema,
        required: true,
      },
      [Language.ENGLISH]: {
        type: activityTranslationSchema,
        required: true,
      },
      [Language.CHINESE]: {
        type: activityTranslationSchema,
        required: true,
      },
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: (v: string[]) => v.length <= 10,
        message: 'Maximum 10 images allowed per activity',
      },
    },
    videoLink: {
      type: String,
      default: '',
      maxlength: [500, 'Video link too long'],
    },
    videoDescription: {
      [Language.GERMAN]: { type: String, default: '', maxlength: 200 },
      [Language.ENGLISH]: { type: String, default: '', maxlength: 200 },
      [Language.CHINESE]: { type: String, default: '', maxlength: 200 },
    },
    isVisible: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
      min: 0,
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
activitySchema.index({ isVisible: 1, order: 1 });

export const Activity = model<IActivity>('Activity', activitySchema);
