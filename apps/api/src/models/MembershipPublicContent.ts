import { Schema, model } from 'mongoose';
import type { MembershipPublicContentValues } from '@club/shared-types/api/membershipPublicContent';
import type { BaseDocument } from '../types/persistence/base';

export interface IMembershipPublicContent extends BaseDocument {
  singletonKey: 'membership';
  content: MembershipPublicContentValues;
  updatedBy: Schema.Types.ObjectId;
}

const localizedText = (maxLength: number) => ({
  de: { type: String, default: '', trim: true, maxlength: maxLength },
  en: { type: String, default: '', trim: true, maxlength: maxLength },
  zh: { type: String, default: '', trim: true, maxlength: maxLength },
});

const schema = new Schema<IMembershipPublicContent>(
  {
    singletonKey: {
      type: String,
      enum: ['membership'],
      default: 'membership',
      immutable: true,
      unique: true,
      required: true,
    },
    content: {
      homepageSummary: localizedText(500),
      introduction: localizedText(3000),
      membershipTypes: localizedText(3000),
      membershipPath: localizedText(3000),
      applicationPreparation: localizedText(2000),
      studentProof: localizedText(2000),
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

export const MembershipPublicContent = model<IMembershipPublicContent>(
  'MembershipPublicContent',
  schema
);
