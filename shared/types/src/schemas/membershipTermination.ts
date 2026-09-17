import { z } from 'zod';
import {
  MembershipTerminationSource,
  MembershipTerminationStatus,
} from '../core/enums';

export const membershipTerminationDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD');

export const membershipTerminationNoteSchema = z
  .string()
  .trim()
  .max(1000)
  .optional();

const scheduledMembershipTerminationTimingSchema = z.object({
  effectiveTiming: z.literal('scheduled'),
  effectiveDate: membershipTerminationDateSchema,
  note: membershipTerminationNoteSchema,
});

const scheduledMembershipTerminationApprovalSchema = z.object({
  effectiveTiming: z.literal('scheduled'),
  effectiveDate: z.never().optional(),
  note: membershipTerminationNoteSchema,
});

const todayMembershipTerminationTimingSchema = z.object({
  effectiveTiming: z.literal('today'),
  effectiveDate: z.never().optional(),
  note: z.string().trim().min(1).max(1000),
});

export const adminMembershipTerminationTimingSchema = z.discriminatedUnion(
  'effectiveTiming',
  [
    scheduledMembershipTerminationTimingSchema,
    todayMembershipTerminationTimingSchema,
  ]
);

export const requestMembershipTerminationSchema = z.object({
  effectiveDate: membershipTerminationDateSchema,
  note: membershipTerminationNoteSchema,
  continueAsExternalPlayer: z.never().optional(),
});

export const approveMembershipTerminationSchema = z
  .discriminatedUnion('effectiveTiming', [
    scheduledMembershipTerminationApprovalSchema,
    todayMembershipTerminationTimingSchema,
  ])
  .and(z.object({ continueAsExternalPlayer: z.never().optional() }));

export const rejectMembershipTerminationSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

export const offlineMembershipTerminationSourceSchema = z.enum([
  MembershipTerminationSource.EMAIL,
  MembershipTerminationSource.PHONE,
  MembershipTerminationSource.IN_PERSON,
  MembershipTerminationSource.OTHER,
]);

export const recordMembershipTerminationSchema =
  adminMembershipTerminationTimingSchema.and(
    z.object({
      userId: z.string().min(1),
      source: offlineMembershipTerminationSourceSchema,
      requestReceivedAt: z.iso.datetime(),
      continueAsExternalPlayer: z.never().optional(),
    })
  );

export const batchRecordMembershipTerminationSchema =
  adminMembershipTerminationTimingSchema.and(
    z.object({
      userIds: z.array(z.string().min(1)).min(1).max(50),
    })
  );

export const membershipTerminationListQuerySchema = z.object({
  status: z.nativeEnum(MembershipTerminationStatus).optional(),
});

export type RequestMembershipTerminationInput = z.infer<
  typeof requestMembershipTerminationSchema
>;
export type AdminMembershipTerminationTimingInput = z.infer<
  typeof adminMembershipTerminationTimingSchema
>;
export type ApproveMembershipTerminationInput = z.infer<
  typeof approveMembershipTerminationSchema
>;
export type RejectMembershipTerminationInput = z.infer<
  typeof rejectMembershipTerminationSchema
>;
export type RecordMembershipTerminationInput = z.infer<
  typeof recordMembershipTerminationSchema
>;
export type BatchRecordMembershipTerminationInput = z.infer<
  typeof batchRecordMembershipTerminationSchema
>;
