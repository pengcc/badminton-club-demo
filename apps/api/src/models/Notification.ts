import { Schema, model } from 'mongoose';
import type { BaseDocument } from '../types/persistence/base';
import { validationPlugin } from '../plugins/mongooseValidation';

/**
 * Notification core attributes
 */
interface NotificationAttributes {
  readonly title: string;
  readonly message: string;
  isActive: boolean;
  readonly startDate: Date;
  readonly endDate?: Date;
  readonly createdBy: Schema.Types.ObjectId;
}

/**
 * Extended attributes with populated fields
 */
interface PopulatedNotification extends Omit<NotificationAttributes, 'createdBy'> {
  createdBy: {
    _id: Schema.Types.ObjectId;
    name: string;
  };
}

/**
 * MongoDB document type with validation
 */
export interface INotification extends NotificationAttributes, BaseDocument {
  populate(path: string, select?: string): Promise<this & { createdBy: PopulatedNotification['createdBy'] }>;
  toView(): Promise<NotificationView>;
}

/**
 * Notification view model for frontend
 */
export interface NotificationView {
  readonly id: string;
  readonly title: string;
  readonly message: string;
  readonly isActive: boolean;
  readonly startDate: Date;
  readonly endDate?: Date;
  readonly createdAt: Date;
  readonly createdBy: {
    readonly id: string;
    readonly name: string;
  };
}

/**
 * Notification validation rules
 */
const notificationValidationRules = {
  title: {
    required: true,
    minLength: 3,
    maxLength: 100
  },
  message: {
    required: true,
    minLength: 10,
    maxLength: 500
  },
  isActive: {
    required: true
  },
  startDate: {
    required: true,
    custom: (value: unknown) => value instanceof Date && value >= new Date()
  },
  endDate: {
    custom: (value: unknown) => !value || (value instanceof Date && value > new Date())
  },
  createdBy: {
    required: true
  }
} as const;

/**
 * Notification schema definition
 */
const notificationSchema = new Schema<INotification>({
  title: {
    type: String,
    required: notificationValidationRules.title.required,
    minlength: [notificationValidationRules.title.minLength, 'Title too short'],
    maxlength: [notificationValidationRules.title.maxLength, 'Title too long']
  },
  message: {
    type: String,
    required: notificationValidationRules.message.required,
    minlength: [notificationValidationRules.message.minLength, 'Message too short'],
    maxlength: [notificationValidationRules.message.maxLength, 'Message too long']
  },
  isActive: {
    type: Boolean,
    default: true,
    required: notificationValidationRules.isActive.required
  },
  startDate: {
    type: Date,
    required: notificationValidationRules.startDate.required,
    default: Date.now,
    validate: [
      {
        validator: (v: Date) => notificationValidationRules.startDate.custom?.(v) ?? true,
        message: 'Start date must be in the future'
      }
    ]
  },
  endDate: {
    type: Date,
    validate: [
      {
        validator: (v: Date) => notificationValidationRules.endDate.custom?.(v) ?? true,
        message: 'End date must be in the future'
      }
    ]
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: notificationValidationRules.createdBy.required
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
notificationSchema.index({ isActive: 1 });
notificationSchema.index({ startDate: 1, endDate: 1 });

/**
 * Convert to view model
 */
notificationSchema.methods.toView = async function(this: INotification): Promise<NotificationView> {
  const populated = await this.populate('createdBy', 'name');

  return {
    id: populated._id.toString(),
    title: populated.title,
    message: populated.message,
    isActive: populated.isActive,
    startDate: populated.startDate,
    endDate: populated.endDate,
    createdAt: populated.createdAt,
    createdBy: {
      id: populated.createdBy._id.toString(),
      name: populated.createdBy.name
    }
  };
};

// Apply validation plugin
notificationSchema.plugin(validationPlugin);

// Export model
export const Notification = model<INotification>('Notification', notificationSchema);