import type { Document, Types } from 'mongoose';
import { model, Schema } from 'mongoose';
import { Language } from '@club/shared-types/core/enums';
import type { LocalizedText } from '@club/shared-types/api/localizedContent';

export interface IPublicDocument extends Document {
  displayName: LocalizedText;
  documentDate: string;
  fileUrl: string;
  isVisible: boolean;
  order: number;
  createdBy?: Types.ObjectId;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const publicDocumentSchema = new Schema<IPublicDocument>(
  {
    displayName: {
      [Language.GERMAN]: { type: String, required: true, maxlength: 200 },
      [Language.ENGLISH]: { type: String, default: '', maxlength: 200 },
      [Language.CHINESE]: { type: String, default: '', maxlength: 200 },
    },
    documentDate: { type: String, required: true },
    fileUrl: { type: String, default: '', maxlength: 1000 },
    isVisible: { type: Boolean, default: true },
    order: { type: Number, required: true, min: 0, validate: Number.isInteger },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'publicdocumentitems' }
);

export const PublicDocument = model<IPublicDocument>(
  'PublicDocument',
  publicDocumentSchema
);
