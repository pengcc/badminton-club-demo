import { Schema, model } from 'mongoose';
import type { ClubInformationValues } from '@club/shared-types/api/clubInformation';
import type { BaseDocument } from '../types/persistence/base';

export interface IClubInformation extends BaseDocument {
  singletonKey: 'club';
  content: ClubInformationValues;
  updatedBy: Schema.Types.ObjectId;
}

const clubInformationSchema = new Schema<IClubInformation>(
  {
    singletonKey: {
      type: String,
      enum: ['club'],
      default: 'club',
      immutable: true,
      unique: true,
      required: true,
    },
    content: {
      officialNameGerman: { type: String, required: true, trim: true },
      nameEnglish: { type: String, default: '', trim: true },
      nameChinese: { type: String, default: '', trim: true },
      shortName: { type: String, required: true, trim: true },
      foundingYear: { type: Number, required: true },
      introduction: {
        de: { type: String, default: '', trim: true },
        en: { type: String, default: '', trim: true },
        zh: { type: String, default: '', trim: true },
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

export const ClubInformation = model<IClubInformation>(
  'ClubInformation',
  clubInformationSchema
);
