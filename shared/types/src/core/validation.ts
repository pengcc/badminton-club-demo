import { z } from 'zod';

/**
 * Validation Schema Reuse Pattern
 *
 * This module establishes the pattern for validation schema reuse across layers:
 *
 * 1. DOMAIN LAYER: Define core business rules
 *    - Example: UserSchema.core defines required fields and business constraints
 *    - Business rules like "only members can be players" go here
 *
 * 2. API LAYER: Extend domain schemas with transport-specific validation
 *    - Example: ApiSchemas.createUser extends UserSchema.core
 *    - Add HTTP-specific validation (request size, format, etc.)
 *    - May omit fields that server generates (id, timestamps, membershipStatus)
 *
 * 3. VIEW LAYER: Extend API schemas with user-friendly messages
 *    - Example: FormSchemas.userForm extends ApiSchemas.createUser
 *    - Add client-specific validation (UI formatting, display rules)
 *    - Include user-friendly error messages
 *
 * PATTERN EXAMPLE:
 *
 * ```typescript
 * // Domain Layer (shared/types/domain/user.ts)
 * export const UserSchema = {
 *   core: z.object({
 *     email: z.email(),
 *     isPlayer: z.boolean()
 *   }).refine(
 *     (data) => !data.isPlayer || data.role === 'member',
 *     { message: 'Only members can be players' }
 *   )
 * };
 *
 * // API Layer (shared/types/api/user.ts)
 * export const ApiSchemas = {
 *   createUser: UserSchema.core.omit({ membershipStatus: true })
 * };
 *
 * // View Layer (shared/types/view/forms/userForm.ts)
 * export const FormSchemas = {
 *   userForm: ApiSchemas.createUser.extend({
 *     emailConfirmation: z.email()
 *   }).refine(
 *     (data) => data.email === data.emailConfirmation,
 *     { message: 'Email addresses must match', path: ['emailConfirmation'] }
 *   )
 * };
 * ```
 *
 * BENEFITS:
 * - Single source of truth for business rules (domain layer)
 * - Each layer adds only its specific concerns
 * - Changes to core validation propagate automatically
 * - Type safety maintained across layers
 */

/**
 * Common validation schemas
 */
export const CommonSchemas = {
  objectId: z.string().regex(
    /^[0-9a-fA-F]{24}$/,
    { message: 'Invalid ObjectId format' }
  ),

  timestamp: z.object({
    createdAt: z.date(),
    updatedAt: z.date()
  }),

  stringId: z.object({
    id: z.string().min(1)
  }),

  pagination: z.object({
    page: z.number().int().min(1).optional().default(1),
    limit: z.number().int().min(1).max(100).optional().default(10)
  })
};

/**
 * Type inference helper
 */
export type InferSchemaType<T extends z.ZodType> = z.infer<T>;

/**
 * Error handling
 */
export class ValidationError extends Error {
  constructor(
    public readonly errors: z.ZodError,
    message: string = 'Validation failed'
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validation helpers
 */
export const validateSchema = <T extends z.ZodType>(
  schema: T,
  data: unknown
): InferSchemaType<T> => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error);
    }
    throw error;
  }
};

/**
 * Schema builder utilities
 */
export const SchemaBuilder = {
  /**
   * Make all properties optional
   */
  optional: <T extends z.ZodObject<any>>(schema: T) =>
    schema.partial(),

  /**
   * Make all properties required
   */
  required: <T extends z.ZodObject<any>>(schema: T) =>
    schema.required(),

  /**
   * Add timestamp fields
   */
  withTimestamp: <T extends z.ZodObject<any>>(schema: T) =>
    schema.extend(CommonSchemas.timestamp),

  /**
   * Add string ID field
   */
  withStringId: <T extends z.ZodObject<any>>(schema: T) =>
    schema.extend(CommonSchemas.stringId)
};