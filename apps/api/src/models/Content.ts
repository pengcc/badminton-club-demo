import { Schema, model } from 'mongoose';
import type { BaseDocument } from '../types/persistence/base';
import { validationPlugin } from '../plugins/mongooseValidation';
import { Language } from '@club/shared-types/core/enums';

/**
 * Content core attributes
 */
interface ContentAttributes {
  readonly key: string;
  readonly value: string;
  readonly language: Language;
  readonly updatedBy: Schema.Types.ObjectId;
}

/**
 * Extended attributes with populated fields
 */
interface PopulatedContent extends Omit<ContentAttributes, 'updatedBy'> {
  updatedBy: {
    _id: Schema.Types.ObjectId;
    name: string;
  };
}

/**
 * MongoDB document type with validation
 */
export interface IContent extends ContentAttributes, BaseDocument {
  populate(path: string, select?: string): Promise<this & { updatedBy: PopulatedContent['updatedBy'] }>;
  toView(): Promise<ContentView>;
}

/**
 * Content view model for frontend
 */
export interface ContentView {
  readonly id: string;
  readonly key: string;
  readonly value: string;
  readonly language: Language;
  readonly updatedAt: Date;
  readonly updatedBy: {
    readonly id: string;
    readonly name: string;
  };
}

/**
 * Content validation rules
 */
const contentValidationRules = {
  key: {
    required: true,
    minLength: 2,
    maxLength: 100
  },
  value: {
    required: true,
    maxLength: 10000
  },
  language: {
    required: true,
    custom: (value: unknown) => typeof value === 'string' && Object.values(Language).includes(value as Language)
  },
  updatedBy: {
    required: true
  }
} as const;

/**
 * Content schema definition
 */
const contentSchema = new Schema<IContent>({
  key: {
    type: String,
    required: contentValidationRules.key.required,
    minlength: [contentValidationRules.key.minLength, 'Key too short'],
    maxlength: [contentValidationRules.key.maxLength, 'Key too long']
  },
  value: {
    type: String,
    required: contentValidationRules.value.required,
    maxlength: [contentValidationRules.value.maxLength, 'Content too long']
  },
  language: {
    type: String,
    enum: Object.values(Language),
    required: contentValidationRules.language.required,
    default: Language.ENGLISH
  },
  updatedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: contentValidationRules.updatedBy.required
  }
}, {
  timestamps: true
});

// Compound index for unique content keys per language
contentSchema.index({ key: 1, language: 1 }, { unique: true });

/**
 * Convert to view model
 */
contentSchema.methods.toView = async function(this: IContent): Promise<ContentView> {
  const populated = await this.populate('updatedBy', 'name');

  return {
    id: populated._id.toString(),
    key: populated.key,
    value: populated.value,
    language: populated.language,
    updatedAt: populated.updatedAt,
    updatedBy: {
      id: populated.updatedBy._id.toString(),
      name: populated.updatedBy.name
    }
  };
};

// Apply validation plugin
contentSchema.plugin(validationPlugin);

// Export model
export const Content = model<IContent>('Content', contentSchema);