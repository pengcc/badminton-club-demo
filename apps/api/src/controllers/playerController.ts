import type { Request, Response, NextFunction } from 'express';
import { PlayerService } from '../services/playerService';
import { UserService } from '../services/userService';
import type { Api } from '@club/shared-types/api/player';

/**
 * Controller for Player entity operations
 * Handles CRUD and query operations for players
 */
export class PlayerController {
  /**
   * GET /players
   * List all players with user info
   */
  static async getAllPlayers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const players = await PlayerService.getAllPlayersWithUserInfo();

      res.status(200).json({
        success: true,
        data: players
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /players/:id
   * Get player by ID with user info
   */
  static async getPlayerById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const player = await PlayerService.getPlayerByIdWithUserInfo(id);

      if (!player) {
        res.status(404).json({
          success: false,
          error: 'Player not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: player
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /players/user/:userId
   * Get player by user ID
   */
  static async getPlayerByUserId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const player = await PlayerService.getPlayerByUserId(userId);

      if (!player) {
        res.status(404).json({
          success: false,
          error: 'Player not found for this user'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: player
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /players/team/:teamId
   * Get active players for a team
   */
  static async getPlayersByTeam(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { teamId } = req.params;
      const players = await PlayerService.getActivePlayersForTeam(teamId);

      res.status(200).json({
        success: true,
        data: players
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /players/active
   * Get all active players
   */
  static async getActivePlayers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const players = await PlayerService.getActivePlayers();

      res.status(200).json({
        success: true,
        data: players
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /players/:id
   * Update player sports data
   */
  static async updatePlayer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const updates: Api.UpdatePlayerRequest = req.body;

      const updatedPlayer = await PlayerService.updatePlayerSportsData(id, updates);

      res.status(200).json({
        success: true,
        data: updatedPlayer
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
  static async updatePlayerStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { isActivePlayer } = req.body;

      if (typeof isActivePlayer !== 'boolean') {
        res.status(400).json({
          success: false,
          error: 'isActivePlayer must be a boolean value'
        });
        return;
      }

      const updatedPlayer = await PlayerService.updatePlayerSportsData(id, { isActivePlayer });

      res.status(200).json({
        success: true,
        data: updatedPlayer,
        message: `Player ${isActivePlayer ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /players/:id
   * Delete player and set User.isPlayer = false
   */
  static async deletePlayer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      // Get player to find userId
      const player = await PlayerService.getPlayerById(id);
      if (!player) {
        res.status(404).json({
          success: false,
          error: 'Player not found'
        });
        return;
      }

      // Use UserService to properly handle deletion
      await UserService.setPlayerStatus(player.userId, false);

      res.status(200).json({
        success: true,
        message: 'Player deleted successfully'
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
   *     isActivePlayer?: boolean,
   *     singlesRanking?: number,
   *     doublesRanking?: number,
   *     addToTeams?: string[],
   *     removeFromTeams?: string[]
   *   }
   * }
   */
  static async batchUpdatePlayers(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { playerIds, updates } = req.body;

      // Validation
      if (!Array.isArray(playerIds) || playerIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid playerIds array'
        });
        return;
      }

      if (playerIds.length > 100) {
        res.status(400).json({
          success: false,
          error: 'Maximum 100 players per batch operation'
        });
        return;
      }

      if (!updates || typeof updates !== 'object') {
        res.status(400).json({
          success: false,
          error: 'Invalid updates object'
        });
        return;
      }

      // Perform batch update
      const result = await PlayerService.batchUpdatePlayers(playerIds, updates);

      res.status(200).json({
        success: true,
        data: result,
        message: `Successfully updated ${result.modifiedCount} player(s)`
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
      // Get player with user info for response
      const playerWithUserInfo = await PlayerService.getPlayerByIdWithUserInfo(req.params.playerId);

      res.status(200).json({
        success: true,
        data: playerWithUserInfo
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
      // Get player with user info for response
      const playerWithUserInfo = await PlayerService.getPlayerByIdWithUserInfo(req.params.playerId);

      res.status(200).json({
        success: true,
        data: playerWithUserInfo
      });
    } catch (error) {
      next(error);
    }
  }
}
