import { z } from 'zod';

export const PUBLICATION_TARGETS = [
  'homepage',
  'activities',
  'teams',
  'public-documents',
  'taster-information',
  'membership-information',
  'recruitment',
  'contact',
  'locations',
] as const;

export const publicationTargetSchema = z.enum(PUBLICATION_TARGETS);

export const publicationRequestSchema = z.object({
  target: publicationTargetSchema,
});

export type PublicationTarget = z.infer<typeof publicationTargetSchema>;
export type PublicationRequest = z.infer<typeof publicationRequestSchema>;
