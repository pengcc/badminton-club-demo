import type { Types } from 'mongoose';
import type { Domain } from '@club/shared-types/domain/match';
import type { BaseDocument } from './base';
import type { MatchLineupEntry } from '@club/shared-types/domain/lineup';

export namespace Persistence {
  export interface MatchDocument
    extends Omit<
        Domain.MatchCore,
        'id' | 'version' | 'createdAt' | 'updatedAt' | 'teamId' | 'createdById'
      >,
      BaseDocument {
    __v: number;
    scheduleDuplicateKey: string;
    teamId: Types.ObjectId;
    createdById: Types.ObjectId;
    demoScratchLeaseId?: string;
    lineup: Array<
      Omit<MatchLineupEntry, 'playerId'> & {
        playerId: Types.ObjectId;
      }
    >;
    availability: Array<
      Omit<Domain.MatchAvailabilityEntry, 'playerId'> & {
        playerId: Types.ObjectId;
      }
    >;
  }
}

export const isPersistenceMatch = (
  value: unknown
): value is Persistence.MatchDocument => {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_id' in value &&
    '__v' in value &&
    'scheduleDuplicateKey' in value &&
    'createdAt' in value &&
    'updatedAt' in value &&
    'teamId' in value &&
    'opponentName' in value &&
    'direction' in value &&
    'startAt' in value &&
    'createdById' in value &&
    'lineup' in value &&
    'availability' in value
  );
};
