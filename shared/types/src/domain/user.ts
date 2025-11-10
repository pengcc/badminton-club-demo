import { z } from 'zod';
import { Gender, UserRole, MembershipStatus } from '../core/enums';

/**
 * Core user domain types - pure business logic without infrastructure concerns
 *
 * Player is a SEPARATE entity linked to User via userId.
 * User.isPlayer flag controls Player entity lifecycle:
 * - isPlayer: true → Creates Player entity
 * - isPlayer: false → Deletes Player entity
 */
export namespace Domain {
  export interface UserCore {
    id: string; // Standard field - unique identifier
    email: string;
    firstName: string; // Given name
    lastName: string; // Family name
    phone?: string;
    gender: Gender;
    dateOfBirth: string;
    role: UserRole;
    membershipStatus: MembershipStatus;
    isPlayer: boolean; // Flag to control Player entity lifecycle
    address?: {
      street: string;
      city: string;
      postalCode: string;
      country: string;
    };
    createdAt: Date; // Standard field - audit timestamp
    updatedAt: Date; // Standard field - audit timestamp
  }

  export type User = UserCore;
}

/**
 * User validation schemas with business rule enforcement
 */
export const UserSchema = {
  address: z.object({
    street: z.string(),
    city: z.string(),
    postalCode: z.string(),
    country: z.string()
  }),

  core: z.object({
    id: z.string(),
    email: z.email(),
    firstName: z.string().min(2, 'First name must be at least 2 characters').max(50, 'First name cannot exceed 50 characters'),
    lastName: z.string().min(2, 'Last name must be at least 2 characters').max(50, 'Last name cannot exceed 50 characters'),
    name: z.string().min(2).max(100).optional(), // @deprecated
    phone: z.string().optional(),
    gender: z.enum(Gender),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    role: z.enum(UserRole),
    membershipStatus: z.enum(MembershipStatus),
    isPlayer: z.boolean(),
    address: z.object({
      street: z.string(),
      city: z.string(),
      postalCode: z.string(),
      country: z.string()
    }).optional(),
    createdAt: z.date(),
    updatedAt: z.date()
  }).refine(
    (data) => {
      // Only members and guest players can be players
      if (data.isPlayer) {
        return [UserRole.MEMBER, UserRole.GUEST_PLAYER].includes(data.role);
      }
      return true;
    },
    { message: 'Only members and guest players can be players', path: ['isPlayer'] }
  ),

  // Combined schema with business rules
  user: z.object({
    id: z.string(),
    email: z.email(),
    name: z.string().min(2).max(100),
    phone: z.string().optional(),
    gender: z.enum(Gender),
    dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    role: z.enum(UserRole),
    membershipStatus: z.enum(MembershipStatus),
    isPlayer: z.boolean(),
    address: z.object({
      street: z.string(),
      city: z.string(),
      postalCode: z.string(),
      country: z.string()
    }).optional(),
    createdAt: z.date(),
    updatedAt: z.date()
  }).refine(
    (data) => {
      // Only members and guest players can be players
      if (data.isPlayer) {
        return [UserRole.MEMBER, UserRole.GUEST_PLAYER].includes(data.role);
      }
      return true;
    },
    { message: 'Only members and guest players can be players', path: ['isPlayer'] }
  )
};

/**
 * Type inference helpers
 */
export type UserCore = z.infer<typeof UserSchema.core>;
export type User = z.infer<typeof UserSchema.user>;