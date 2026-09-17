import type { Router } from 'express';
import express from 'express';
import {
  authorizeAnyCapability,
  authorizeCapability,
  authorizeOwner,
  protect,
} from '../middleware/auth';
import { PlayerController } from '../controllers/playerController';
import { Capability } from '@club/shared-types/core/enums';
import { batchUpdatePlayersSchema } from '@club/shared-types/schemas/team';
import { validateRequest } from '../middleware/validation';
import {
  convertFormerMemberToExternalSchema,
  playerCleanupSchema,
  playerLifecycleBatchSchema,
} from '@club/shared-types/schemas';

const router: Router = express.Router();

/**
 * Player routes - New architecture with separate Player entity
 * All routes require authentication
 * Most routes require admin privileges
 */

// Get all players with user info
router.get(
  '/',
  protect,
  authorizeAnyCapability([
    Capability.ADMINISTRATION,
    Capability.CURRENT_MEMBER,
    Capability.ACTIVE_PLAYER,
  ]),
  PlayerController.getAllPlayers
);

// Get active players (authenticated users)
router.get(
  '/active/list',
  protect,
  authorizeAnyCapability([
    Capability.ADMINISTRATION,
    Capability.CURRENT_MEMBER,
    Capability.ACTIVE_PLAYER,
  ]),
  PlayerController.getActivePlayers
);

router.get(
  '/lifecycle/candidates',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  PlayerController.getLifecycleCandidates
);

router.post(
  '/lifecycle/batch',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: playerLifecycleBatchSchema }),
  PlayerController.batchLifecycle
);

router.post(
  '/lifecycle/:id/convert-to-external',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: convertFormerMemberToExternalSchema }),
  PlayerController.convertFormerMemberToExternal
);

// Get player by user ID (self or admin)
router.get(
  '/user/:userId',
  protect,
  authorizeCapability(Capability.AUTHENTICATED_ACCOUNT),
  authorizeOwner((req) => req.params.userId as string),
  PlayerController.getPlayerByUserId
);

// Get player by ID with user info for approved sporting workflows
router.get(
  '/:id',
  protect,
  authorizeAnyCapability([
    Capability.ADMINISTRATION,
    Capability.CURRENT_MEMBER,
    Capability.ACTIVE_PLAYER,
  ]),
  PlayerController.getPlayerById
);

// Update player sports data (admin only)
router.put(
  '/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  PlayerController.updatePlayer
);

// Update player active status (admin only)
router.patch(
  '/:id/active-status',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  PlayerController.updatePlayerStatus
);

router.post(
  '/:id/cleanup',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: playerCleanupSchema }),
  PlayerController.cleanupPlayer
);

// Batch update players (admin only)
router.post(
  '/batch-update',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: batchUpdatePlayersSchema }),
  PlayerController.batchUpdatePlayers
);

// Add player to team (admin only)
router.post(
  '/:playerId/teams/:teamId',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  PlayerController.addPlayerToTeam
);

// Remove player from team (admin only)
router.delete(
  '/:playerId/teams/:teamId',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  PlayerController.removePlayerFromTeam
);

// Preserve the Player identity and suspend sporting eligibility (admin only)
router.delete(
  '/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  PlayerController.deletePlayer
);

export default router;
