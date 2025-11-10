import { z } from 'zod';
import type { Types } from 'mongoose';
import type { BaseDocument } from './base';
import type { Domain} from '@club/shared-types/domain/membershipApplication';
import { membershipApplicationSchema } from '@club/shared-types/domain/membershipApplication';
import { MembershipStatus } from '@club/shared-types/core/enums';

/**
 * Persistence layer types for membership applications
 * Extended from domain types with MongoDB specific fields
 * _id, createdAt, updatedAt inherited from BaseDocument
 */
export interface MembershipApplicationPersistence
  extends Omit<Domain.MembershipApplication, 'id' | 'createdAt' | 'updatedAt'>,
          BaseDocument {
}

/**
 * Persistence layer validation schema
 * Based on domain schema with MongoDB specific adjustments
 */
export const membershipApplicationPersistenceSchema = membershipApplicationSchema
  .omit({ id: true })
  .extend({
    _id: z.custom<Types.ObjectId>(),
    status: z.enum(MembershipStatus)
  })
  .strict();

/**
 * Type inference helper
 */
export type MembershipApplicationPersistenceType = z.infer<typeof membershipApplicationPersistenceSchema>;
