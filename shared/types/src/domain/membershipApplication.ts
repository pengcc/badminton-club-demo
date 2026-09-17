import { z } from 'zod';
import { Gender, MemberApplicationStatus } from '../core/enums';
import {
  germanAddressSchema,
  optionalPersonPhoneSchema,
  personDateOfBirthSchema,
  personNameSchema,
} from './personProfile';

export const addressDraftSchema = z.object({
  street: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().max(20).optional(),
  country: z.string().trim().max(80).optional(),
});

export const addressSchema = germanAddressSchema;

export const personalInfoDraftSchema = z.object({
  firstName: z.string().trim().max(50).optional(),
  lastName: z.string().trim().max(50).optional(),
  email: z.email().optional(),
  phone: z.string().trim().max(40).optional(),
  dateOfBirth: z.string().trim().max(10).optional(),
  gender: z.enum(Gender).optional(),
  address: addressDraftSchema.optional(),
});

export const personalInfoSchema = z.object({
  firstName: personNameSchema,
  lastName: personNameSchema,
  email: z.email(),
  phone: optionalPersonPhoneSchema.optional(),
  dateOfBirth: personDateOfBirthSchema,
  gender: z.enum(Gender),
  address: addressSchema,
});

export const membershipApplicationSubmissionCorrectionFields = [
  'firstName',
  'lastName',
  'phone',
  'dateOfBirth',
  'gender',
  'street',
  'city',
  'postalCode',
  'membershipType',
] as const;

export const membershipApplicationSubmissionCorrectionFieldSchema = z.enum(
  membershipApplicationSubmissionCorrectionFields
);

export type MembershipApplicationSubmissionCorrectionField = z.infer<
  typeof membershipApplicationSubmissionCorrectionFieldSchema
>;

export const membershipApplicationSubmissionSchema = z.object({
  personalInfo: personalInfoSchema,
  membershipType: z.enum(['regular', 'student']),
});

export interface MembershipApplicationSubmissionReadiness {
  ready: boolean;
  fields: MembershipApplicationSubmissionCorrectionField[];
}

const submissionCorrectionFieldByPath: Record<
  string,
  readonly MembershipApplicationSubmissionCorrectionField[]
> = {
  'personalInfo.firstName': ['firstName'],
  'personalInfo.lastName': ['lastName'],
  'personalInfo.phone': ['phone'],
  'personalInfo.dateOfBirth': ['dateOfBirth'],
  'personalInfo.gender': ['gender'],
  'personalInfo.address': ['street', 'city', 'postalCode'],
  'personalInfo.address.street': ['street'],
  'personalInfo.address.city': ['city'],
  'personalInfo.address.postalCode': ['postalCode'],
  membershipType: ['membershipType'],
};

export function getMembershipApplicationSubmissionReadiness(
  input: unknown
): MembershipApplicationSubmissionReadiness {
  const result = membershipApplicationSubmissionSchema.safeParse(input);
  if (result.success) return { ready: true, fields: [] };

  const fields = new Set<MembershipApplicationSubmissionCorrectionField>();
  for (const issue of result.error.issues) {
    const path = issue.path.join('.');
    for (const field of submissionCorrectionFieldByPath[path] ?? []) {
      fields.add(field);
    }
  }
  return { ready: false, fields: [...fields] };
}

const partialBankFields = {
  bankName: z.string().trim().max(120).optional(),
  bic: z.string().trim().max(11).optional(),
  iban: z.string().trim().max(34).optional(),
  debitFrequency: z.enum(['quarterly', 'annually']).optional(),
};

export const bankingInfoDraftSchema = z.discriminatedUnion(
  'accountHolderType',
  [
    z
      .object({
        accountHolderType: z.literal('same'),
        ...partialBankFields,
      })
      .strict(),
    z
      .object({
        accountHolderType: z.literal('different'),
        accountHolderFirstName: z.string().trim().max(50).optional(),
        accountHolderLastName: z.string().trim().max(50).optional(),
        accountHolderAddress: z.string().trim().max(240).optional(),
        ...partialBankFields,
      })
      .strict(),
  ]
);

const completeBankFields = {
  bankName: z.string().trim().min(1).max(120),
  bic: z
    .string()
    .trim()
    .regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/)
    .optional(),
  iban: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s/g, '').toUpperCase())
    .pipe(z.string().regex(/^DE\d{20}$/)),
  debitFrequency: z.enum(['quarterly', 'annually']),
};

export const completeBankingInfoSchema = z.discriminatedUnion(
  'accountHolderType',
  [
    z
      .object({ accountHolderType: z.literal('same'), ...completeBankFields })
      .strict(),
    z
      .object({
        accountHolderType: z.literal('different'),
        accountHolderFirstName: z.string().trim().min(2).max(50),
        accountHolderLastName: z.string().trim().min(2).max(50),
        accountHolderAddress: z.string().trim().min(1).max(240),
        ...completeBankFields,
      })
      .strict(),
  ]
);

export const bankingEncryptionEnvelopeSchema = z
  .object({
    keyVersion: z.string().trim().min(1),
    nonce: z.string().min(1),
    ciphertext: z.string().min(1),
    authTag: z.string().min(1),
  })
  .strict();

export const bankingSummarySchema = z
  .object({
    present: z.boolean(),
    complete: z.boolean(),
    ibanLastFour: z
      .string()
      .regex(/^\d{4}$/)
      .optional(),
  })
  .strict();

export const signedDocumentReceiptSchema = z
  .object({
    receivedAt: z.date(),
    receivedBy: z.string().min(1),
    resetAt: z.date().optional(),
    resetReason: z.string().optional(),
  })
  .strict();

export const studentProofMetadataSchema = z
  .object({
    id: z.string().min(1),
    originalName: z.string().min(1),
    mimeType: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
    size: z
      .number()
      .int()
      .positive()
      .max(10 * 1024 * 1024),
    createdAt: z.date(),
  })
  .strict();

const applicationBaseSchema = z
  .object({
    id: z.string(),
    verifiedEmail: z.email(),
    communicationLocale: z.enum(['de', 'en', 'zh']).default('de'),
    personalInfo: personalInfoDraftSchema,
    membershipType: z.enum(['regular', 'student']).optional(),
    motivation: z.string().trim().max(2000).optional(),
    bankingSummary: bankingSummarySchema,
    status: z.enum(MemberApplicationStatus),
    studentProof: z.array(studentProofMetadataSchema).max(2).default([]),
    signedApplicationReceipt: signedDocumentReceiptSchema.optional(),
    signedSepaReceipt: signedDocumentReceiptSchema.optional(),
    reviewer: z.string().optional(),
    reviewDate: z.date().optional(),
    reviewNote: z.string().optional(),
    rejectionReason: z.string().optional(),
    approvalMessage: z.string().optional(),
    decisionNotificationKind: z.enum(['approval', 'rejection']).optional(),
    decisionNotificationStatus: z
      .enum(['pending', 'claimed', 'sent', 'failed', 'uncertain'])
      .optional(),
    decisionNotificationClaimedAt: z.date().optional(),
    decisionNotificationAttemptedAt: z.date().optional(),
    submittedAt: z.date().optional(),
    approvedAt: z.date().optional(),
    rejectedAt: z.date().optional(),
    withdrawnAt: z.date().optional(),
    applicantDataUpdatedAt: z.date(),
    approvedUserId: z.string().optional(),
    createdAt: z.date(),
    updatedAt: z.date(),
  })
  .strict();

export const membershipApplicationSchema = applicationBaseSchema.superRefine(
  (application, context) => {
    if (application.status === MemberApplicationStatus.DRAFT) return;
    if (!getMembershipApplicationSubmissionReadiness(application).ready) {
      context.addIssue({
        code: 'custom',
        message: 'Submitted applications require complete core applicant data',
      });
    }
  }
);

export namespace Domain {
  export type Address = z.infer<typeof addressSchema>;
  export type AddressDraft = z.infer<typeof addressDraftSchema>;
  export type PersonalInfo = z.infer<typeof personalInfoSchema>;
  export type PersonalInfoDraft = z.infer<typeof personalInfoDraftSchema>;
  export type BankingInfoDraft = z.infer<typeof bankingInfoDraftSchema>;
  export type CompleteBankingInfo = z.infer<typeof completeBankingInfoSchema>;
  export type BankingEncryptionEnvelope = z.infer<
    typeof bankingEncryptionEnvelopeSchema
  >;
  export type BankingSummary = z.infer<typeof bankingSummarySchema>;
  export type StudentProofMetadata = z.infer<typeof studentProofMetadataSchema>;
  export type MembershipApplication = z.infer<
    typeof membershipApplicationSchema
  >;
}

export function normalizeBankingInfo(
  input: Domain.BankingInfoDraft
): Domain.BankingInfoDraft {
  const common = {
    accountHolderType: input.accountHolderType,
    bankName: input.bankName?.trim() || undefined,
    bic: input.bic?.replace(/\s/g, '').toUpperCase() || undefined,
    iban: input.iban?.replace(/\s/g, '').toUpperCase() || undefined,
    debitFrequency: input.debitFrequency,
  } as const;
  if (input.accountHolderType === 'same') return common;
  return {
    ...common,
    accountHolderType: 'different',
    accountHolderFirstName: input.accountHolderFirstName?.trim() || undefined,
    accountHolderLastName: input.accountHolderLastName?.trim() || undefined,
    accountHolderAddress: input.accountHolderAddress?.trim() || undefined,
  };
}

export function getBankingSummary(
  input?: Domain.BankingInfoDraft
): Domain.BankingSummary {
  if (!input) return { present: false, complete: false };
  const normalized = normalizeBankingInfo(input);
  const complete = completeBankingInfoSchema.safeParse(normalized).success;
  const ibanLastFour =
    normalized.iban && /^DE\d{20}$/.test(normalized.iban)
      ? normalized.iban.slice(-4)
      : undefined;
  return { present: true, complete, ibanLastFour };
}
