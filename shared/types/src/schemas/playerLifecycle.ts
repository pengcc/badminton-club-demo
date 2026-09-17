import { z } from 'zod';

export const playerLifecycleBatchSchema = z
  .object({
    userIds: z.array(z.string().min(1)).min(1).max(50),
    action: z.enum(['enable', 'deactivate']),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export const playerCleanupSchema = z
  .object({
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export const convertFormerMemberToExternalSchema = z
  .object({
    reason: z.string().trim().min(1).max(500),
  })
  .strict();

export type PlayerLifecycleBatchInput = z.infer<
  typeof playerLifecycleBatchSchema
>;
export type PlayerCleanupInput = z.infer<typeof playerCleanupSchema>;
export type ConvertFormerMemberToExternalInput = z.infer<
  typeof convertFormerMemberToExternalSchema
>;
