import { z } from 'zod';
import { MembershipStatus } from '../core/enums';

// View layer interfaces
export interface AddressView {
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface PersonalInfoView {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  address: AddressView;
}

export interface BankingInfoView {
  accountHolderType: 'same' | 'different';
  accountHolderFirstName: string;
  accountHolderLastName: string;
  accountHolderAddress: string;
  bankName: string;
  bic: string;
  iban: string;
  debitFrequency: 'quarterly' | 'annually';
}

export interface MembershipApplicationView {
  id: string;
  personalInfo: PersonalInfoView;
  membershipType: 'regular' | 'student';
  bankingInfo?: BankingInfoView;
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
  reviewDate?: string;
  reviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}

// View layer validation schemas
const addressViewSchema = z.object({
  street: z.string().min(1, 'Street is required'),
  city: z.string().min(1, 'City is required'),
  postalCode: z.string().regex(/^\d{5}$/, 'Valid 5-digit postal code is required'),
  country: z.string().min(1, 'Country is required')
});

export const personalInfoViewSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters').max(50),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').max(50),
  email: z.email('Valid email is required'),
  phone: z.string().regex(/^\+?[\d\s-()]+$/, 'Valid phone number is required'),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid date in YYYY-MM-DD format is required'),
  gender: z.string().min(1, 'Gender is required'),
  address: addressViewSchema
});

export const bankingInfoViewSchema = z.object({
  accountHolderType: z.enum(['same', 'different']),
  accountHolderFirstName: z.string().min(2).max(50),
  accountHolderLastName: z.string().min(2).max(50),
  accountHolderAddress: z.string().min(1),
  bankName: z.string().min(1),
  bic: z.string().regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/),
  iban: z.string().regex(/^DE\d{2}[0-9]{20}$/),
  debitFrequency: z.enum(['quarterly', 'annually'])
});

export const membershipApplicationViewSchema = z.object({
  id: z.string().uuid(),
  personalInfo: personalInfoViewSchema,
  membershipType: z.enum(['regular', 'student']),
  bankingInfo: bankingInfoViewSchema.optional(),
  canParticipate: z.boolean(),
  motivation: z.string().optional(),
  hasConditions: z.boolean(),
  conditions: z.string().optional(),
  status: z.enum(MembershipStatus),
  documents: z.object({
    application: z.string().url().optional(),
    sepaMandate: z.string().url().optional()
  }),
  reviewer: z.string().optional(),
  reviewDate: z.string().optional(),
  reviewNotes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
}).strict();

// Type inference helpers
export type AddressViewType = z.infer<typeof addressViewSchema>;
export type PersonalInfoViewType = z.infer<typeof personalInfoViewSchema>;
export type BankingInfoViewType = z.infer<typeof bankingInfoViewSchema>;
export type MembershipApplicationViewType = z.infer<typeof membershipApplicationViewSchema>;