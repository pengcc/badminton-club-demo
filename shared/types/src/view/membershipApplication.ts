import { z } from 'zod';
import { MemberApplicationStatus } from '../core/enums';
import {
  bankingInfoDraftSchema,
  bankingSummarySchema,
  personalInfoDraftSchema,
  personalInfoSchema,
} from '../domain/membershipApplication';

export const addressViewSchema = personalInfoSchema.shape.address;
export const personalInfoViewSchema = personalInfoSchema;
export const personalInfoDraftViewSchema = personalInfoDraftSchema;
export const bankingInfoViewSchema = bankingInfoDraftSchema;

export const membershipApplicationViewSchema = z
  .object({
    id: z.string(),
    verifiedEmail: z.email(),
    personalInfo: personalInfoDraftSchema,
    membershipType: z.enum(['regular', 'student']).optional(),
    motivation: z.string().optional(),
    bankingSummary: bankingSummarySchema,
    status: z.enum(MemberApplicationStatus),
    reviewer: z.string().optional(),
    reviewDate: z.string().optional(),
    reviewNote: z.string().optional(),
    rejectionReason: z.string().optional(),
    approvalMessage: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();

export type AddressView = z.infer<typeof addressViewSchema>;
export type PersonalInfoView = z.infer<typeof personalInfoViewSchema>;
export type BankingInfoView = z.infer<typeof bankingInfoViewSchema>;
export type MembershipApplicationView = z.infer<
  typeof membershipApplicationViewSchema
>;
export type AddressViewType = AddressView;
export type PersonalInfoViewType = PersonalInfoView;
export type BankingInfoViewType = BankingInfoView;
export type MembershipApplicationViewType = MembershipApplicationView;
