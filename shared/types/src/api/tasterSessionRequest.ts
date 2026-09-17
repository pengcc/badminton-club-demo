import { z } from 'zod';

export const tasterSessionPlayerLevelSchema = z.enum([
  'beginner',
  'experienced',
]);
export const tasterSessionStatusSchema = z.enum([
  'pending',
  'invited',
  'declined',
]);
export const tasterSessionDeclineReasonSchema = z.enum([
  'no_capacity',
  'other',
]);
export const tasterSessionDeliveryStatusSchema = z.enum([
  'not_requested',
  'in_progress',
  'sent',
  'failed',
  'uncertain',
]);
export const tasterSessionLocaleSchema = z.enum(['de', 'en', 'zh']);

export const tasterSessionPreferenceSelectionSchema = z
  .object({
    optionId: z.string().min(1).max(128),
    startsAt: z.string().datetime(),
  })
  .strict();

export const createTasterSessionRequestSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(320),
    playerLevel: tasterSessionPlayerLevelSchema,
    message: z.string().trim().max(1000).optional(),
    preference: tasterSessionPreferenceSelectionSchema.optional(),
    locale: tasterSessionLocaleSchema.default('de'),
  })
  .strict();

export const tasterSessionPreferenceOptionsQuerySchema = z
  .object({
    playerLevel: tasterSessionPlayerLevelSchema,
    locale: tasterSessionLocaleSchema,
  })
  .strict();

export const tasterSessionListQuerySchema = z
  .object({
    status: z
      .union([tasterSessionStatusSchema, z.literal('all')])
      .default('all'),
    playerLevel: z
      .union([tasterSessionPlayerLevelSchema, z.literal('all')])
      .default('all'),
    archived: z.enum(['exclude', 'include', 'only']).default('exclude'),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const tasterSessionRequestParamsSchema = z
  .object({
    id: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, 'Invalid Taster Session request ID'),
  })
  .strict();

export const tasterSessionDispositionSchema = z
  .object({
    expectedVersion: z.number().int().min(0),
    disposition: z.enum(['invited', 'declined']),
    adminNotes: z.string().trim().max(1000).optional(),
    declineReason: tasterSessionDeclineReasonSchema.optional(),
    declineReasonDetails: z.string().trim().max(500).optional(),
    sendEmail: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.disposition === 'declined' && !value.declineReason) {
      context.addIssue({
        code: 'custom',
        path: ['declineReason'],
        message: 'A decline reason is required',
      });
    }
    if (
      value.disposition === 'invited' &&
      (value.declineReason || value.declineReasonDetails)
    ) {
      context.addIssue({
        code: 'custom',
        path: [value.declineReason ? 'declineReason' : 'declineReasonDetails'],
        message: 'Decline reasons apply only to declined requests',
      });
    }
    if (
      value.declineReason === 'other' &&
      !value.declineReasonDetails?.trim()
    ) {
      context.addIssue({
        code: 'custom',
        path: ['declineReasonDetails'],
        message: 'Details are required for another decline reason',
      });
    }
  });

export const tasterSessionArchiveCommandSchema = z
  .object({
    expectedVersion: z.number().int().min(0),
  })
  .strict();

export const tasterSessionDeliveryRetrySchema =
  tasterSessionArchiveCommandSchema;

export type TasterSessionPlayerLevel = z.infer<
  typeof tasterSessionPlayerLevelSchema
>;
export type TasterSessionStatus = z.infer<typeof tasterSessionStatusSchema>;
export type TasterSessionDeclineReason = z.infer<
  typeof tasterSessionDeclineReasonSchema
>;
export type TasterSessionDeliveryStatus = z.infer<
  typeof tasterSessionDeliveryStatusSchema
>;
export type TasterSessionLocale = z.infer<typeof tasterSessionLocaleSchema>;
export type CreateTasterSessionRequest = z.infer<
  typeof createTasterSessionRequestSchema
>;
export type TasterSessionListQuery = z.infer<
  typeof tasterSessionListQuerySchema
>;
export type TasterSessionDispositionCommand = z.infer<
  typeof tasterSessionDispositionSchema
>;

export const tasterSessionPreferenceOptionSchema = z
  .object({
    id: z.string().min(1),
    timeSlotId: z.string().min(1),
    localDate: z.string().date(),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime(),
    location: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        address: z.string(),
      })
      .strict(),
    note: z.string().optional(),
  })
  .strict();

export const tasterSessionRequestResponseSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    email: z.string().email(),
    playerLevel: tasterSessionPlayerLevelSchema,
    message: z.string().optional(),
    status: tasterSessionStatusSchema,
    adminNotes: z.string().optional(),
    declineReason: tasterSessionDeclineReasonSchema.optional(),
    declineReasonDetails: z.string().optional(),
    dispositionBy: z.string().optional(),
    dispositionAt: z.string().datetime().optional(),
    preference: z
      .object({
        optionId: z.string().min(1),
        startsAt: z.string().datetime(),
        locationId: z.string().min(1),
        locationName: z.string().min(1),
        timeSlotId: z.string().min(1).optional(),
        locationAddress: z.string().optional(),
        localDate: z.string().date().optional(),
        startTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
          .optional(),
        endTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
          .optional(),
        participationNote: z.string().optional(),
      })
      .strict()
      .optional(),
    archived: z.boolean(),
    archivedAt: z.string().datetime().optional(),
    archivedBy: z.string().optional(),
    delivery: z
      .object({
        status: tasterSessionDeliveryStatusSchema,
        attemptedAt: z.string().datetime().optional(),
        retryAvailable: z.boolean(),
      })
      .strict(),
    locale: tasterSessionLocaleSchema,
    version: z.number().int().min(0),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const tasterSessionRequestListResponseSchema = z
  .object({
    requests: z.array(tasterSessionRequestResponseSchema),
    total: z.number().int().min(0),
    limit: z.number().int().min(1),
    offset: z.number().int().min(0),
  })
  .strict();

export const tasterSessionRequestStatsResponseSchema = z
  .object({
    total: z.number().int().min(0),
    pending: z.number().int().min(0),
    invited: z.number().int().min(0),
    declined: z.number().int().min(0),
    archived: z.number().int().min(0),
  })
  .strict();

export type TasterSessionPreferenceOption = z.infer<
  typeof tasterSessionPreferenceOptionSchema
>;
export type TasterSessionRequestResponse = z.infer<
  typeof tasterSessionRequestResponseSchema
>;
export type TasterSessionRequestListResponse = z.infer<
  typeof tasterSessionRequestListResponseSchema
>;
export type TasterSessionRequestStatsResponse = z.infer<
  typeof tasterSessionRequestStatsResponseSchema
>;
