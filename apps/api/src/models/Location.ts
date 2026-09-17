import type { Document, Types } from 'mongoose';
import { Schema, model } from 'mongoose';
import type { LocationTimeSlot } from '@club/shared-types/api/location';
import {
  LOCATION_TASTER_SESSION_LEVELS,
  LOCATION_WEEKDAYS,
} from '@club/shared-types/api/location';
import { Language } from '@club/shared-types/core/enums';

/**
 * Location Model
 *
 * Manages training venue information with multi-language support.
 */

export interface ILocationTranslation {
  name: string;
  address: string;
}

export interface ILocation extends Document {
  // Multi-language content
  translations: {
    [Language.GERMAN]: ILocationTranslation;
    [Language.ENGLISH]: ILocationTranslation;
    [Language.CHINESE]: ILocationTranslation;
  };

  // Canonical recurring weekly play times
  timeSlots: LocationTimeSlot[];

  // Image URL
  imageUrl: string;

  // Display order
  order: number;

  // Visibility toggle
  isActive: boolean;

  // Audit fields
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const locationTranslationSchema = new Schema<ILocationTranslation>(
  {
    name: {
      type: String,
      maxlength: [200, 'Name too long'],
    },
    address: {
      type: String,
      maxlength: [500, 'Address too long'],
    },
  },
  { _id: false }
);

const localizedNoteSchema = new Schema(
  {
    [Language.GERMAN]: {
      type: String,
      maxlength: [500, 'German note too long'],
    },
    [Language.ENGLISH]: {
      type: String,
      maxlength: [500, 'English note too long'],
    },
    [Language.CHINESE]: {
      type: String,
      maxlength: [500, 'Chinese note too long'],
    },
  },
  { _id: false }
);

const timeSlotSchema = new Schema<LocationTimeSlot>(
  {
    id: {
      type: String,
      required: true,
    },
    weekday: {
      type: String,
      required: true,
      enum: LOCATION_WEEKDAYS,
    },
    startTime: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must use HH:mm format'],
    },
    endTime: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'End time must use HH:mm format'],
    },
    active: {
      type: Boolean,
      required: true,
    },
    guestPlayEnabled: {
      type: Boolean,
      required: true,
      default: true,
    },
    tasterSessionEnabled: {
      type: Boolean,
      required: true,
      default: true,
    },
    tasterSessionAcceptedLevels: {
      type: [String],
      enum: LOCATION_TASTER_SESSION_LEVELS,
      required: true,
      default: () => [...LOCATION_TASTER_SESSION_LEVELS],
    },
    note: {
      type: localizedNoteSchema,
      required: false,
    },
  },
  { _id: false }
);

const locationSchema = new Schema<ILocation>(
  {
    translations: {
      [Language.GERMAN]: {
        type: locationTranslationSchema,
        required: true,
      },
      [Language.ENGLISH]: {
        type: locationTranslationSchema,
        required: true,
      },
      [Language.CHINESE]: {
        type: locationTranslationSchema,
        required: true,
      },
    },
    timeSlots: {
      type: [timeSlotSchema],
      default: [],
    },
    imageUrl: {
      type: String,
      default: '',
    },
    order: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying
locationSchema.index({ isActive: 1, order: 1 });

locationSchema.pre('validate', function validateTimeSlots() {
  const ids = new Set<string>();

  this.timeSlots.forEach((slot, index) => {
    if (ids.has(slot.id)) {
      this.invalidate(
        `timeSlots.${index}.id`,
        'Time slot ids must be unique within a location'
      );
    }
    ids.add(slot.id);

    if (slot.endTime <= slot.startTime) {
      this.invalidate(
        `timeSlots.${index}.endTime`,
        'End time must be after start time'
      );
    }

    const acceptedLevels = slot.tasterSessionAcceptedLevels ?? [];
    if (new Set(acceptedLevels).size !== acceptedLevels.length) {
      this.invalidate(
        `timeSlots.${index}.tasterSessionAcceptedLevels`,
        'Taster Session accepted levels must not contain duplicates'
      );
    }
    if ((slot.tasterSessionEnabled ?? true) && acceptedLevels.length === 0) {
      this.invalidate(
        `timeSlots.${index}.tasterSessionAcceptedLevels`,
        'An enabled Taster Session time must accept at least one level'
      );
    }
  });
});

export const Location = model<ILocation>('Location', locationSchema);
