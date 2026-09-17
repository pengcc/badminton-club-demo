/**
 * Response Utilities
 *
 * Standardized API response helpers
 */

import type { Response } from 'express';

/**
 * Standard success response structure
 */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code?: string;
    details?: any;
  };
}

/**
 * Sends a standardized success response
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): void {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    ...(message && { message }),
  };

  res.status(statusCode).json(response);
}

/**
 * Sends a standardized error response
 */
export function sendError(
  res: Response,
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: any
): void {
  const response: ErrorResponse = {
    success: false,
    error: {
      message,
      ...(code && { code }),
      ...(details && { details }),
    },
  };

  res.status(statusCode).json(response);
}

/**
 * Sends a created response (201)
 */
export function sendCreated<T>(res: Response, data: T, message?: string): void {
  sendSuccess(res, data, message, 201);
}

/**
 * Sends a no content response (204)
 */
export function sendNoContent(res: Response): void {
  res.status(204).send();
}

/**
 * Sends a bad request error (400)
 */
export function sendBadRequest(
  res: Response,
  message: string,
  details?: any
): void {
  sendError(res, message, 400, 'BAD_REQUEST', details);
}

/**
 * Sends an unauthorized error (401)
 */
export function sendUnauthorized(
  res: Response,
  message: string = 'Unauthorized'
): void {
  sendError(res, message, 401, 'UNAUTHORIZED');
}

/**
 * Sends a forbidden error (403)
 */
export function sendForbidden(
  res: Response,
  message: string = 'Forbidden'
): void {
  sendError(res, message, 403, 'FORBIDDEN');
}

/**
 * Sends a not found error (404)
 */
export function sendNotFound(
  res: Response,
  resource: string = 'Resource'
): void {
  sendError(res, `${resource} not found`, 404, 'NOT_FOUND');
}

/**
 * Sends a conflict error (409)
 */
export function sendConflict(res: Response, message: string): void {
  sendError(res, message, 409, 'CONFLICT');
}

/**
 * Sends an internal server error (500)
 */
export function sendServerError(
  res: Response,
  message: string = 'Internal server error'
): void {
  sendError(res, message, 500, 'INTERNAL_SERVER_ERROR');
}
