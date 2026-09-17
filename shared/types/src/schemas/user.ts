/**
 * User Validation Schemas
 *
 * Zod schemas for user-related validation
 * Shared between frontend and backend for consistent validation
 */

import { z } from 'zod';
import { Gender, MemberListFilter, MembershipStatus } from '../core/enums';
import {
  germanAddressSchema,
  optionalPersonPhoneSchema,
  personDateOfBirthSchema,
  personNameSchema,
} from '../domain/personProfile';

/**
 * Email validation schema
 */
export const emailSchema = z
  .string()
  .email('Invalid email address')
  .min(1, 'Email is required')
  .max(255, 'Email must be less than 255 characters');

/**
 * Password validation schema
 * - At least 8 characters
 * - Contains uppercase and lowercase
 * - Contains at least one number
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/\d/, 'Password must contain at least one number');

/**
 * Name validation schema (first name, last name)
 */
export const nameSchema = personNameSchema;

/**
 * Phone number validation schema (German format)
 */
export const phoneSchema = optionalPersonPhoneSchema;

/**
 * Date of birth validation schema
 */
export const dateOfBirthSchema = personDateOfBirthSchema;

/**
 * Address validation schema
 */
export const addressSchema = germanAddressSchema;

/**
 * Update user schema (updating existing user)
 */
export const updateUserSchema = z
  .object({
    firstName: nameSchema.optional(),
    lastName: nameSchema.optional(),
    phone: z.union([phoneSchema, z.null()]).optional(),
    dateOfBirth: dateOfBirthSchema.optional(),
    gender: z.nativeEnum(Gender).optional(),
    administratorDesignation: z.never().optional(),
    membershipStatus: z.never().optional(),
    isPlayer: z.never().optional(),
    address: z.union([addressSchema, z.null()]).optional(),
  })
  .strict();

export const administratorDesignationSchema = z
  .object({
    designated: z.boolean(),
  })
  .strict();

export const activePassiveMembershipTransitionSchema = z
  .object({
    targetStatus: z.union([
      z.literal(MembershipStatus.ACTIVE),
      z.literal(MembershipStatus.PASSIVE),
    ]),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export type ActivePassiveMembershipTransitionInput = z.infer<
  typeof activePassiveMembershipTransitionSchema
>;

export const suspendAccountSchema = z
  .object({
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();

export type SuspendAccountInput = z.infer<typeof suspendAccountSchema>;

export const accountDeletionSchema = z
  .object({
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export type AccountDeletionInput = z.infer<typeof accountDeletionSchema>;

/**
 * User login schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

/**
 * Password reset request schema
 */
export const passwordResetRequestSchema = z.object({
  email: emailSchema,
});

/**
 * Password reset schema
 */
export const passwordResetSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * Email change request schema
 */
export const emailChangeRequestSchema = z
  .object({
    newEmail: emailSchema,
    locale: z.enum(['de', 'en', 'zh']),
  })
  .strict();

/**
 * Membership projection query for the administrative member list.
 */
export const memberListQuerySchema = z.object({
  filter: z.nativeEnum(MemberListFilter).default(MemberListFilter.CURRENT),
  gender: z.union([z.nativeEnum(Gender), z.literal('missing')]).optional(),
  administratorOnly: z
    .preprocess((value) => {
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    }, z.boolean())
    .optional(),
  search: z.string().trim().max(100).optional(),
  page: z
    .preprocess(
      (value) => (value === '' ? undefined : value),
      z.coerce.number().int().positive()
    )
    .default(1),
  pageSize: z
    .preprocess(
      (value) => (value === '' ? undefined : value),
      z.coerce.number().int().positive().max(100)
    )
    .default(20),
});

export const memberExportQuerySchema = z
  .object({
    cohort: z.enum(['current', 'all']),
  })
  .strict();

// Type exports for TypeScript
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PasswordResetRequestInput = z.infer<
  typeof passwordResetRequestSchema
>;
export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
export type EmailChangeRequestInput = z.infer<typeof emailChangeRequestSchema>;
export type MemberListQueryInput = z.infer<typeof memberListQuerySchema>;
export type MemberExportQueryInput = z.infer<typeof memberExportQuerySchema>;
