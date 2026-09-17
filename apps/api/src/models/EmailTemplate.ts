import type { Document } from 'mongoose';
import { Schema, model } from 'mongoose';

/**
 * Email Template Model
 *
 * Stores editable email templates with i18n support.
 * Templates use {{variable}} syntax for dynamic content.
 */

export interface IEmailTemplate extends Document {
  name: string;
  subject: {
    de: string;
    en: string;
    zh: string;
  };
  body: {
    de: string;
    en: string;
    zh: string;
  };
  variables: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const emailTemplateSchema = new Schema<IEmailTemplate>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    subject: {
      de: { type: String, required: true },
      en: { type: String, required: true },
      zh: { type: String, required: true },
    },
    body: {
      de: { type: String, required: true },
      en: { type: String, required: true },
      zh: { type: String, required: true },
    },
    variables: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
emailTemplateSchema.index({ name: 1, isActive: 1 });

export const EmailTemplate = model<IEmailTemplate>(
  'EmailTemplate',
  emailTemplateSchema
);
