import type { Types } from 'mongoose';
import type { Domain } from '@club/shared-types/domain/team';
import type { BaseDocument } from './base';

/**
 * Persistence layer types for Team
 * Converts Domain.Team to database-specific format
 */
export namespace Persistence {
  // Database model type - extends BaseDocument and omits fields that BaseDocument provides
  export interface TeamDocument
    extends Omit<Domain.TeamCore, 'id' | 'createdAt' | 'updatedAt' | 'createdById'>,
            BaseDocument {
    createdById: Types.ObjectId; // Convert string to ObjectId
    playerIds: Types.ObjectId[]; // Convert string[] to ObjectId[]
  }
}

/**
 * Type guards for Team persistence layer
 */
export const isPersistenceTeam = (
  value: unknown
): value is Persistence.TeamDocument => {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_id' in value &&
    'createdAt' in value &&
    'updatedAt' in value &&
    'name' in value &&
    'matchLevel' in value &&
    'playerIds' in value &&
    'createdById' in value &&
    Array.isArray((value as any).playerIds)
  );
};
