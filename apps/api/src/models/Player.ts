import { Schema, model, Document } from 'mongoose';
import { PlayerPosition } from '@club/shared-types/core/enums';
import { Persistence } from '../types/persistence/player';

/**
 * MongoDB document interface for Player entity
 * Player is a separate entity linked to User via userId
 * User fields (name, email) are NOT stored on Player - populated from User
 */
export interface IPlayer extends Document {
  _id: Schema.Types.ObjectId;
  userId: Schema.Types.ObjectId;
  singlesRanking: number;
  doublesRanking: number;
  preferredPositions: PlayerPosition[];
  isActivePlayer: boolean;
  teamIds: Schema.Types.ObjectId[];
  // matchIds is NOT stored - computed from Match.lineup
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Player schema definition
 * Minimal schema - user data comes from User reference
 */
const playerSchema = new Schema<IPlayer>({
  // Reference to User entity
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Player-specific sports data
  singlesRanking: {
    type: Number,
    default: 0,
    min: [0, 'Singles ranking must be at least 0'],
    max: [5000, 'Singles ranking cannot exceed 5000']
  },
  doublesRanking: {
    type: Number,
    default: 0,
    min: [0, 'Doubles ranking must be at least 0'],
    max: [5000, 'Doubles ranking cannot exceed 5000']
  },
  preferredPositions: [{
    type: String,
    enum: Object.values(PlayerPosition),
    validate: {
      validator: function(v: string): boolean {
        return Object.values(PlayerPosition).includes(v as PlayerPosition);
      },
      message: 'Invalid preferred position'
    }
  }],
  isActivePlayer: {
    type: Boolean,
    default: true,
    required: true
  },

  // Relationships
  teamIds: [{
    type: Schema.Types.ObjectId,
    ref: 'Team'
  }]
  // Note: matchIds is NOT stored - computed from Match.lineup
}, {
  timestamps: true,
  toJSON: { virtuals: false },
  toObject: { virtuals: false }
});


// Indexes for efficient queries
playerSchema.index({ userId: 1 }, { unique: true });
playerSchema.index({ isActivePlayer: 1 });
playerSchema.index({ teamIds: 1 });
playerSchema.index({ singlesRanking: -1 }); // Descending for leaderboard
playerSchema.index({ doublesRanking: -1 }); // Descending for leaderboard

// Export the model
export const Player = model<IPlayer>('Player', playerSchema);
