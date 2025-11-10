import { z } from 'zod';
import { personalInfoViewSchema, bankingInfoViewSchema } from '../view/membershipApplication';

/**
 * API request and response types for membership applications
 */

// Create membership application request
export interface CreateMembershipApplicationRequest {
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    gender: string;
    address: {
      street: string;
      city: string;
      postalCode: string;
      country: string;
    };
  };
  membershipType: 'regular' | 'student';
  hasConditions: boolean;
  conditions?: string;
  canParticipate: boolean;
  motivation?: string;
  bankingInfo?: {
    accountHolderType: 'same' | 'different';
    accountHolderFirstName: string;
    accountHolderLastName: string;
    accountHolderAddress: string;
    bankName: string;
    bic: string;
    iban: string;
    debitFrequency: 'quarterly' | 'annually';
  };
}

// Update membership application request
export interface UpdateMembershipApplicationRequest {
  status?: 'approved' | 'rejected';
  reviewNotes?: string;
}

// Response interfaces
export interface MembershipApplicationResponse {
  id: string;
  personalInfo: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dateOfBirth: string;
    gender: string;
    address: {
      street: string;
      city: string;
      postalCode: string;
      country: string;
    };
  };
  membershipType: string;
  hasConditions: boolean;
  conditions?: string;
  canParticipate: boolean;
  motivation?: string;
  bankingInfo?: {
    accountHolderType: 'same' | 'different';
    accountHolderFirstName: string;
    accountHolderLastName: string;
    accountHolderAddress: string;
    bankName: string;
    bic: string;
    iban: string;
    debitFrequency: 'quarterly' | 'annually';
  };
  status: 'pending' | 'approved' | 'rejected';
  documents: {
    application?: string;
    sepaMandate?: string;
  };
  reviewer?: string;
  reviewDate?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

// Validation schemas
export const createMembershipApplicationSchema = z.object({
  personalInfo: personalInfoViewSchema,
  membershipType: z.enum(['regular', 'student']),
  hasConditions: z.boolean(),
  conditions: z.string().optional(),
  canParticipate: z.boolean(),
  motivation: z.string().optional(),
  bankingInfo: bankingInfoViewSchema.optional()
}).strict();

export const updateMembershipApplicationSchema = z.object({
  status: z.enum(['approved', 'rejected']).optional(),
  reviewNotes: z.string().optional()
}).strict();

// Response schemas
export const membershipApplicationResponseSchema = z.object({
  id: z.string().uuid(),
  personalInfo: personalInfoViewSchema,
  membershipType: z.string(),
  hasConditions: z.boolean(),
  conditions: z.string().optional(),
  canParticipate: z.boolean(),
  motivation: z.string().optional(),
  bankingInfo: bankingInfoViewSchema.optional(),
  status: z.enum(['pending', 'approved', 'rejected']),
  documents: z.object({
    application: z.string().url().optional(),
    sepaMandate: z.string().url().optional()
  }),
  reviewer: z.string().optional(),
  reviewDate: z.string().datetime().optional(),
  reviewNotes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
}).strict();

// Type inference helpers
export type CreateMembershipApplicationRequestType = z.infer<typeof createMembershipApplicationSchema>;
export type UpdateMembershipApplicationRequestType = z.infer<typeof updateMembershipApplicationSchema>;
export type MembershipApplicationResponseType = z.infer<typeof membershipApplicationResponseSchema>;