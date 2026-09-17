import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { MembershipApplicantAccessService } from '../services/membershipApplicantAccessService';
import { AppError } from '../utils/errors';

export interface ApplicantRequest extends Request {
  applicantApplicationId: string;
  applicantSessionCookieNames: string[];
}

export async function requireApplicantSession(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const resolution =
      await MembershipApplicantAccessService.resolveSessionCookies(
        req.get('cookie')
      );
    MembershipApplicantAccessService.clearSessionCookies(
      res,
      resolution.clearCookieNames
    );
    if (!resolution.applicationId)
      throw AppError.unauthorized('Applicant session is invalid or expired');
    (req as ApplicantRequest).applicantApplicationId = resolution.applicationId;
    (req as ApplicantRequest).applicantSessionCookieNames =
      resolution.observedCookieNames;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireTrustedApplicantOrigin(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const expected = new URL(config.frontendUrl).origin;
  const origin = req.get('origin');
  if (!origin || origin !== expected) {
    next(AppError.forbidden('Untrusted request origin'));
    return;
  }
  next();
}
