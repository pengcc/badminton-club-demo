import { Types } from 'mongoose';
import { Domain } from '@club/shared-types/domain/user';
import { BaseDocument } from './base';

/**
 * Persistence layer types for User
 * Converts Domain.User to database-specific format
 */
export namespace Persistence {
  // Database model type - extends BaseDocument and omits fields that BaseDocument provides
  export interface UserDocument
    extends Omit<Domain.UserCore, 'id' | 'createdAt' | 'updatedAt'>,
            BaseDocument {}
}

/**
 * Type guards for User persistence layer
 */
export const isPersistenceUser = (
  value: unknown
): value is Persistence.UserDocument => {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_id' in value &&
    'createdAt' in value &&
    'updatedAt' in value &&
    'email' in value &&
    'name' in value &&
    'gender' in value &&
    'role' in value &&
    'membershipStatus' in value &&
    'isPlayer' in value &&
    'dateOfBirth' in value
  );
};
