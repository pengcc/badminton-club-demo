import type { Request, Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import {
  MAX_PLAYER_BATCH_SIZE,
  PlayerService,
} from '../services/playerService';
import { AuditService } from '../services/auditService';
import {
  AuditEventType,
  EntityType,
  Capability,
} from '@club/shared-types/core/enums';
import { MembershipLifecycleOperation } from '@club/shared-types/domain/membershipLifecycle';
import type { Api } from '@club/shared-types/api/player';
import { User } from '../models/User';
import { membershipLifecycleService } from '../services/membershipLifecycleService';
import { PlayerLifecycleAdministrationService } from '../services/playerLifecycleAdministrationService';
import { PlayerCleanupService } from '../services/playerCleanupService';
import { AppError } from '../utils/errors';

function lifecycleActor(req: Request) {
  const user = (req as any).user;
  return {
    id: user.id,
    email: user.email,
    accountKind: user.accountKind,
    displayName: user.displayName,
    capabilities: user.capabilities,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };
}

function lifecycleCommandContext(req: Request, subjectId: string) {
  const supplied = req.get('idempotency-key');
  if (!supplied?.trim()) {
    throw AppError.validation(
      'Idempotency-Key header is required for membership lifecycle changes'
    );
  }
  return {
    actor: lifecycleActor(req),
    idempotencyKey: `${supplied.trim()}:player-eligibility:${subjectId}`,
  };
}

async function setPlayerEligibility(
  req: Request,
  playerId: string,
  eligible: boolean
) {
  const player = await PlayerService.getPlayerById(playerId);
  if (!player) throw AppError.notFound('Player not found');
  const user = await User.findById(player.userId);
  if (!user) throw AppError.notFound('User not found');
  const context = lifecycleCommandContext(req, playerId);
  await membershipLifecycleService.execute({
    operation: MembershipLifecycleOperation.SET_PLAYER_ELIGIBILITY,
    userId: user._id.toString(),
    expectedMembershipStatus: user.membershipStatus,
    eligible,
    actor: context.actor,
    reason: eligible
      ? 'Administrative Player participation enablement'
      : 'Administrative Player participation deactivation',
    idempotencyKey: context.idempotencyKey,
    occurredAt: new Date(),
  });
  return PlayerService.getPlayerById(playerId);
}

function projectPlayerForViewer(
  req: AuthenticatedRequest,
  player: Api.PlayerResponse
): Api.PlayerResponse {
  const isAdministrator = req.user.capabilities.includes(
    Capability.ADMINISTRATION
  );
  if (isAdministrator) return player;

  const {
    accountSetup: _accountSetup,
    passwordRecoveryAvailable: _passwordRecoveryAvailable,
    ...publicPlayer
  } = player;
  const canViewMemberDetails = req.user.capabilities.some((capability) =>
    [Capability.CURRENT_MEMBER].includes(capability)
  );
  return canViewMemberDetails
    ? publicPlayer
    : { ...publicPlayer, userEmail: '' };
}

/**
 * Controller for Player entity operations
 * Handles CRUD and query operations for players
 */
export class PlayerController {
  static async getLifecycleCandidates(
    _req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        data: await PlayerLifecycleAdministrationService.listCandidates(),
      });
    } catch (error) {
      next(error);
    }
  }

  static async batchLifecycle(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const supplied = req.get('idempotency-key')?.trim();
      if (!supplied) {
        throw AppError.validation('Idempotency-Key header is required');
      }
      const result = await PlayerLifecycleAdministrationService.executeBatch({
        ...(req.body as Api.PlayerLifecycleBatchRequest),
        idempotencyKey: supplied,
        actor: lifecycleActor(req),
      });
      res.status(200).json({ success: result.success, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async convertFormerMemberToExternal(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const supplied = req.get('idempotency-key')?.trim();
      if (!supplied) {
        throw AppError.validation('Idempotency-Key header is required');
      }
      const player =
        await PlayerLifecycleAdministrationService.convertFormerMemberToExternal(
          {
            playerId: req.params.id,
            reason: req.body.reason,
            idempotencyKey: supplied,
            actor: lifecycleActor(req),
          }
        );
      res.status(200).json({ success: true, data: player });
    } catch (error) {
      next(error);
    }
  }

  static async cleanupPlayer(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await PlayerCleanupService.cleanupPlayer({
        playerId: req.params.id,
        reason: req.body.reason,
        actor: lifecycleActor(req),
      });
      res.status(200).json({
        success: true,
        data: result,
        message: 'Player record permanently cleaned up',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /players
   * List all players with user info
   */
  static async getAllPlayers(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const authenticatedRequest = req as AuthenticatedRequest;
      const isAdministrator = authenticatedRequest.user.capabilities.includes(
        Capability.ADMINISTRATION
      );
      const players =
        await PlayerService.getAllPlayersWithUserInfo(isAdministrator);

      const response = {
        success: true,
        data: players.map((player) =>
          projectPlayerForViewer(authenticatedRequest, player)
        ),
      } satisfies Api.PlayerListResponse;

      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /players/:id
   * Get player by ID with user info
   */
  static async getPlayerById(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const player = await PlayerService.getPlayerByIdWithUserInfo(id);

      if (!player) {
        res.status(404).json({
          success: false,
          error: 'Player not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: projectPlayerForViewer(req as AuthenticatedRequest, player),
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /players/user/:userId
   * Get player by user ID
   */
  static async getPlayerByUserId(
    req: Request<{ userId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { userId } = req.params;
      const player = await PlayerService.getPlayerByUserId(userId);

      if (!player) {
        res.status(404).json({
          success: false,
          error: 'Player not found for this user',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: player,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /players/team/:teamId
   * Get active players for a team
   */
  static async getPlayersByTeam(
    req: Request<{ teamId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { teamId } = req.params;
      const players = await PlayerService.getActivePlayersForTeam(teamId);

      res.status(200).json({
        success: true,
        data: players,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /players/active
   * Get all active players
   */
  static async getActivePlayers(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const players = await PlayerService.getActivePlayers();

      res.status(200).json({
        success: true,
        data: players,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /players/:id
   * Update player sports data
   */
  static async updatePlayer(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const updates: Api.UpdatePlayerRequest = req.body;

      if ((updates as Record<string, unknown>).isActivePlayer !== undefined) {
        throw AppError.validation(
          'Use the Player active-status endpoint for eligibility changes'
        );
      }

      const updatedPlayer = await PlayerService.updatePlayerSportsData(
        id,
        updates
      );

      // Audit log: Player updated
      AuditService.writeBestEffort({
        eventType: AuditEventType.PLAYER_UPDATED,
        entityType: EntityType.PLAYER,
        entityId: id,
        actor: {
          id: req.user!.id,
          accountKind: req.user!.accountKind,
        },
        changes: Object.keys(updates).map((field) => ({ field })),
      });

      res.status(200).json({
        success: true,
        data: updatedPlayer,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /players/:id/active-status
   * Toggle player's active status (for sport participation, not existence)
   * Updates Player.isActivePlayer field only
   * Does NOT affect User.isPlayer or Player entity existence
   */
  static async updatePlayerStatus(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;
      const { isActivePlayer } = req.body;

      if (typeof isActivePlayer !== 'boolean') {
        res.status(400).json({
          success: false,
          error: 'isActivePlayer must be a boolean value',
        });
        return;
      }

      const updatedPlayer = await setPlayerEligibility(req, id, isActivePlayer);

      res.status(200).json({
        success: true,
        data: updatedPlayer,
        message: `Player ${isActivePlayer ? 'activated' : 'deactivated'} successfully`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /players/:id
   * Preserve Player identity while ending sporting participation
   */
  static async deletePlayer(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { id } = req.params;

      // Get player to find userId
      const player = await PlayerService.getPlayerById(id);
      if (!player) {
        res.status(404).json({
          success: false,
          error: 'Player not found',
        });
        return;
      }

      await setPlayerEligibility(req, id, false);

      res.status(200).json({
        success: true,
        message: 'Player participation ended successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /players/batch-update
   * Batch update multiple players (Admin only)
   *
   * Body: {
   *   playerIds: string[],
   *   updates: {
   *     singlesRanking?: number,
   *     doublesRanking?: number,
   *     addToTeams?: string[],
   *     removeFromTeams?: string[]
   *   }
   * }
   */
  static async batchUpdatePlayers(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { playerIds, updates } = req.body as Api.BatchUpdatePlayersRequest;

      // Validation
      if (!Array.isArray(playerIds) || playerIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid playerIds array',
        });
        return;
      }

      if (playerIds.length > MAX_PLAYER_BATCH_SIZE) {
        throw AppError.validation(
          `Maximum ${MAX_PLAYER_BATCH_SIZE} players per batch operation`
        );
      }

      if (!updates || typeof updates !== 'object') {
        res.status(400).json({
          success: false,
          error: 'Invalid updates object',
        });
        return;
      }

      const result = await PlayerService.batchUpdatePlayers(playerIds, updates);

      AuditService.writeBestEffort({
        eventType: AuditEventType.PLAYERS_BATCH_UPDATED,
        entityType: EntityType.PLAYER,
        entityId: playerIds[0],
        actor: {
          id: req.user!.id,
          accountKind: req.user!.accountKind,
        },
        changes: [
          { field: 'requestedCount', newValue: playerIds.length },
          { field: 'updatedCount', newValue: result.updatedCount },
          ...Object.keys(updates).map((field) => ({ field })),
        ],
      });

      res.status(200).json({
        success: (result.failures?.length ?? 0) === 0,
        data: result,
        message: `Updated ${result.updatedCount} player(s) with ${result.failures?.length ?? 0} failure(s)`,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /players/:playerId/teams/:teamId
   * Add a player to a team
   */
  static async addPlayerToTeam(
    req: Request<{ playerId: string; teamId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await PlayerService.addPlayerToTeam(
        req.params.playerId,
        req.params.teamId
      );
      const playerWithUserInfo = await PlayerService.getPlayerByIdWithUserInfo(
        req.params.playerId
      );

      res.status(200).json({
        success: true,
        data: playerWithUserInfo,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /players/:playerId/teams/:teamId
   * Remove a player from a team
   */
  static async removePlayerFromTeam(
    req: Request<{ playerId: string; teamId: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      await PlayerService.removePlayerFromTeam(
        req.params.playerId,
        req.params.teamId
      );
      const playerWithUserInfo = await PlayerService.getPlayerByIdWithUserInfo(
        req.params.playerId
      );

      res.status(200).json({
        success: true,
        data: playerWithUserInfo,
      });
    } catch (error) {
      next(error);
    }
  }
}
