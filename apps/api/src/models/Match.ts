import type { Document, Types } from 'mongoose';
import { Schema, model } from 'mongoose';
import {
  LineupPosition,
  MatchAvailabilityParticipation,
  MatchDirection,
} from '@club/shared-types/core/enums';
import {
  MATCH_ARRIVAL_GUIDANCE_MAX_LENGTH,
  MATCH_RESULT_NOTE_MAX_LENGTH,
} from '@club/shared-types/api/match';
import { validationPlugin } from '../plugins/mongooseValidation';

export interface IMatch extends Document {
  __v: number;
  scheduleDuplicateKey: string;
  teamId: Types.ObjectId;
  opponentName: string;
  direction: MatchDirection;
  startAt: Date;
  location: string;
  arrivalGuidance?: string;
  result?: {
    homeScore: number;
    awayScore: number;
    note?: string;
  };
  lineup: Array<{
    position: LineupPosition;
    playerId: Types.ObjectId;
    playerNameSnapshot: string;
  }>;
  availability: Array<{
    playerId: Types.ObjectId;
    participation: MatchAvailabilityParticipation;
  }>;
  createdById: Types.ObjectId;
  demoScratchLeaseId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const resultSchema = new Schema(
  {
    homeScore: {
      type: Number,
      min: 0,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: 'Home score must be an integer',
      },
    },
    awayScore: {
      type: Number,
      min: 0,
      required: true,
      validate: {
        validator: Number.isInteger,
        message: 'Away score must be an integer',
      },
    },
    note: {
      type: String,
      maxlength: MATCH_RESULT_NOTE_MAX_LENGTH,
    },
  },
  { _id: false }
);

const availabilityEntrySchema = new Schema(
  {
    playerId: {
      type: Schema.Types.ObjectId,
      ref: 'Player',
      required: true,
    },
    participation: {
      type: String,
      enum: Object.values(MatchAvailabilityParticipation),
      required: true,
    },
  },
  { _id: false }
);

const lineupEntrySchema = new Schema(
  {
    position: {
      type: String,
      enum: Object.values(LineupPosition),
      required: true,
    },
    playerId: {
      type: Schema.Types.ObjectId,
      ref: 'Player',
      required: true,
    },
    playerNameSnapshot: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
    },
  },
  { _id: false }
);

const matchSchema = new Schema<IMatch>(
  {
    scheduleDuplicateKey: {
      type: String,
      required: true,
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    opponentName: {
      type: String,
      required: true,
      minlength: [1, 'Opponent name is required'],
      maxlength: [100, 'Opponent name too long'],
      trim: true,
    },
    direction: {
      type: String,
      enum: Object.values(MatchDirection),
      required: true,
    },
    startAt: {
      type: Date,
      required: true,
    },
    location: {
      type: String,
      required: true,
      minlength: [2, 'Location too short'],
      maxlength: [100, 'Location too long'],
      trim: true,
    },
    arrivalGuidance: {
      type: String,
      maxlength: MATCH_ARRIVAL_GUIDANCE_MAX_LENGTH,
      trim: true,
      required: false,
    },
    result: {
      type: resultSchema,
      required: false,
      default: undefined,
    },
    lineup: {
      type: [lineupEntrySchema],
      default: [],
    },
    availability: {
      type: [availabilityEntrySchema],
      default: [],
      validate: {
        validator: (
          entries: Array<{
            playerId: Types.ObjectId;
          }>
        ) => {
          const ids = entries.map((entry) => entry.playerId.toString());
          return ids.length === new Set(ids).size;
        },
        message: 'Availability may contain only one entry per Player',
      },
    },
    createdById: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    demoScratchLeaseId: {
      type: String,
      required: false,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

matchSchema.index({ startAt: 1, _id: 1 });
matchSchema.index({ teamId: 1, startAt: 1, _id: 1 });
matchSchema.index(
  { scheduleDuplicateKey: 1 },
  { unique: true, name: 'unique_match_schedule_duplicate_key' }
);
matchSchema.index(
  { demoScratchLeaseId: 1 },
  {
    unique: true,
    partialFilterExpression: { demoScratchLeaseId: { $type: 'string' } },
    name: 'unique_demo_match_per_lease',
  }
);

matchSchema.plugin(validationPlugin);

export const Match = model<IMatch>('Match', matchSchema);
