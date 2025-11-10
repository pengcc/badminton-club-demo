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

  static notFound(message = 'Resource not found', details?: ErrorDetails): AppError {
    return new AppError(message, 404, 'NOT_FOUND', details);
  }

  static badRequest(message: string, details?: ErrorDetails): AppError {
    return new AppError(message, 400, 'VALIDATION_ERROR', details);
  }

  static unauthorized(message = 'Unauthorized', details?: ErrorDetails): AppError {
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

  static internal(message = 'Internal Server Error', details?: ErrorDetails): AppError {
    return new AppError(message, 500, 'INTERNAL_ERROR', details);
  }
}