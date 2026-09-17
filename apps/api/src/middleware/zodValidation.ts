/**
 * Zod Validation Middleware
 *
 * Middleware for validating request bodies using Zod schemas
 * Provides consistent validation across all API routes
 */

import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema, ZodIssue } from 'zod';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { HttpStatus } from '@club/shared-types/core/enums';

/**
 * Validation target - where to find the data to validate
 */
export enum ValidationTarget {
  BODY = 'body',
  QUERY = 'query',
  PARAMS = 'params',
}

/**
 * Options for validation middleware
 */
interface ValidationOptions {
  target?: ValidationTarget;
  stripUnknown?: boolean;
}

/**
 * Create a validation middleware for a Zod schema
 *
 * @param schema - Zod schema to validate against
 * @param options - Validation options
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * import { directMemberEstablishmentSchema } from '@club/shared-types/schemas';
 *
 * router.post('/users',
 *   validate(directMemberEstablishmentSchema),
 *   userController.createUser
 * );
 * ```
 */
export const validate = (
  schema: ZodSchema,
  options: ValidationOptions = {}
) => {
  const { target = ValidationTarget.BODY, stripUnknown = true } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get data from the specified target
      const data = req[target];

      // Validate and parse the data
      const validated = await schema.parseAsync(data);

      // Replace the original data with validated data
      // This ensures type safety and removes unknown fields if stripUnknown is true
      if (stripUnknown) {
        req[target] = validated;
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod errors into a user-friendly format
        const formattedErrors = error.issues.map((err: ZodIssue) => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        // Return validation error
        next(
          new AppError(
            `Validation failed: ${formattedErrors.map((e) => `${e.field}: ${e.message}`).join(', ')}`,
            HttpStatus.BAD_REQUEST
          )
        );
      } else {
        // Unexpected error during validation
        next(new AppError('Validation error', HttpStatus.INTERNAL_ERROR));
      }
    }
  };
};

/**
 * Validate request body
 * Shorthand for validate(schema, { target: ValidationTarget.BODY })
 */
export const validateBody = (schema: ZodSchema, stripUnknown = true) =>
  validate(schema, { target: ValidationTarget.BODY, stripUnknown });

/**
 * Validate query parameters
 * Shorthand for validate(schema, { target: ValidationTarget.QUERY })
 */
export const validateQuery = (schema: ZodSchema, stripUnknown = true) =>
  validate(schema, { target: ValidationTarget.QUERY, stripUnknown });

/**
 * Validate route parameters
 * Shorthand for validate(schema, { target: ValidationTarget.PARAMS })
 */
export const validateParams = (schema: ZodSchema, stripUnknown = true) =>
  validate(schema, { target: ValidationTarget.PARAMS, stripUnknown });
