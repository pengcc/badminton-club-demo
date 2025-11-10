import express, { Router, Request, Response } from 'express';
import { protect, authorize } from '../middleware/auth';
import { PlayerController } from '../controllers/playerController';
import { MEMBER_ROLES, ADMIN_ROLES } from '../utils/roles';

const router: Router = express.Router();

/**
 * Player routes - New architecture with separate Player entity
 * All routes require authentication
 * Most routes require admin privileges
 */

// Get all players with user info
router.get('/',
  protect,
  authorize(MEMBER_ROLES),
  PlayerController.getAllPlayers
);

// Get player by ID with user info (authenticated users)
router.get('/:id',
  protect,
  PlayerController.getPlayerById
);

// Get player by user ID (authenticated users)
router.get('/user/:userId',
  protect,
  PlayerController.getPlayerByUserId
);

// Get active players (authenticated users)
router.get('/active/list',
  protect,
  PlayerController.getActivePlayers
);

// Update player sports data (admin only)
router.put('/:id',
  protect,
  authorize(ADMIN_ROLES),
  PlayerController.updatePlayer
);

// Update player active status (admin only)
router.patch('/:id/active-status',
  protect,
  authorize(ADMIN_ROLES),
  PlayerController.updatePlayerStatus
);

// Batch update players (admin only)
router.post('/batch-update',
  protect,
  authorize(ADMIN_ROLES),
  PlayerController.batchUpdatePlayers
);

// Add player to team (admin only)
router.post('/:playerId/teams/:teamId',
  protect,
  authorize(ADMIN_ROLES),
  PlayerController.addPlayerToTeam
);

// Remove player from team (admin only)
router.delete('/:playerId/teams/:teamId',
  protect,
  authorize(ADMIN_ROLES),
  PlayerController.removePlayerFromTeam
);

// Delete player and set User.isPlayer = false (admin only)
router.delete('/:id',
  protect,
  authorize(ADMIN_ROLES),
  PlayerController.deletePlayer
);

export default router;