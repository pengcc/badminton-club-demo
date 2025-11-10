import type { Router } from 'express';
import express from 'express';
import { protect, authorize } from '../middleware/auth';
import { MatchController } from '../controllers/matchController';
import { ADMIN_ROLES, MEMBER_ROLES } from '../utils/roles';

const router: Router = express.Router();

// Get all matches
router.get('/', protect, authorize(MEMBER_ROLES), MatchController.getMatches as any);

// Get match by ID
router.get('/:id', protect, authorize(MEMBER_ROLES), MatchController.getMatchById as any);

// Create match (admin only)
router.post('/', protect, authorize(ADMIN_ROLES), MatchController.createMatch as any);

// Update match (admin only)
router.put('/:id', protect, authorize(ADMIN_ROLES), MatchController.updateMatch as any);

// Delete match (admin only)
router.delete('/:id', protect, authorize(ADMIN_ROLES), MatchController.deleteMatch as any);

// Update lineup
router.put('/:id/lineup', protect, authorize(ADMIN_ROLES), MatchController.updateLineup as any);

// Toggle player availability (players can toggle their own, admins can toggle anyone's)
router.patch('/:id/availability/:playerId', protect, authorize(MEMBER_ROLES), MatchController.togglePlayerAvailability as any);

// Note: Sync player availability removed - now happens automatically when player leaves team

export default router;