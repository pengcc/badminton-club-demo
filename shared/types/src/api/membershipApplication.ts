import { z } from 'zod';
import { MemberApplicationStatus } from '../core/enums';
import {
  bankingInfoDraftSchema,
  bankingSummarySchema,
  membershipApplicationSubmissionCorrectionFieldSchema,
  personalInfoDraftSchema,
  personalInfoSchema,
  studentProofMetadataSchema,
} from '../domain/membershipApplication';

export const MEMBERSHIP_APPLICATION_SUBMISSION_VALIDATION_ERROR_CODE =
  'MEMBERSHIP_APPLICATION_SUBMISSION_VALIDATION_FAILED' as const;

export const membershipApplicationSubmissionValidationErrorDetailsSchema = z
  .object({
    fields: z
      .array(membershipApplicationSubmissionCorrectionFieldSchema)
      .min(1),
  })
  .strict();

export const membershipApplicationSubmissionValidationErrorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.string(),
    code: z.literal(MEMBERSHIP_APPLICATION_SUBMISSION_VALIDATION_ERROR_CODE),
    details: membershipApplicationSubmissionValidationErrorDetailsSchema,
  })
  .strict();

export type RegistrationAccessExpiryMode =
  | '30_days'
  | '90_days'
  | '180_days'
  | 'none';

export interface RegistrationAccessMetadata {
  hasCurrentLink: boolean;
  isValid: boolean;
  expiryMode?: RegistrationAccessExpiryMode;
  expiresAt?: string;
  generation?: number;
  updatedAt?: string;
}

export interface RegistrationAccessAdminState
  extends RegistrationAccessMetadata {
  path?: string;
}

export interface IssueRegistrationAccessRequest {
  expiryMode: RegistrationAccessExpiryMode;
}

export const createMembershipApplicationSchema = z
  .object({
    personalInfo: personalInfoSchema,
    membershipType: z.enum(['regular', 'student']),
    motivation: z.string().trim().max(2000).optional(),
    bankingInfo: bankingInfoDraftSchema.optional(),
  })
  .strict();

export const saveMembershipApplicationSchema = z
  .object({
    personalInfo: personalInfoDraftSchema.optional(),
    membershipType: z.enum(['regular', 'student']).optional(),
    motivation: z.string().trim().max(2000).optional(),
    bankingInfo: bankingInfoDraftSchema.nullable().optional(),
  })
  .strict();

export const applicantEmailRequestSchema = z
  .object({
    email: z.email(),
    locale: z.enum(['de', 'en', 'zh']).default('de'),
  })
  .strict();

export const applicantAccessConsumeSchema = z
  .object({
    token: z.string().min(20).max(200),
  })
  .strict();

export const applicantLocaleSchema = z
  .object({
    locale: z.enum(['de', 'en', 'zh']),
  })
  .strict();

export const applicantWithdrawSchema = z
  .object({
    confirmed: z.literal(true),
  })
  .strict();

export const updateMembershipApplicationSchema = z
  .object({
    reviewNote: z.string().trim().max(4000).optional(),
  })
  .strict();

export const approveMembershipApplicationSchema = z
  .object({
    reviewNote: z.string().trim().max(4000).optional(),
    approvalMessage: z.string().trim().max(4000).optional(),
  })
  .strict();

export const rejectMembershipApplicationSchema = z
  .object({
    reason: z.string().trim().min(1).max(4000),
    reviewNote: z.string().trim().max(4000).optional(),
  })
  .strict();

export const membershipApplicationResponseSchema = z
  .object({
    id: z.string(),
    verifiedEmail: z.email(),
    communicationLocale: z.enum(['de', 'en', 'zh']),
    personalInfo: personalInfoDraftSchema,
    membershipType: z.enum(['regular', 'student']).optional(),
    motivation: z.string().optional(),
    bankingSummary: bankingSummarySchema,
    status: z.enum(MemberApplicationStatus),
    studentProof: z
      .array(studentProofMetadataSchema.extend({ createdAt: z.iso.datetime() }))
      .max(2),
    signedApplicationReceipt: z
      .object({
        receivedAt: z.iso.datetime(),
        receivedBy: z.string(),
        resetAt: z.iso.datetime().optional(),
        resetReason: z.string().optional(),
      })
      .optional(),
    signedSepaReceipt: z
      .object({
        receivedAt: z.iso.datetime(),
        receivedBy: z.string(),
        resetAt: z.iso.datetime().optional(),
        resetReason: z.string().optional(),
      })
      .optional(),
    reviewer: z.string().optional(),
    reviewerName: z.string().optional(),
    reviewDate: z.iso.datetime().optional(),
    reviewNote: z.string().optional(),
    rejectionReason: z.string().optional(),
    approvalMessage: z.string().optional(),
    decisionNotificationKind: z.enum(['approval', 'rejection']).optional(),
    decisionNotificationStatus: z
      .enum(['pending', 'claimed', 'sent', 'failed', 'uncertain'])
      .optional(),
    decisionNotificationClaimedAt: z.iso.datetime().optional(),
    decisionNotificationAttemptedAt: z.iso.datetime().optional(),
    submittedAt: z.iso.datetime().optional(),
    approvedAt: z.iso.datetime().optional(),
    rejectedAt: z.iso.datetime().optional(),
    withdrawnAt: z.iso.datetime().optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

const applicantSignedDocumentReceiptSchema = z
  .object({
    receivedAt: z.iso.datetime(),
    resetAt: z.iso.datetime().optional(),
    resetReason: z.string().optional(),
  })
  .strict();

export const applicantMembershipApplicationResponseSchema =
  membershipApplicationResponseSchema
    .omit({
      signedApplicationReceipt: true,
      signedSepaReceipt: true,
      reviewer: true,
      reviewerName: true,
      reviewDate: true,
      reviewNote: true,
      decisionNotificationKind: true,
      decisionNotificationStatus: true,
      decisionNotificationClaimedAt: true,
      decisionNotificationAttemptedAt: true,
    })
    .extend({
      signedApplicationReceipt: applicantSignedDocumentReceiptSchema.optional(),
      signedSepaReceipt: applicantSignedDocumentReceiptSchema.optional(),
      bankingInfo: bankingInfoDraftSchema.optional(),
    })
    .strict();

export type CreateMembershipApplicationRequest = z.infer<
  typeof createMembershipApplicationSchema
>;
export type SaveMembershipApplicationRequest = z.infer<
  typeof saveMembershipApplicationSchema
>;
export type ApplicantEmailRequest = z.infer<typeof applicantEmailRequestSchema>;
export type ApplicantAccessConsumeRequest = z.infer<
  typeof applicantAccessConsumeSchema
>;
export type ApplicantWithdrawRequest = z.infer<typeof applicantWithdrawSchema>;
export type ApplicantMembershipApplicationResponse = z.infer<
  typeof applicantMembershipApplicationResponseSchema
>;
export type UpdateMembershipApplicationRequest = z.infer<
  typeof updateMembershipApplicationSchema
>;
export type MembershipApplicationResponse = z.infer<
  typeof membershipApplicationResponseSchema
>;
export type CreateMembershipApplicationRequestType =
  CreateMembershipApplicationRequest;
export type UpdateMembershipApplicationRequestType =
  UpdateMembershipApplicationRequest;
export type MembershipApplicationResponseType = MembershipApplicationResponse;

export interface MembershipApplicationWithReviewer
  extends MembershipApplicationResponse {
  reviewerName?: string;
}

export interface ContactApplicantRequest {
  message: string;
}

export interface ReviewApplicationRequest {
  status: 'approved' | 'rejected';
  reviewNote?: string;
  rejectionReason?: string;
  approvalMessage?: string;
}

export interface MembershipApprovalResult {
  applicationId: string;
  userId: string;
  playerId?: string;
  setupGeneration: number;
  setupRequired: boolean;
  replayed: boolean;
  deliveryStatus: 'pending' | 'sent' | 'failed' | 'uncertain';
  decisionDeliveryStatus: 'sent' | 'failed' | 'uncertain';
}

export interface PasswordSetupReissueResult {
  generation: number;
  deliveryStatus: 'sent' | 'failed' | 'uncertain';
}
