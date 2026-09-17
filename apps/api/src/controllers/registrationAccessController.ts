import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { RegistrationAccessService } from '../services/registrationAccessService';
import type { RegistrationAccessExpiryMode } from '../models/RegistrationAccess';

export class RegistrationAccessController {
  static async getAdminState(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      res.set('Cache-Control', 'no-store');
      res.status(200).json({
        success: true,
        data: await RegistrationAccessService.getAdminState(),
      });
    } catch (error) {
      next(error);
    }
  }

  static async generate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const data = await RegistrationAccessService.issue(
        req.body.expiryMode as RegistrationAccessExpiryMode,
        req.user.id,
        true
      );
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async rotate(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const data = await RegistrationAccessService.issue(
        req.body.expiryMode as RegistrationAccessExpiryMode,
        req.user.id,
        false
      );
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async validate(req: Request, res: Response, next: NextFunction) {
    try {
      const valid = await RegistrationAccessService.validate(
        RegistrationAccessService.requireTokenHeader(req.headers)
      );
      if (!valid) {
        res
          .status(404)
          .json({ success: false, error: 'Registration is unavailable' });
        return;
      }
      res.status(200).json({ success: true, data: { valid: true } });
    } catch (error) {
      next(error);
    }
  }
}
