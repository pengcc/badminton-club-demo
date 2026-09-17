import { Schema, model } from 'mongoose';
import type { RecruitmentPublicContentValues } from '@club/shared-types/api/recruitmentPublicContent';
import type { BaseDocument } from '../types/persistence/base';

export interface IRecruitmentPublicContent extends BaseDocument {
  singletonKey: 'recruitment';
  content: Omit<RecruitmentPublicContentValues, 'contactEntryId'> & {
    contactEntryId: Schema.Types.ObjectId | null;
  };
  updatedBy: Schema.Types.ObjectId;
}

const localizedText = (maxLength: number) => ({
  de: { type: String, default: '', trim: true, maxlength: maxLength },
  en: { type: String, default: '', trim: true, maxlength: maxLength },
  zh: { type: String, default: '', trim: true, maxlength: maxLength },
});

const schema = new Schema<IRecruitmentPublicContent>(
  {
    singletonKey: {
      type: String,
      enum: ['recruitment'],
      default: 'recruitment',
      immutable: true,
      unique: true,
      required: true,
    },
    content: {
      isOpen: { type: Boolean, default: false, required: true },
      introduction: localizedText(3000),
      requirements: localizedText(3000),
      tryoutGuidance: localizedText(3000),
      contactEntryId: {
        type: Schema.Types.ObjectId,
        ref: 'ContactEntry',
        default: null,
      },
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

export const RecruitmentPublicContent = model<IRecruitmentPublicContent>(
  'RecruitmentPublicContent',
  schema
);
