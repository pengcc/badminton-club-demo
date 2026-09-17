import type { NextFunction, Response } from 'express';
import type { Api } from '@club/shared-types/api/match';
import { Capability, MatchListView } from '@club/shared-types/core/enums';
import type { AuthenticatedRequest } from '../middleware/auth';
import { MatchApiTransformer } from '../transformers/match';
import { AppError } from '../utils/errors';
import { MatchService, type MatchCommandActor } from '../services/matchService';
import { MatchAvailabilityService } from '../services/matchAvailabilityService';
import { MatchLineupService } from '../services/matchLineupService';
import { MatchCsvImportService } from '../services/matchCsvImportService';
import { DemoRuntimePolicyService } from '../services/demoRuntimePolicyService';
import { DemoEditingService } from '../services/demoEditingService';

async function demoLeaseFromRequest(
  req: AuthenticatedRequest
): Promise<string | undefined> {
  return DemoRuntimePolicyService.isDemoAdmin(req.user)
    ? DemoEditingService.activeLeaseForOwner(req.authSession.id)
    : undefined;
}

function actorFromRequest(req: AuthenticatedRequest): MatchCommandActor {
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

export class MatchController {
  static async getMatches(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const view =
        (res.locals.validatedQuery?.view as MatchListView | undefined) ??
        MatchListView.ALL;
      const isAdministrator = req.user.capabilities.includes(
        Capability.ADMINISTRATION
      );
      const matches = isAdministrator
        ? await MatchService.getAllMatches({
            view,
            demoScratchLeaseId: await demoLeaseFromRequest(req),
          })
        : await MatchService.getMatchesForUser(req.user.id, { view });

      res.status(200).json({
        success: true,
        data: matches.map(MatchApiTransformer.toApi),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getMatchById(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = req.params.id as string;
      const isAdministrator = req.user.capabilities.includes(
        Capability.ADMINISTRATION
      );
      const match = isAdministrator
        ? await MatchService.getMatchById(id, await demoLeaseFromRequest(req))
        : await MatchService.getMatchByIdForUser(id, req.user.id);
      if (!match) throw AppError.notFound('Match not found');

      res.status(200).json({
        success: true,
        data: MatchApiTransformer.toDetail(
          match,
          await MatchLineupService.getWarnings(match)
        ),
      });
    } catch (error) {
      next(error);
    }
  }

  static async createMatch(
    req: AuthenticatedRequest<Api.CreateMatchRequest>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const match = await MatchService.createMatch(
        req.body,
        actorFromRequest(req),
        DemoRuntimePolicyService.isDemoAdmin(req.user)
          ? { authSessionId: req.authSession.id }
          : undefined
      );
      res.status(201).json({
        success: true,
        data: MatchApiTransformer.toApi(match),
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateMatch(
    req: AuthenticatedRequest<Api.UpdateMatchRequest>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const match = await MatchService.updateMatch(
        req.params.id as string,
        req.body,
        actorFromRequest(req),
        new Date(),
        DemoRuntimePolicyService.isDemoAdmin(req.user)
          ? { authSessionId: req.authSession.id }
          : undefined
      );
      res.status(200).json({
        success: true,
        data: MatchApiTransformer.toApi(match),
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteMatch(
    req: AuthenticatedRequest<Api.DeleteMatchRequest>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await MatchService.deleteMatch(
        req.params.id as string,
        req.body,
        actorFromRequest(req)
      );
      res.status(200).json({
        success: true,
        message: 'Match deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  static async setResult(
    req: AuthenticatedRequest<Api.SetMatchResultRequest>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const match = await MatchService.setResult(
        req.params.id as string,
        req.body,
        actorFromRequest(req)
      );
      res.status(200).json({
        success: true,
        data: MatchApiTransformer.toApi(match),
      });
    } catch (error) {
      next(error);
    }
  }

  static async getLineupContext(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        data: await MatchLineupService.getContext(req.params.id as string),
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateLineup(
    req: AuthenticatedRequest<Api.SetMatchLineupRequest>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await MatchLineupService.setLineup(
        req.params.id as string,
        req.body
      );
      res.status(200).json({
        success: true,
        data: MatchApiTransformer.toDetail(result.match, result.warnings),
      });
    } catch (error) {
      next(error);
    }
  }

  static async setOwnAvailability(
    req: AuthenticatedRequest<
      Api.SetOwnMatchAvailabilityRequest,
      unknown,
      { id: string }
    >,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const match = await MatchAvailabilityService.setOwnAvailability(
        req.params.id,
        req.body,
        {
          userId: req.user.id,
          playerId: req.user.playerId,
        }
      );
      res.status(200).json({
        success: true,
        data: MatchApiTransformer.toApi(match),
      });
    } catch (error) {
      next(error);
    }
  }

  static async setPlayerAvailability(
    req: AuthenticatedRequest<
      Api.SetPlayerMatchAvailabilityRequest,
      unknown,
      { id: string; playerId: string }
    >,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const match = await MatchAvailabilityService.setPlayerAvailability(
        req.params.id,
        req.params.playerId,
        req.body
      );
      res.status(200).json({
        success: true,
        data: MatchApiTransformer.toApi(match),
      });
    } catch (error) {
      next(error);
    }
  }

  static async importFromCSV(
    req: AuthenticatedRequest<Api.MatchCsvImportFields>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError(
          'Match CSV file is required',
          400,
          'MATCH_CSV_FILE_REQUIRED'
        );
      }
      const result = await MatchCsvImportService.import(
        req.file.buffer,
        req.body.teamId,
        actorFromRequest(req)
      );
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
}
