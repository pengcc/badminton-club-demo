import type { Types } from 'mongoose';
import type { Domain } from '@club/shared-types/domain/match';
import type { BaseLineupPlayer } from '@club/shared-types/core/base';
import type { BaseDocument } from './base';
import type { LineupPosition } from '@club/shared-types/core/enums';

/**
 * Persistence layer types for Match
 * Converts Domain.Match to database-specific format
 */
export namespace Persistence {
  // We keep lineup players as embedded documents with string IDs
  // since they are a snapshot of the player data at match time
  export type LineupPlayers = Record<LineupPosition, BaseLineupPlayer[]>;

  // Database model type - extends BaseDocument and omits fields that BaseDocument provides
  export interface MatchDocument
    extends Omit<Domain.MatchCore, 'id' | 'createdAt' | 'updatedAt' | 'homeTeamId' | 'createdById'>,
            BaseDocument {
    homeTeamId: Types.ObjectId; // Convert string to ObjectId
    createdById: Types.ObjectId; // Convert string to ObjectId
    lineup: LineupPlayers; // Embedded documents
    unavailablePlayers: Types.ObjectId[]; // Convert string[] to ObjectId[]
  }
}

/**
 * Type guards for Match persistence layer
 */
export const isPersistenceMatch = (
  value: unknown
): value is Persistence.MatchDocument => {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_id' in value &&
    'createdAt' in value &&
    'updatedAt' in value &&
    'date' in value &&
    'time' in value &&
    'location' in value &&
    'status' in value &&
    'homeTeamId' in value &&
    'awayTeamName' in value &&
    'createdById' in value &&
    'lineup' in value &&
    typeof (value as any).lineup === 'object'
  );
};
