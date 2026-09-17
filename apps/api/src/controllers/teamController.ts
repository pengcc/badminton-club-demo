import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { TeamService } from '../services/teamService';
import { Team } from '../models/Team';
import { AuditService } from '../services/auditService';
import { AuditEventType, EntityType } from '@club/shared-types/core/enums';
import type { Api } from '@club/shared-types/api/team';
import type { Domain } from '@club/shared-types/domain/team';
import { TeamApiTransformer } from '../transformers/team';
import { teamMatchLevelSchema } from '@club/shared-types/schemas/team';

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
          matchLevel,
        });
      }

      const apiTeams = domainTeams.map((t: Domain.Team) =>
        TeamApiTransformer.toApi(t)
      );

      res.status(200).json({
        success: true,
        data: apiTeams,
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
          error: 'Team not found',
        });
        return;
      }

      const apiTeam = TeamApiTransformer.toApi(domainTeam);

      res.status(200).json({
        success: true,
        data: apiTeam,
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
    req: AuthenticatedRequest<Api.CreateTeamRequest>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const domainTeam = await TeamService.createTeam(req.body, req.user.id);
      const apiTeam = TeamApiTransformer.toApi(domainTeam);

      // Audit log: Team created
      AuditService.writeBestEffort({
        eventType: AuditEventType.TEAM_CREATED,
        entityType: EntityType.TEAM,
        entityId: domainTeam.id,
        actor: {
          id: req.user.id,
          accountKind: req.user.accountKind,
        },
        changes: [
          { field: 'shortName', newValue: domainTeam.shortName },
          { field: 'leagueTeamName', newValue: domainTeam.leagueTeamName },
          { field: 'matchLevel', newValue: domainTeam.matchLevel },
        ],
      });

      res.status(201).json({
        success: true,
        data: apiTeam,
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
    req: AuthenticatedRequest<Api.UpdateTeamRequest, unknown, { id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const domainTeam = await TeamService.updateTeam(req.params.id, req.body);
      const apiTeam = TeamApiTransformer.toApi(domainTeam);

      // Audit log: Team updated
      AuditService.writeBestEffort({
        eventType: AuditEventType.TEAM_UPDATED,
        entityType: EntityType.TEAM,
        entityId: req.params.id,
        actor: {
          id: req.user.id,
          accountKind: req.user.accountKind,
        },
        changes: Object.keys(req.body).map((field) => ({ field })),
      });

      res.status(200).json({
        success: true,
        data: apiTeam,
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
    req: AuthenticatedRequest<unknown, unknown, { id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await TeamService.deleteTeam(req.params.id, {
        id: req.user.id,
        accountKind: req.user.accountKind,
      });

      res.status(200).json({
        success: true,
        message: 'Team deleted successfully',
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
        data: players,
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
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /teams/public
   * Get all teams for public display (no auth required)
   * Returns only public-facing fields
   */
  static async getPublicTeams(req: Request, res: Response): Promise<void> {
    try {
      const teams = await Team.find({}, 'shortName leagueTeamName matchLevel')
        .sort({ teamId: 1 })
        .lean();

      const publicTeams = teams.map((t) => ({
        shortName: t.shortName,
        leagueTeamName: t.leagueTeamName,
        matchLevel: teamMatchLevelSchema.parse(t.matchLevel),
      }));

      res.status(200).json({ success: true, data: publicTeams });
    } catch {
      console.error('Public Team retrieval failed');
      res.status(500).json({
        success: false,
        error: 'Failed to fetch teams',
      });
    }
  }
}
