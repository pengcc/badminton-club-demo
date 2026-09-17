// apps/api/src/middleware/errorHandler.ts
import type { Request, Response, NextFunction } from 'express';
import { MEMBERSHIP_APPLICATION_SUBMISSION_VALIDATION_ERROR_CODE } from '@club/shared-types/api/membershipApplication';
import { AppError, RequiredAuditPersistenceError } from '../utils/errors';

// Only fixed first-segment families may enter diagnostics. Unknown API segments
// (including credentials or identifiers) collapse to api:other; never echo a path.
const apiFamilies = new Set([
  'auth',
  'users',
  'players',
  'teams',
  'matches',
  'content',
  'club-information',
  'membership',
  'taster-session-requests',
  'guest-play',
  'email-templates',
  'settings',
  'team-public-content',
  'audit',
  'announcements',
  'locations',
  'activities',
  'contact-entries',
  'public-documents',
  'taster-session-content',
  'membership-content',
  'recruitment-content',
  'membership-terminations',
  'demo-editing',
  'health',
  'ready',
]);

const requestFamily = (requestPath: string): string => {
  const [, root, family] = requestPath.toLowerCase().split('/');
  if (root === 'api') {
    return family && apiFamilies.has(family) ? `api:${family}` : 'api:other';
  }
  return root === 'uploads' ? 'uploads' : 'web';
};

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const requiredAuditFailure =
    err instanceof RequiredAuditPersistenceError ? err : undefined;
  const statusCode =
    err instanceof AppError
      ? err.statusCode
      : err.name === 'ValidationError' || err.name === 'CastError'
        ? 400
        : 500;
  console.error('API request failed', {
    operation: requiredAuditFailure?.operation ?? requestFamily(req.path),
    method: req.method,
    statusCode,
    reasonCode:
      err instanceof AppError ? err.code : err.name || 'UNKNOWN_ERROR',
    ...(requiredAuditFailure
      ? {
          eventType: requiredAuditFailure.eventType,
          entityType: requiredAuditFailure.entityType,
          entityId: requiredAuditFailure.entityId,
        }
      : {}),
  });

  if (err instanceof AppError) {
    return res.status(statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      ...((err.code === 'LINEUP_VALIDATION_FAILED' ||
        err.code === 'TASTER_SESSION_STATE_CONFLICT' ||
        err.code === MEMBERSHIP_APPLICATION_SUBMISSION_VALIDATION_ERROR_CODE) &&
      err.details
        ? { details: err.details }
        : {}),
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(statusCode).json({
      success: false,
      error: 'Validation Error',
      details: err.message,
    });
  }

  if (err.name === 'CastError') {
    return res.status(statusCode).json({
      success: false,
      error: 'Invalid ID format',
    });
  }

  // Default error
  res.status(statusCode).json({
    success: false,
    error: 'Internal Server Error',
  });
};
