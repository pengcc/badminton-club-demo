import { z } from 'zod';

export const LOCATION_WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type LocationWeekday = (typeof LOCATION_WEEKDAYS)[number];

export const LOCATION_TASTER_SESSION_LEVELS = [
  'beginner',
  'experienced',
] as const;

export type LocationTasterSessionLevel =
  (typeof LOCATION_TASTER_SESSION_LEVELS)[number];

const localTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must use HH:mm format');

export const localizedLocationNoteSchema = z
  .object({
    de: z
      .string()
      .trim()
      .max(500, 'German note cannot exceed 500 characters')
      .optional(),
    en: z
      .string()
      .trim()
      .max(500, 'English note cannot exceed 500 characters')
      .optional(),
    zh: z
      .string()
      .trim()
      .max(500, 'Chinese note cannot exceed 500 characters')
      .optional(),
  })
  .strict();

export const locationTimeSlotInputSchema = z
  .object({
    id: z.uuid('Time slot id must be a UUID').optional(),
    weekday: z.enum(LOCATION_WEEKDAYS),
    startTime: localTimeSchema,
    endTime: localTimeSchema,
    active: z.boolean(),
    guestPlayEnabled: z.boolean().default(true),
    tasterSessionEnabled: z.boolean().default(true),
    tasterSessionAcceptedLevels: z
      .array(z.enum(LOCATION_TASTER_SESSION_LEVELS))
      .default([...LOCATION_TASTER_SESSION_LEVELS]),
    note: localizedLocationNoteSchema.optional(),
  })
  .strict()
  .refine((slot) => slot.endTime > slot.startTime, {
    message: 'End time must be after start time',
    path: ['endTime'],
  })
  .superRefine((slot, context) => {
    const uniqueLevels = new Set(slot.tasterSessionAcceptedLevels);
    if (uniqueLevels.size !== slot.tasterSessionAcceptedLevels.length) {
      context.addIssue({
        code: 'custom',
        message: 'Taster Session accepted levels must not contain duplicates',
        path: ['tasterSessionAcceptedLevels'],
      });
    }
    if (slot.tasterSessionEnabled && uniqueLevels.size === 0) {
      context.addIssue({
        code: 'custom',
        message:
          'An enabled Taster Session time must accept at least one level',
        path: ['tasterSessionAcceptedLevels'],
      });
    }
  });

const locationTranslationsSchema = z
  .object({
    de: z
      .object({ name: z.string().max(200), address: z.string().max(500) })
      .strict(),
    en: z
      .object({ name: z.string().max(200), address: z.string().max(500) })
      .strict(),
    zh: z
      .object({ name: z.string().max(200), address: z.string().max(500) })
      .strict(),
  })
  .strict();

const timeSlotsSchema = z
  .array(locationTimeSlotInputSchema)
  .max(50, 'A location cannot have more than 50 weekly time slots')
  .superRefine((slots, context) => {
    const seenIds = new Set<string>();

    slots.forEach((slot, index) => {
      if (!slot.id) return;
      if (seenIds.has(slot.id)) {
        context.addIssue({
          code: 'custom',
          message: 'Time slot ids must be unique within a location',
          path: [index, 'id'],
        });
      }
      seenIds.add(slot.id);
    });
  });

export const createLocationSchema = z
  .object({
    translations: locationTranslationsSchema,
    timeSlots: timeSlotsSchema.default([]),
    imageUrl: z.string().max(2_000).default(''),
    isActive: z.boolean().default(true),
    order: z.number().int().min(0).default(0),
  })
  .strict();

export const updateLocationSchema = createLocationSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    'At least one location field is required'
  );

export type LocationTimeSlotInput = z.input<typeof locationTimeSlotInputSchema>;
export type LocationTimeSlot = Omit<
  z.output<typeof locationTimeSlotInputSchema>,
  'id'
> & {
  id: string;
};
export type CreateLocationRequest = z.input<typeof createLocationSchema>;
export type UpdateLocationRequest = z.input<typeof updateLocationSchema>;
