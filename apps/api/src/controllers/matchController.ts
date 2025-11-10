import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { MatchService } from '../services/matchService';
import type { Api } from '@club/shared-types/api/match';
import type { Domain } from '@club/shared-types/domain/match';
import { MatchApiTransformer } from '../transformers/match';

/**
 * Controller for Match entity operations
 * Thin layer that delegates to MatchService
 */
export class MatchController {
  /**
   * GET /matches
   * Get matches based on user role and team affiliations
   */
  static async getMatches(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      let domainMatches: Domain.Match[];

      domainMatches = await MatchService.getAllMatches();

      const apiMatches = domainMatches.map((m: Domain.Match) => MatchApiTransformer.toApi(m));

      res.status(200).json({
        success: true,
        data: apiMatches
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /matches/:id
   * Get a specific match by ID
   */
  static async getMatchById(
    req: AuthenticatedRequest<unknown, Api.MatchUrlParams>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const domainMatch = await MatchService.getMatchById(req.params.id);

      if (!domainMatch) {
        res.status(404).json({
          success: false,
          error: 'Match not found'
        });
        return;
      }

      const apiMatch = MatchApiTransformer.toApi(domainMatch);

      res.status(200).json({
        success: true,
        data: apiMatch
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /matches
   * Create a new match
   */
  static async createMatch(
    req: Request<unknown, unknown, Api.CreateMatchRequest>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Add createdById from authenticated user
      const requestBody: Api.CreateMatchRequest = {
        ...req.body,
        createdById: (req as any).user.id // user.id is a string
      };

      const domainMatch = await MatchService.createMatch(requestBody);
      const apiMatch = MatchApiTransformer.toApi(domainMatch);

      res.status(201).json({
        success: true,
        data: apiMatch
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /matches/:id
   * Update an existing match
   */
  static async updateMatch(
    req: Request<{ id: string }, unknown, Api.UpdateMatchRequest>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const domainMatch = await MatchService.updateMatch(req.params.id, req.body);
      const apiMatch = MatchApiTransformer.toApi(domainMatch);

      res.status(200).json({
        success: true,
        data: apiMatch
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /matches/:id
   * Delete a match
   */
  static async deleteMatch(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await MatchService.deleteMatch(req.params.id);

      res.status(200).json({
        success: true,
        message: 'Match deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /matches/:id/lineup
   * Update match lineup
   */
  static async updateLineup(
    req: Request<{ id: string }, unknown, { lineup: Record<string, Array<{ id: string }>> | Array<{ position: string; playerId: string | null }> }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      let lineupArray: Array<{ position: string; playerId: string | null }>;

      // Convert Record format to Array format if needed
      if (Array.isArray(req.body.lineup)) {
        // Already in array format
        lineupArray = req.body.lineup;
      } else {
        // Convert Record<position, player[]> to Array<{position, playerId}>
        lineupArray = [];
        Object.entries(req.body.lineup).forEach(([position, players]) => {
          if (Array.isArray(players) && players.length > 0) {
            // For each player in this position
            players.forEach((player: any) => {
              lineupArray.push({
                position,
                playerId: player.id || null
              });
            });
          }
        });
      }

      console.log('📋 Processing lineup update:', {
        matchId: req.params.id,
        receivedFormat: Array.isArray(req.body.lineup) ? 'array' : 'record',
        convertedArray: lineupArray
      });

      const domainMatch = await MatchService.updateLineup(
        req.params.id,
        lineupArray as any
      );
      const apiMatch = MatchApiTransformer.toApi(domainMatch);

      res.status(200).json({
        success: true,
        data: apiMatch
      });
    } catch (error) {
      console.error('❌ Error updating lineup:', error);
      next(error);
    }
  }

  /**
   * PUT /matches/:id/score
   * Update match score
   */
  static async updateScore(
    req: Request<{ id: string }, unknown, { homeScore: number; awayScore: number }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { homeScore, awayScore } = req.body;
      const domainMatch = await MatchService.updateScore(
        req.params.id,
        homeScore,
        awayScore
      );
      const apiMatch = MatchApiTransformer.toApi(domainMatch);

      res.status(200).json({
        success: true,
        data: apiMatch
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /matches/:id/status
   * Update match status
   */
  static async updateStatus(
    req: Request<{ id: string }, unknown, { status: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const domainMatch = await MatchService.updateStatus(
        req.params.id,
        req.body.status as any
      );
      const apiMatch = MatchApiTransformer.toApi(domainMatch);

      res.status(200).json({
        success: true,
        data: apiMatch
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /matches/:id/availability/:playerId
   * Toggle player availability for a match
   */
  static async togglePlayerAvailability(
    req: AuthenticatedRequest<{ isAvailable: boolean; note?: string }, { id: string; playerId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id: matchId, playerId } = req.params;
      const { isAvailable } = req.body;

      const domainMatch = await MatchService.togglePlayerAvailability(
        matchId,
        playerId,
        isAvailable
      );
      const apiMatch = MatchApiTransformer.toApi(domainMatch);

      res.status(200).json({
        success: true,
        data: apiMatch
      });
    } catch (error) {
      next(error);
    }
  }

  // Note: syncPlayerAvailability removed - auto-sync now happens in PlayerService/UserService
}