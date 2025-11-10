import type { RequestHandler, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';

export type AuthRequestHandler = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => Promise<void> | void;

export const asHandler = (handler: AuthRequestHandler): RequestHandler => {
  return async (req, res, next) => {
    try {
      await handler(req as AuthenticatedRequest, res, next);
    } catch (error) {
      next(error);
    }
  };
};