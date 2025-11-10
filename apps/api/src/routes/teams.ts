import type { Router } from 'express';
import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { TeamController } from '../controllers/teamController';
import { ADMIN_ROLES } from '../utils/roles';

const router: Router = express.Router();

// Get all teams (with optional playerId filter)
router.get('/', protect, TeamController.getAllTeams);

// Get team by ID
router.get('/:id', protect, TeamController.getTeamById as any);

// Get team statistics (player counts with gender breakdown)
router.get('/:id/stats', protect, TeamController.getTeamStats as any);

// Create team (admin only)
router.post('/', protect, authorize(ADMIN_ROLES), TeamController.createTeam as any);

// Update team (admin only)
router.put('/:id', protect, authorize(ADMIN_ROLES), TeamController.updateTeam as any);

// Delete team (admin only)
router.delete('/:id', protect, authorize(ADMIN_ROLES), TeamController.deleteTeam as any);

// DEPRECATED: Use /players/:playerId/teams/:teamId instead (moved to PlayerController)
// Add player to team (admin only)
router.post('/:teamId/players/:playerId', protect, authorize(ADMIN_ROLES), TeamController.addPlayerToTeam as any);

// DEPRECATED: Use /players/:playerId/teams/:teamId instead (moved to PlayerController)
// Remove player from team (admin only)
router.delete('/:teamId/players/:playerId', protect, authorize(ADMIN_ROLES), TeamController.removePlayerFromTeam as any);

// Get team players
router.get('/:id/players', protect, TeamController.getTeamPlayers as any);

export default router;