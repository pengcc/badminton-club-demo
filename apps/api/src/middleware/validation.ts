import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/errors';

/**
 * Request validation configuration
 */
interface ValidateConfig {
  body?: z.Schema;
  query?: z.Schema;
  params?: z.Schema;
}

/**
 * Middleware for validating requests using Zod schemas
 */
export const validateRequest = (config: ValidateConfig): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (config.body) {
        req.body = await config.body.parseAsync(req.body);
      }
      if (config.query) {
        // Express 5 exposes req.query as a getter, so parsed query values must
        // be passed forward without assigning back to the request property.
        res.locals.validatedQuery = await config.query.parseAsync(req.query);
      }
      if (config.params) {
        req.params = (await config.params.parseAsync(req.params)) as any;
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        next(
          new AppError(error.issues.map((err) => err.message).join(', '), 400)
        );
      } else {
        next(error);
      }
    }
  };
};
