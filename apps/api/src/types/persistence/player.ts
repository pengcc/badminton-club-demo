import type { Types } from 'mongoose';
import type { Domain } from '@club/shared-types/domain/player';
import type { BaseDocument } from './base';

/**
 * Persistence layer types for Player
 * Converts Domain.Player to database-specific format
 *
 * Player is a separate entity linked to User via userId.
 * matchIds field is COMPUTED from Match.lineup (not stored in database).
 */
export namespace Persistence {
  // Database model type - extends BaseDocument and omits fields that BaseDocument provides
  // NO matchIds field - it's computed from Match.lineup aggregation
  export interface PlayerDocument
    extends Omit<Domain.Player, 'id' | 'userId' | 'teamIds' | 'matchIds' | 'createdAt' | 'updatedAt'>,
            BaseDocument {
    userId: Types.ObjectId;      // Reference to User
    teamIds: Types.ObjectId[];   // Stored team relationships
    // matchIds NOT stored - computed from Match collection
  }
}

/**
 * Type guards for Player persistence layer
 */
export const isPersistencePlayer = (
  value: unknown
): value is Persistence.PlayerDocument => {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_id' in value &&
    'createdAt' in value &&
    'updatedAt' in value &&
    'userId' in value &&
    'isActivePlayer' in value &&
    'preferredPositions' in value &&
    'teamIds' in value
  );
};
