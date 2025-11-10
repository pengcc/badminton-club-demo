import { Schema, model, Document } from 'mongoose';
import { validationPlugin } from '../plugins/mongooseValidation';

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
  name: string;
  matchLevel?: string;
  createdById: Schema.Types.ObjectId;
}

/**
 * Team schema definition
 */
const teamSchema = new Schema<ITeam>({
  // Core attributes
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: [2, 'Team name too short'],
    maxlength: [50, 'Team name too long']
  },
  matchLevel: {
    type: String,
    trim: true,
    maxlength: [20, 'Match level too long']
  },

  // Relationships
  createdById: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
  // Note: playerIds removed - team roster computed from Player.teamIds
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Performance indexes
teamSchema.index({ name: 1 }, { unique: true });
teamSchema.index({ createdById: 1 });

// Apply validation plugin
teamSchema.plugin(validationPlugin);

export const Team = model<ITeam>('Team', teamSchema);