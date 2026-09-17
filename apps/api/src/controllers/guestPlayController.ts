import type { NextFunction, Response } from 'express';
import type {
  CreateGuestPlayRequest,
  GuestPlayCorrectionCommand,
  GuestPlayDecisionCommand,
  GuestPlayListQuery,
  GuestPlayLocale,
} from '@club/shared-types/api/guestPlay';
import type { AuthenticatedRequest } from '../middleware/auth';
import { GuestPlayService } from '../services/guestPlayService';
import { GuestPlayOpportunityService } from '../services/guestPlayOpportunityService';
import { GuestPlayNotificationService } from '../services/guestPlayNotificationService';
import { GuestPlayApiTransformer } from '../transformers/guestPlay';
import { AppError } from '../utils/errors';

function actor(req: AuthenticatedRequest) {
  return {
    id: req.user.id,
    email: req.user.email,
    accountKind: req.user.accountKind,
    displayName: req.user.displayName,
    capabilities: req.user.capabilities,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };
}

export class GuestPlayController {
  static async opportunities(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { locale } = res.locals.validatedQuery as {
        locale: GuestPlayLocale;
      };
      res.json({
        success: true,
        data: await GuestPlayOpportunityService.list(locale),
      });
    } catch (error) {
      next(error);
    }
  }

  static async createRequest(
    req: AuthenticatedRequest<CreateGuestPlayRequest>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user.firstName || !req.user.lastName) {
        throw AppError.forbidden('Guest Play requires a person account');
      }
      const created = await GuestPlayService.createRequest(req.body, {
        ...req.user,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
      });
      res.status(201).json({
        success: true,
        data: GuestPlayApiTransformer.toMemberResponse(created),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMyRequests(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const requests = await GuestPlayService.getMyRequests(req.user.id);
      res.json({
        success: true,
        data: requests.map(GuestPlayApiTransformer.toMemberResponse),
      });
    } catch (error) {
      next(error);
    }
  }

  static async cancelOwnRequest(
    req: AuthenticatedRequest<
      { expectedVersion: number },
      unknown,
      { id: string }
    >,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const updated = await GuestPlayService.cancelOwnRequest(
        req.params.id,
        req.user.id,
        req.body.expectedVersion
      );
      res.json({
        success: true,
        data: GuestPlayApiTransformer.toMemberResponse(updated),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAllRequests(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await GuestPlayService.getAllRequests(
        res.locals.validatedQuery as GuestPlayListQuery
      );
      res.json({
        success: true,
        data: {
          ...result,
          requests: result.requests.map(
            GuestPlayApiTransformer.toAdminResponse
          ),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  static async getStats(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      res.json({ success: true, data: await GuestPlayService.getStats() });
    } catch (error) {
      next(error);
    }
  }

  static async getRequestById(
    req: AuthenticatedRequest<unknown, unknown, { id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const request = await GuestPlayService.getRequestById(req.params.id);
      res.json({
        success: true,
        data: GuestPlayApiTransformer.toAdminResponse(request),
      });
    } catch (error) {
      next(error);
    }
  }

  static async decide(
    req: AuthenticatedRequest<
      GuestPlayDecisionCommand,
      unknown,
      { id: string }
    >,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const updated = await GuestPlayService.decide(
        req.params.id,
        actor(req),
        req.body
      );
      res.json({
        success: true,
        data: GuestPlayApiTransformer.toAdminResponse(updated),
      });
    } catch (error) {
      next(error);
    }
  }

  static async correctDecision(
    req: AuthenticatedRequest<
      GuestPlayCorrectionCommand,
      unknown,
      { id: string }
    >,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const updated = await GuestPlayService.correctDecision(
        req.params.id,
        actor(req),
        req.body
      );
      res.json({
        success: true,
        data: GuestPlayApiTransformer.toAdminResponse(updated),
      });
    } catch (error) {
      next(error);
    }
  }

  static async archive(
    req: AuthenticatedRequest<
      { expectedVersion: number },
      unknown,
      { id: string }
    >,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const updated = await GuestPlayService.setArchived(
        req.params.id,
        actor(req),
        req.body.expectedVersion,
        true
      );
      res.json({
        success: true,
        data: GuestPlayApiTransformer.toAdminResponse(updated),
      });
    } catch (error) {
      next(error);
    }
  }

  static async restore(
    req: AuthenticatedRequest<
      { expectedVersion: number },
      unknown,
      { id: string }
    >,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const updated = await GuestPlayService.setArchived(
        req.params.id,
        actor(req),
        req.body.expectedVersion,
        false
      );
      res.json({
        success: true,
        data: GuestPlayApiTransformer.toAdminResponse(updated),
      });
    } catch (error) {
      next(error);
    }
  }

  static async retryNotification(
    req: AuthenticatedRequest<
      {
        expectedVersion: number;
        notification: 'memberReceipt' | 'administratorAlert' | 'decisionEmail';
      },
      unknown,
      { id: string }
    >,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const updated = await GuestPlayNotificationService.retry(
        req.params.id,
        req.body.notification,
        req.body.expectedVersion
      );
      res.json({
        success: true,
        data: GuestPlayApiTransformer.toAdminResponse(updated),
      });
    } catch (error) {
      next(error);
    }
  }
}
