import type { Document, Types } from 'mongoose';
import { model, Schema } from 'mongoose';
import { Language } from '@club/shared-types/core/enums';
import type { LocalizedText } from '@club/shared-types/api/localizedContent';

export interface IContactEntry extends Document {
  category: string;
  title: LocalizedText;
  description: LocalizedText;
  email: string;
  qrCode: string;
  qrCodeOriginalFilename: string;
  qrExplanation: LocalizedText;
  externalLink: string;
  externalLinkLabel: LocalizedText;
  isActive: boolean;
  order: number;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const localizedText = (maxLength: number) => ({
  [Language.GERMAN]: { type: String, default: '', maxlength: maxLength },
  [Language.ENGLISH]: { type: String, default: '', maxlength: maxLength },
  [Language.CHINESE]: { type: String, default: '', maxlength: maxLength },
});

const contactEntrySchema = new Schema<IContactEntry>(
  {
    category: { type: String, required: true, maxlength: 100 },
    title: localizedText(200),
    description: localizedText(1000),
    email: { type: String, required: true, maxlength: 320 },
    qrCode: { type: String, default: '', maxlength: 1000 },
    qrCodeOriginalFilename: { type: String, default: '', maxlength: 255 },
    qrExplanation: localizedText(300),
    externalLink: { type: String, default: '', maxlength: 1000 },
    externalLinkLabel: localizedText(200),
    isActive: { type: Boolean, default: true },
    order: { type: Number, default: 0, min: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

contactEntrySchema.index({ isActive: 1, order: 1, createdAt: 1 });

export const ContactEntry = model<IContactEntry>(
  'ContactEntry',
  contactEntrySchema
);
