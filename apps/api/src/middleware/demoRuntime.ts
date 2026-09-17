import type { RequestHandler } from 'express';
import { AppError } from '../utils/errors';
import { DemoRuntimePolicyService } from '../services/demoRuntimePolicyService';

export const enforceDemoMutationFirewall: RequestHandler = (
  req,
  _res,
  next
) => {
  if (
    !DemoRuntimePolicyService.permitsPublicMutation(req.method, req.originalUrl)
  ) {
    return next(
      new AppError(
        'This action is unavailable in the public demo',
        403,
        'DEMO_ACTION_UNAVAILABLE'
      )
    );
  }
  next();
};
