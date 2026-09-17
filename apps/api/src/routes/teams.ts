import type { Router } from 'express';
import express from 'express';
import {
  authorizeAnyCapability,
  authorizeCapability,
  protect,
} from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { TeamController } from '../controllers/teamController';
import { Capability } from '@club/shared-types/core/enums';
import {
  createTeamSchema,
  updateTeamSchema,
} from '@club/shared-types/schemas/team';

const router: Router = express.Router();

// Public route — no auth required (must be before /:id routes)
router.get('/public', TeamController.getPublicTeams);

// Get all teams (with optional playerId filter)
router.get(
  '/',
  protect,
  authorizeAnyCapability([
    Capability.ADMINISTRATION,
    Capability.CURRENT_MEMBER,
    Capability.ACTIVE_PLAYER,
  ]),
  TeamController.getAllTeams
);

// Get team by ID
router.get(
  '/:id',
  protect,
  authorizeAnyCapability([
    Capability.ADMINISTRATION,
    Capability.CURRENT_MEMBER,
    Capability.ACTIVE_PLAYER,
  ]),
  TeamController.getTeamById as any
);

// Get team statistics (player counts with gender breakdown)
router.get(
  '/:id/stats',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  TeamController.getTeamStats as any
);

// Create team (admin only)
router.post(
  '/',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: createTeamSchema }),
  TeamController.createTeam as any
);

// Update team (admin only)
router.put(
  '/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: updateTeamSchema }),
  TeamController.updateTeam as any
);

// Delete team (admin only)
router.delete(
  '/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  TeamController.deleteTeam as any
);

// Get team players
router.get(
  '/:id/players',
  protect,
  authorizeAnyCapability([
    Capability.ADMINISTRATION,
    Capability.CURRENT_MEMBER,
    Capability.ACTIVE_PLAYER,
  ]),
  TeamController.getTeamPlayers as any
);

export default router;
