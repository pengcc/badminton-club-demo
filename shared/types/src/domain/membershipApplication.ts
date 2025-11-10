import { z } from 'zod';
import { MembershipStatus } from '../core/enums';

/**
 * Core membership application domain types
 */
export namespace Domain {
  export interface Address {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  }

  export interface PersonalInfo {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    /**
     * Date of birth in YYYY-MM-DD format
     * @example "1990-01-15"
     */
    dateOfBirth: string;
    gender: string;
    address: Address;
  }

  export interface BankingInfo {
    accountHolderType: 'same' | 'different';
    accountHolderFirstName: string;
    accountHolderLastName: string;
    accountHolderAddress: string;
    bankName: string;
    bic: string;
    iban: string;
    debitFrequency: 'quarterly' | 'annually';
  }

  export interface MembershipApplication {
    id: string;
    personalInfo: PersonalInfo;
    membershipType: 'regular' | 'student';
    bankingInfo?: BankingInfo;
    canParticipate: boolean;
    motivation?: string;
    hasConditions: boolean;
    conditions?: string;
    status: MembershipStatus;
    documents: {
      application?: string;
      sepaMandate?: string;
    };
    reviewer?: string;
    reviewDate?: Date;
    reviewNotes?: string;
    createdAt: Date;
    updatedAt: Date;
  }
}

/**
 * Validation schemas for membership application
 */
const AddressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  postalCode: z.string().regex(/^\d{5}$/),
  country: z.string().min(1)
});

const PersonalInfoSchema = z.object({
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  email: z.email(),
  phone: z.string().regex(/^\+?[\d\s-()]+$/),
  // Stored and transported as YYYY-MM-DD string across backend layers
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.string().min(1),
  address: AddressSchema
});

const BankingInfoSchema = z.object({
  accountHolderType: z.enum(['same', 'different']),
  accountHolderFirstName: z.string().min(2).max(50),
  accountHolderLastName: z.string().min(2).max(50),
  accountHolderAddress: z.string().min(1),
  bankName: z.string().min(1),
  bic: z.string().regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/),
  iban: z.string().regex(/^DE\d{2}[0-9]{20}$/),
  debitFrequency: z.enum(['quarterly', 'annually'])
});

export const membershipApplicationSchema = z.object({
  id: z.string().uuid(),
  personalInfo: PersonalInfoSchema,
  membershipType: z.enum(['regular', 'student']),
  bankingInfo: BankingInfoSchema.optional(),
  canParticipate: z.boolean(),
  motivation: z.string().optional(),
  hasConditions: z.boolean(),
  conditions: z.string().optional(),
  status: z.enum(MembershipStatus),
  documents: z.object({
    application: z.string().optional(),
    sepaMandate: z.string().optional()
  }),
  reviewer: z.string().optional(),
  reviewDate: z.date().optional(),
  reviewNotes: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date()
}).strict();

/**
 * Type inference helpers
 */
export type PersonalInfo = z.infer<typeof PersonalInfoSchema>;
export type BankingInfo = z.infer<typeof BankingInfoSchema>;
export type MembershipApplication = z.infer<typeof membershipApplicationSchema>;