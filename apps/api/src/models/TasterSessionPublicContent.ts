import { Schema, model } from 'mongoose';
import type { TasterSessionPublicContentValues } from '@club/shared-types/api/tasterSessionPublicContent';
import type { BaseDocument } from '../types/persistence/base';

export interface ITasterSessionPublicContent extends BaseDocument {
  singletonKey: 'taster-session';
  content: TasterSessionPublicContentValues;
  updatedBy: Schema.Types.ObjectId;
}

const localizedText = (maxLength: number) => ({
  de: { type: String, default: '', trim: true, maxlength: maxLength },
  en: { type: String, default: '', trim: true, maxlength: maxLength },
  zh: { type: String, default: '', trim: true, maxlength: maxLength },
});

const schema = new Schema<ITasterSessionPublicContent>(
  {
    singletonKey: {
      type: String,
      enum: ['taster-session'],
      default: 'taster-session',
      immutable: true,
      unique: true,
      required: true,
    },
    content: {
      homepageSummary: localizedText(500),
      introduction: localizedText(3000),
      preparation: localizedText(2000),
      participationGuidance: localizedText(2000),
      followUpGuidance: localizedText(2000),
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

export const TasterSessionPublicContent = model<ITasterSessionPublicContent>(
  'TasterSessionPublicContent',
  schema
);
