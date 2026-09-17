import type { Document } from 'mongoose';
import { Schema, model } from 'mongoose';
import { validationPlugin } from '../plugins/mongooseValidation';
import { TeamLevel } from '@club/shared-types/core/enums';

/**
 * MongoDB document interface for Team
 * Structure aligns with Persistence.TeamDocument from @club/shared-types/persistence/team
 *
 * Note: We define the interface locally because:
 * 1. Mongoose requires extending Document for instance methods
 * 2. TypeScript needs the full definition at compile time
 * 3. The TeamPersistenceTransformer handles conversion to/from Domain.Team
 *
 * UNIDIRECTIONAL RELATIONSHIP:
 * - Team roster is computed from Player.teamIds (single source of truth)
 * - No playerIds field stored in Team documents
 */
export interface ITeam extends Document {
  teamId: string;
  shortName: string;
  leagueTeamName: string;
  matchLevel: TeamLevel;
  createdById: Schema.Types.ObjectId;
}

/**
 * Team schema definition
 */
const teamSchema = new Schema<ITeam>(
  {
    // Core attributes
    teamId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: [10, 'Team ID too long'],
      validate: {
        validator: (v: string) => /^[a-z0-9]+$/.test(v),
        message: 'Team ID must be lowercase alphanumeric',
      },
    },
    shortName: {
      type: String,
      required: true,
      trim: true,
      minlength: [2, 'Short name too short'],
      maxlength: [50, 'Short name too long'],
    },
    leagueTeamName: {
      type: String,
      required: true,
      trim: true,
      maxlength: [100, 'League team name too long'],
    },
    matchLevel: {
      type: String,
      required: true,
      enum: Object.values(TeamLevel),
      trim: true,
    },

    // Relationships
    createdById: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Note: playerIds removed - team roster computed from Player.teamIds
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Performance indexes
teamSchema.index({ leagueTeamName: 1 });
teamSchema.index({ createdById: 1 });

// Apply validation plugin
teamSchema.plugin(validationPlugin);

export const Team = model<ITeam>('Team', teamSchema);
