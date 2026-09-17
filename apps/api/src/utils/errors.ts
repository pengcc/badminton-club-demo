import { mongo } from 'mongoose';

export interface ErrorDetails {
  [key: string]: unknown;
}

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public code: string = 'INTERNAL_ERROR',
    public details?: ErrorDetails
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }

  static notFound(
    message = 'Resource not found',
    details?: ErrorDetails
  ): AppError {
    return new AppError(message, 404, 'NOT_FOUND', details);
  }

  static badRequest(message: string, details?: ErrorDetails): AppError {
    return new AppError(message, 400, 'VALIDATION_ERROR', details);
  }

  static unauthorized(
    message = 'Unauthorized',
    details?: ErrorDetails
  ): AppError {
    return new AppError(message, 401, 'UNAUTHORIZED', details);
  }

  static forbidden(message = 'Forbidden', details?: ErrorDetails): AppError {
    return new AppError(message, 403, 'FORBIDDEN', details);
  }

  static conflict(message: string, details?: ErrorDetails): AppError {
    return new AppError(message, 409, 'CONFLICT', details);
  }

  static validation(message: string, details?: ErrorDetails): AppError {
    return new AppError(message, 400, 'VALIDATION_ERROR', details);
  }

  static lineupValidation(details: ErrorDetails): AppError {
    return new AppError(
      'Lineup violates current Match rules',
      400,
      'LINEUP_VALIDATION_FAILED',
      details
    );
  }

  static internal(
    message = 'Internal Server Error',
    details?: ErrorDetails
  ): AppError {
    return new AppError(message, 500, 'INTERNAL_ERROR', details);
  }
}

export class RequiredAuditPersistenceError extends mongo.MongoError {
  readonly operation = 'audit_write_required';

  override get name(): string {
    return 'RequiredAuditPersistenceError';
  }

  constructor(
    public readonly eventType: string,
    public readonly entityType: string,
    public readonly entityId?: string,
    persistenceError?: unknown
  ) {
    super('Required Audit persistence failed');
    if (persistenceError instanceof mongo.MongoError) {
      for (const label of persistenceError.errorLabels) {
        this.addErrorLabel(label);
      }
    }
    Error.captureStackTrace(this, this.constructor);
  }
}
