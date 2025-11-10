import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { TeamService } from '../services/teamService';
import { PlayerService } from '../services/playerService';
import type { Api } from '@club/shared-types/api/team';
import type { Domain } from '@club/shared-types/domain/team';
import { TeamApiTransformer } from '../transformers/team';
import { PlayerApiTransformer } from '../transformers/player';

/**
 * Controller for Team entity operations
 * Thin layer that delegates to TeamService
 */
export class TeamController {
  /**
   * GET /teams
   * Get all teams with optional filtering
   */
  static async getAllTeams(
    req: Request<unknown, unknown, unknown, Api.TeamQueryParams>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { playerId, matchLevel } = req.query;

      let domainTeams: Domain.Team[];

      // If filtering by player, use specific method
      if (playerId) {
        domainTeams = await TeamService.getTeamsForPlayer(playerId);
      } else {
        domainTeams = await TeamService.getAllTeams({
          matchLevel
        });
      }

      const apiTeams = domainTeams.map((t: Domain.Team) => TeamApiTransformer.toApi(t));

      res.status(200).json({
        success: true,
        data: apiTeams
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /teams/:id
   * Get a specific team by ID
   */
  static async getTeamById(
    req: AuthenticatedRequest<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const domainTeam = await TeamService.getTeamById(req.params.id);

      if (!domainTeam) {
        res.status(404).json({
          success: false,
          error: 'Team not found'
        });
        return;
      }

      const apiTeam = TeamApiTransformer.toApi(domainTeam);

      res.status(200).json({
        success: true,
        data: apiTeam
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /teams
   * Create a new team
   */
  static async createTeam(
    req: Request<unknown, unknown, Api.CreateTeamRequest>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const domainTeam = await TeamService.createTeam(req.body);
      const apiTeam = TeamApiTransformer.toApi(domainTeam);

      res.status(201).json({
        success: true,
        data: apiTeam
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /teams/:id
   * Update an existing team
   */
  static async updateTeam(
    req: Request<{ id: string }, unknown, Api.UpdateTeamRequest>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const domainTeam = await TeamService.updateTeam(req.params.id, req.body);
      const apiTeam = TeamApiTransformer.toApi(domainTeam);

      res.status(200).json({
        success: true,
        data: apiTeam
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /teams/:id
   * Delete a team
   */
  static async deleteTeam(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await TeamService.deleteTeam(req.params.id);

      res.status(200).json({
        success: true,
        message: 'Team deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /teams/:teamId/players/:playerId
   * Add a player to a team
   * Delegates to PlayerService (player-centric operation)
   */
  static async addPlayerToTeam(
    req: Request<{ teamId: string; playerId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Delegate to PlayerService - player is the primary entity being modified
      const domainPlayer = await PlayerService.addPlayerToTeam(req.params.playerId, req.params.teamId);
      const apiPlayer = PlayerApiTransformer.toApi(domainPlayer);

      res.status(200).json({
        success: true,
        data: apiPlayer
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /teams/:teamId/players/:playerId
   * Remove a player from a team
   * Delegates to PlayerService (player-centric operation)
   */
  static async removePlayerFromTeam(
    req: Request<{ teamId: string; playerId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Delegate to PlayerService - player is the primary entity being modified
      const domainPlayer = await PlayerService.removePlayerFromTeam(req.params.playerId, req.params.teamId);
      const apiPlayer = PlayerApiTransformer.toApi(domainPlayer);

      res.status(200).json({
        success: true,
        data: apiPlayer
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /teams/:id/players
   * Get all players in a team
   */
  static async getTeamPlayers(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const players = await TeamService.getTeamPlayers(req.params.id);

      res.status(200).json({
        success: true,
        data: players
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /teams/:id/stats
   * Get team statistics (player counts, gender breakdown)
   */
  static async getTeamStats(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const stats = await TeamService.getTeamStats(req.params.id);

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
}