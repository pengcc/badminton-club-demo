// apps/api/src/models/Match.ts
import { Schema, model, Document } from 'mongoose';
import { LineupPosition, MatchStatus } from '@club/shared-types/core/enums';
import { validationPlugin } from '../plugins/mongooseValidation';

/**
 * MongoDB document interface for Match
 * Structure aligns with Persistence.MatchDocument from @club/shared-types/persistence/match
 *
 * Note: We define the interface locally (not imported) because:
 * 1. Mongoose requires extending Document for instance methods
 * 2. TypeScript needs the full definition at compile time
 * 3. The transformers handle conversion between this and Persistence/Domain types
 *
 * The MatchPersistenceTransformer converts between this model and Domain.Match
 */
export interface IMatch extends Document {
  date: Date;
  time: string;
  location: string;
  status: MatchStatus;
  homeTeamId: Schema.Types.ObjectId;
  awayTeamName: string;
  createdById: Schema.Types.ObjectId;
  scores?: {
    homeScore: number;
    awayScore: number;
  };
  cancellationReason?: string;
  lineup: Map<LineupPosition, Schema.Types.ObjectId[]>; // Array to support doubles/mixed
  unavailablePlayers: Schema.Types.ObjectId[];
}

/**
 * Create schema with validation rules from shared types
 */
const matchSchema = new Schema<IMatch>({
  // Core attributes
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true,
    validate: {
      validator: (v: string) => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v),
      message: 'Invalid time format (HH:MM)'
    }
  },
  location: {
    type: String,
    required: true,
    minlength: [2, 'Location too short'],
    maxlength: [100, 'Location too long']
  },
  status: {
    type: String,
    enum: Object.values(MatchStatus),
    required: true,
    default: MatchStatus.SCHEDULED
  },
  awayTeamName: {
    type: String,
    required: true,
    minlength: [2, 'Team name too short'],
    maxlength: [50, 'Team name too long']
  },
  scores: {
    homeScore: { type: Number, min: 0 },
    awayScore: { type: Number, min: 0 }
  },
  cancellationReason: {
    type: String,
    maxlength: [500, 'Cancellation reason too long']
  },

  // Relationships and references
  homeTeamId: {
    type: Schema.Types.ObjectId,
    ref: 'Team',
    required: true
  },
  lineup: {
    type: Map,
    of: [{
      type: Schema.Types.ObjectId,
      ref: 'Player'
    }],
    default: () => new Map(),
    validate: {
      validator: function(lineup: Map<string, any>) {
        return Array.from(lineup.keys()).every(pos =>
          Object.values(LineupPosition).includes(pos as LineupPosition)
        );
      },
      message: 'Invalid lineup position'
    }
  },
  unavailablePlayers: [{
    type: Schema.Types.ObjectId,
    ref: 'Player'
  }],
  createdById: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Performance indexes
matchSchema.index({ date: 1 });
matchSchema.index({ homeTeamId: 1 });
matchSchema.index({ status: 1 });
matchSchema.index({ createdById: 1 });

// Virtual fields for player availability (kept for potential future use)
matchSchema.virtual('availablePlayers', {
  ref: 'Player',
  localField: 'homeTeamId',
  foreignField: 'teamAffiliations',
  match: function(this: IMatch) {
    return {
      isActivePlayer: true,
      _id: { $nin: this.unavailablePlayers }
    };
  }
});

// Apply validation plugin
matchSchema.plugin(validationPlugin);

export const Match = model<IMatch>('Match', matchSchema);