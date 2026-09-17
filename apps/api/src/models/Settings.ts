import type { Document, Types } from 'mongoose';
import { Schema, model } from 'mongoose';
import type { LocalizedText } from '@club/shared-types/api/localizedContent';

const emailListValidator = {
  validator: (emails: string[]) =>
    emails.every((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
  message: 'All emails must be valid email addresses',
};

/**
 * Settings Model
 *
 * Singleton pattern - only one settings document should exist.
 * Stores configuration facts whose behavior remains owned by dedicated capabilities.
 */

export interface ISettings extends Document {
  notificationRecipients: {
    applicationAlerts: {
      additional: string[];
    };
    tasterSessionAlerts?: {
      additional: string[];
    };
    guestPlayAlerts: {
      additional: string[];
    };
  };
  membershipOpen: boolean;
  activitiesEnabled?: boolean;
  teamPublicContent?: {
    enabled: boolean;
    title: LocalizedText;
    description: LocalizedText;
  };
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const settingsSchema = new Schema<ISettings>(
  {
    notificationRecipients: {
      applicationAlerts: {
        additional: {
          type: [String],
          default: [],
          validate: emailListValidator,
        },
      },
      tasterSessionAlerts: {
        additional: {
          type: [String],
          default: [],
          validate: emailListValidator,
        },
      },
      guestPlayAlerts: {
        additional: {
          type: [String],
          default: [],
          validate: emailListValidator,
        },
      },
    },
    membershipOpen: {
      type: Boolean,
      default: false,
    },
    activitiesEnabled: {
      type: Boolean,
      default: false,
    },
    teamPublicContent: {
      enabled: { type: Boolean, default: false },
      title: {
        de: { type: String, default: '', trim: true, maxlength: 200 },
        en: { type: String, default: '', trim: true, maxlength: 200 },
        zh: { type: String, default: '', trim: true, maxlength: 200 },
      },
      description: {
        de: { type: String, default: '', trim: true, maxlength: 2000 },
        en: { type: String, default: '', trim: true, maxlength: 2000 },
        zh: { type: String, default: '', trim: true, maxlength: 2000 },
      },
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

export const Settings = model<ISettings>('Settings', settingsSchema);
