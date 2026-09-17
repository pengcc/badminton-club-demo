import type { NextFunction, Request, Response } from 'express';
import type {
  CreateTasterSessionRequest,
  TasterSessionDispositionCommand,
  TasterSessionListQuery,
  TasterSessionPlayerLevel,
  TasterSessionLocale,
} from '@club/shared-types/api/tasterSessionRequest';
import type { AuthenticatedRequest } from '../middleware/auth';
import { TasterSessionRequestService } from '../services/tasterSessionRequestService';
import { TasterSessionPreferencePolicy } from '../services/tasterSessionPreferencePolicy';

export class TasterSessionRequestController {
  static async preferences(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { playerLevel, locale } = res.locals.validatedQuery as {
        playerLevel: TasterSessionPlayerLevel;
        locale: TasterSessionLocale;
      };
      res.json({
        success: true,
        data: await TasterSessionPreferencePolicy.listOptions(
          playerLevel,
          locale
        ),
      });
    } catch (error) {
      next(error);
    }
  }

  static async create(
    req: Request<unknown, unknown, CreateTasterSessionRequest>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      res.status(201).json({
        success: true,
        data: await TasterSessionRequestService.create(req.body),
      });
    } catch (error) {
      next(error);
    }
  }

  static async list(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      res.json({
        success: true,
        data: await TasterSessionRequestService.list(
          res.locals.validatedQuery as TasterSessionListQuery
        ),
      });
    } catch (error) {
      next(error);
    }
  }

  static async stats(
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      res.json({
        success: true,
        data: await TasterSessionRequestService.stats(),
      });
    } catch (error) {
      next(error);
    }
  }

  static async get(
    req: AuthenticatedRequest<unknown, unknown, { id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      res.json({
        success: true,
        data: await TasterSessionRequestService.get(req.params.id),
      });
    } catch (error) {
      next(error);
    }
  }

  static async dispose(
    req: AuthenticatedRequest<
      TasterSessionDispositionCommand,
      unknown,
      { id: string }
    >,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      res.json({
        success: true,
        data: await TasterSessionRequestService.dispose(
          req.params.id,
          req.user!.id,
          req.body
        ),
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
      res.json({
        success: true,
        data: await TasterSessionRequestService.setArchived(
          req.params.id,
          req.user!.id,
          req.body.expectedVersion,
          true
        ),
      });
    } catch (error) {
      next(error);
    }
  }

  static async unarchive(
    req: AuthenticatedRequest<
      { expectedVersion: number },
      unknown,
      { id: string }
    >,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      res.json({
        success: true,
        data: await TasterSessionRequestService.setArchived(
          req.params.id,
          req.user!.id,
          req.body.expectedVersion,
          false
        ),
      });
    } catch (error) {
      next(error);
    }
  }

  static async retryDelivery(
    req: AuthenticatedRequest<
      { expectedVersion: number },
      unknown,
      { id: string }
    >,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      res.json({
        success: true,
        data: await TasterSessionRequestService.retryDelivery(
          req.params.id,
          req.body.expectedVersion
        ),
      });
    } catch (error) {
      next(error);
    }
  }
}
