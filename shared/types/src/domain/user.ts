import { z } from 'zod';
import {
  AccountOnboardingStatus,
  AccountKind,
  Gender,
  MembershipStatus,
} from '../core/enums';
import {
  germanAddressSchema,
  optionalPersonPhoneSchema,
  personDateOfBirthSchema,
  personNameSchema,
} from './personProfile';

export interface AccountSuspension<TTimestamp = Date> {
  reason: string;
  suspendedAt: TTimestamp;
  suspendedBy: string;
}

/**
 * Core user domain types - pure business logic without infrastructure concerns
 *
 * Player is a SEPARATE entity linked to User via userId.
 * User.isPlayer is retained as a legacy read model only. Player existence and
 * Player.isActivePlayer are the authoritative sporting identity/eligibility
 * facts.
 */
export namespace Domain {
  interface UserCoreBase {
    id: string; // Standard field - unique identifier
    email: string;
    accountOnboardingStatus: AccountOnboardingStatus;
    createdAt: Date; // Standard field - audit timestamp
    updatedAt: Date; // Standard field - audit timestamp
  }

  export interface PersonUserCore extends UserCoreBase {
    accountKind: AccountKind.PERSON;
    firstName: string;
    lastName: string;
    phone?: string;
    gender: Gender;
    dateOfBirth: string;
    administratorDesignation: boolean;
    membershipStatus: MembershipStatus;
    accountSuspension?: AccountSuspension;
    readonly isPlayer: boolean; // @deprecated compatibility projection
    address?: {
      street: string;
      city: string;
      postalCode: string;
      country: string;
    };
  }

  export interface SuperAdminUserCore extends UserCoreBase {
    accountKind: AccountKind.SUPER_ADMIN;
    administratorDesignation: false;
    readonly isPlayer: false;
    firstName?: never;
    lastName?: never;
    phone?: never;
    gender?: never;
    dateOfBirth?: never;
    membershipStatus?: never;
    accountSuspension?: never;
    address?: never;
  }

  export type UserCore = PersonUserCore | SuperAdminUserCore;
  export type User = UserCore;
}

/**
 * User validation schemas with business rule enforcement
 */
const addressSchema = germanAddressSchema;

const userCoreBaseSchema = z.object({
  id: z.string(),
  email: z.email(),
  accountOnboardingStatus: z.enum(AccountOnboardingStatus),
  createdAt: z.date(),
  updatedAt: z.date(),
});

const personUserCoreSchema = userCoreBaseSchema.extend({
  accountKind: z.literal(AccountKind.PERSON),
  firstName: personNameSchema,
  lastName: personNameSchema,
  phone: optionalPersonPhoneSchema,
  gender: z.enum(Gender),
  dateOfBirth: personDateOfBirthSchema,
  administratorDesignation: z.boolean(),
  membershipStatus: z.enum(MembershipStatus),
  accountSuspension: z
    .object({
      reason: z.string().trim().min(1),
      suspendedAt: z.date(),
      suspendedBy: z.string().min(1),
    })
    .optional(),
  isPlayer: z.boolean(),
  address: addressSchema.optional(),
});

const superAdminUserCoreSchema = userCoreBaseSchema.extend({
  accountKind: z.literal(AccountKind.SUPER_ADMIN),
  administratorDesignation: z.literal(false),
  isPlayer: z.literal(false),
  firstName: z.never().optional(),
  lastName: z.never().optional(),
  phone: z.never().optional(),
  gender: z.never().optional(),
  dateOfBirth: z.never().optional(),
  membershipStatus: z.never().optional(),
  accountSuspension: z.never().optional(),
  address: z.never().optional(),
});

const canonicalUserSchema = z.discriminatedUnion('accountKind', [
  personUserCoreSchema,
  superAdminUserCoreSchema,
]);

export const UserSchema = {
  address: addressSchema,
  core: canonicalUserSchema,
  user: canonicalUserSchema,
};

/**
 * Type inference helpers
 */
export type UserCore = z.infer<typeof UserSchema.core>;
export type User = z.infer<typeof UserSchema.user>;
