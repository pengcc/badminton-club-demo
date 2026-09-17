import { z } from 'zod';

export const guestPlayLocaleSchema = z.enum(['de', 'en', 'zh']);
export const guestPlayStatusSchema = z.enum([
  'pending',
  'approved',
  'declined',
  'cancelled',
]);
export const guestPlayNotificationStatusSchema = z.enum([
  'not_attempted',
  'not_configured',
  'sending',
  'sent',
  'failed',
  'uncertain',
]);
export const guestPlayNotificationKindSchema = z.enum([
  'memberReceipt',
  'administratorAlert',
  'decisionEmail',
]);
export const GUEST_PLAY_NOTIFICATION_STALE_MS = 10 * 60 * 1000;

export const guestPlayOpportunitySchema = z
  .object({
    locationId: z.string().min(1),
    timeSlotId: z.string().min(1),
    localDate: z.string().date(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    startAt: z.string().datetime(),
    locationName: z.string().min(1),
    locationAddress: z.string(),
    participationNote: z.string().optional(),
  })
  .strict();

export const guestPlayOpportunitiesQuerySchema = z
  .object({ locale: guestPlayLocaleSchema.default('de') })
  .strict();

export const createGuestPlaySchema = z
  .object({
    locationId: z.string().min(1),
    timeSlotId: z.string().min(1).max(128),
    localDate: z.string().date(),
    guestCount: z.number().int().min(1).max(5),
    message: z.string().trim().max(1000).optional(),
    locale: guestPlayLocaleSchema.default('de'),
  })
  .strict();

export const guestPlayParamsSchema = z
  .object({ id: z.string().regex(/^[0-9a-fA-F]{24}$/) })
  .strict();

export const guestPlayListQuerySchema = z
  .object({
    status: z.union([guestPlayStatusSchema, z.literal('all')]).default('all'),
    archived: z.enum(['exclude', 'include', 'only']).default('exclude'),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const guestPlayVersionCommandSchema = z
  .object({ expectedVersion: z.number().int().min(0) })
  .strict();

export const guestPlayDecisionSchema = z
  .object({
    expectedVersion: z.number().int().min(0),
    decision: z.enum(['approved', 'declined']),
    adminNotes: z.string().trim().max(1000).optional(),
  })
  .strict();

export const guestPlayCorrectionSchema = guestPlayDecisionSchema
  .extend({ reason: z.string().trim().min(1).max(500) })
  .superRefine((value, context) => {
    if (value.adminNotes?.trim() === '') {
      context.addIssue({
        code: 'custom',
        path: ['adminNotes'],
        message: 'Administrator notes must not be blank',
      });
    }
  });

export const guestPlayNotificationRetrySchema =
  guestPlayVersionCommandSchema.extend({
    notification: guestPlayNotificationKindSchema,
  });

export const guestPlayNotificationEntrySchema = z
  .object({
    status: guestPlayNotificationStatusSchema,
    attempts: z.number().int().min(0),
    lastAttemptAt: z.string().datetime().optional(),
    recipients: z.array(z.string().email()),
    sentAt: z.string().datetime().optional(),
    error: z.enum(['configuration', 'transport', 'unknown']).optional(),
    retryAvailable: z.boolean(),
  })
  .strict();

const guestPlayBaseResponseSchema = z
  .object({
    id: z.string(),
    guestCount: z.number().int().min(1).max(5),
    message: z.string().optional(),
    status: guestPlayStatusSchema,
    appointment: z
      .object({
        locationId: z.string(),
        timeSlotId: z.string(),
        locationName: z.string(),
        locationAddress: z.string(),
        localDate: z.string().date(),
        startTime: z.string(),
        endTime: z.string(),
        startAt: z.string().datetime(),
      })
      .strict(),
    locale: guestPlayLocaleSchema,
    version: z.number().int().min(0),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const guestPlayMemberResponseSchema = guestPlayBaseResponseSchema.extend(
  {
    memberId: z.string(),
    decisionAt: z.string().datetime().optional(),
  }
);

export const guestPlayAdminResponseSchema = guestPlayBaseResponseSchema.extend({
  memberId: z.string(),
  memberName: z.string(),
  memberEmail: z.string().email(),
  adminNotes: z.string().optional(),
  decisionBy: z.string().optional(),
  decisionAt: z.string().datetime().optional(),
  archived: z.boolean(),
  archivedAt: z.string().datetime().optional(),
  archivedBy: z.string().optional(),
  notifications: z
    .object({
      memberReceipt: guestPlayNotificationEntrySchema,
      administratorAlert: guestPlayNotificationEntrySchema,
      decisionEmail: guestPlayNotificationEntrySchema,
    })
    .strict(),
});

export const guestPlayListResponseSchema = z
  .object({
    requests: z.array(guestPlayAdminResponseSchema),
    total: z.number().int().min(0),
    limit: z.number().int().min(1),
    offset: z.number().int().min(0),
  })
  .strict();

export const guestPlayStatsResponseSchema = z
  .object({
    total: z.number().int().min(0),
    pending: z.number().int().min(0),
    approved: z.number().int().min(0),
    declined: z.number().int().min(0),
    cancelled: z.number().int().min(0),
    archived: z.number().int().min(0),
  })
  .strict();

export type GuestPlayLocale = z.infer<typeof guestPlayLocaleSchema>;
export type GuestPlayStatus = z.infer<typeof guestPlayStatusSchema>;
export type GuestPlayNotificationStatus = z.infer<
  typeof guestPlayNotificationStatusSchema
>;
export type GuestPlayNotificationKind = z.infer<
  typeof guestPlayNotificationKindSchema
>;
export type GuestPlayOpportunity = z.infer<typeof guestPlayOpportunitySchema>;
export type CreateGuestPlayRequest = z.infer<typeof createGuestPlaySchema>;
export type GuestPlayListQuery = z.infer<typeof guestPlayListQuerySchema>;
export type GuestPlayDecisionCommand = z.infer<typeof guestPlayDecisionSchema>;
export type GuestPlayCorrectionCommand = z.infer<
  typeof guestPlayCorrectionSchema
>;
export type GuestPlayNotificationRetryCommand = z.infer<
  typeof guestPlayNotificationRetrySchema
>;
export type GuestPlayMemberResponse = z.infer<
  typeof guestPlayMemberResponseSchema
>;
export type GuestPlayAdminResponse = z.infer<
  typeof guestPlayAdminResponseSchema
>;
export type GuestPlayResponse = GuestPlayAdminResponse;
export type GuestPlayListResponse = z.infer<typeof guestPlayListResponseSchema>;
export type GuestPlayStatsResponse = z.infer<
  typeof guestPlayStatsResponseSchema
>;
