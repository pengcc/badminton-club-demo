import { z } from 'zod';

/**
 * Base error interface for all layers
 */
export interface BaseError {
  code: string;
  message: string;
  timestamp: Date;
  stack?: string;
  details?: Record<string, unknown>;
}

/**
 * Domain layer error types
 */
export namespace Domain {
  export interface Error extends BaseError {
    type: 'domain';
  }

  export interface ValidationError extends Error {
    code: 'DOMAIN_VALIDATION_ERROR';
    details: Record<string, unknown> & {
      field: string;
      constraint: string;
      value: unknown;
    };
  }

  export interface BusinessError extends Error {
    code: 'BUSINESS_RULE_VIOLATION';
    details: Record<string, unknown> & {
      rule: string;
      context?: Record<string, unknown>;
    };
  }

  export interface StateError extends Error {
    code: 'INVALID_STATE_TRANSITION';
    details: Record<string, unknown> & {
      currentState: string;
      attemptedTransition: string;
      allowedTransitions: string[];
    };
  }
}

/**
 * Persistence layer error types
 */
export namespace Persistence {
  export interface Error extends BaseError {
    type: 'persistence';
  }

  export interface DatabaseError extends Error {
    code: 'DB_ERROR';
    details: Record<string, unknown> & {
      operation: string;
      collection: string;
      error: unknown;
    };
  }

  export interface NotFoundError extends Error {
    code: 'ENTITY_NOT_FOUND';
    details: Record<string, unknown> & {
      collection: string;
      documentId: string;
    };
  }

  export interface UniqueConstraintError extends Error {
    code: 'UNIQUE_CONSTRAINT_VIOLATION';
    details: Record<string, unknown> & {
      collection: string;
      field: string;
      value: unknown;
    };
  }
}

/**
 * API layer error types
 */
export namespace Api {
  export interface Error extends BaseError {
    type: 'api';
    statusCode: number;
  }

  export interface ValidationError extends Error {
    code: 'API_VALIDATION_ERROR';
    statusCode: 400;
    details: Record<string, unknown> & {
      validationErrors: Array<{
        field: string;
        message: string;
        rule?: string;
      }>;
    };
  }

  export interface AuthError extends Error {
    code: 'UNAUTHORIZED' | 'FORBIDDEN';
    statusCode: 401 | 403;
    details: Record<string, unknown> & {
      requiredRoles?: string[];
      requiredPermissions?: string[];
    };
  }

  export interface NotFoundError extends Error {
    code: 'API_NOT_FOUND';
    statusCode: 404;
    details: Record<string, unknown> & {
      resource: string;
      id: string;
    };
  }

  export interface InternalError extends Error {
    code: 'INTERNAL_SERVER_ERROR';
    statusCode: 500;
    details?: Record<string, unknown> & {
      originalError?: unknown;
    };
  }
}

/**
 * View layer error types
 */
export namespace View {
  export interface Error extends BaseError {
    type: 'view';
    userMessage: string;
    recoverable: boolean;
  }

  export interface FormError extends Error {
    code: 'FORM_VALIDATION_ERROR';
    details: Record<string, unknown> & {
      fields: Array<{
        name: string;
        message: string;
        value?: unknown;
      }>;
    };
  }

  export interface NetworkError extends Error {
    code: 'NETWORK_ERROR';
    details: Record<string, unknown> & {
      endpoint: string;
      method: string;
      status?: number;
    };
  }

  export interface UIError extends Error {
    code: 'UI_ERROR';
    details: Record<string, unknown> & {
      component: string;
      action: string;
      context?: Record<string, unknown>;
    };
  }
}

/**
 * Error validation schemas
 */
const baseErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  timestamp: z.date(),
  stack: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional()
});

export const ErrorSchemas = {
  base: baseErrorSchema,

  domain: baseErrorSchema.extend({
    type: z.literal('domain')
  }),

  persistence: baseErrorSchema.extend({
    type: z.literal('persistence')
  }),

  api: baseErrorSchema.extend({
    type: z.literal('api'),
    statusCode: z.number()
  }),

  view: baseErrorSchema.extend({
    type: z.literal('view'),
    userMessage: z.string(),
    recoverable: z.boolean()
  })
} as const;

// Type inference helpers
export type BaseErrorType = z.infer<typeof ErrorSchemas.base>;
export type DomainErrorType = z.infer<typeof ErrorSchemas.domain>;
export type PersistenceErrorType = z.infer<typeof ErrorSchemas.persistence>;
export type ApiErrorType = z.infer<typeof ErrorSchemas.api>;
export type ViewErrorType = z.infer<typeof ErrorSchemas.view>;