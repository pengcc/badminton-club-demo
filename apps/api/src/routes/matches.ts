import type { Router } from 'express';
import express from 'express';
import {
  authorizeAnyCapability,
  authorizeCapability,
  protect,
} from '../middleware/auth';
import { MatchController } from '../controllers/matchController';
import { Capability } from '@club/shared-types/core/enums';
import { validateRequest } from '../middleware/validation';
import {
  createMatchSchema,
  deleteMatchSchema,
  matchListQuerySchema,
  setOwnMatchAvailabilitySchema,
  setPlayerMatchAvailabilitySchema,
  setMatchResultSchema,
  updateMatchSchema,
  updateLineupSchema,
} from '@club/shared-types/schemas';
import {
  uploadMatchCsv,
  validateMatchCsvImportFields,
} from '../middleware/matchCsvUpload';

const router: Router = express.Router();

// Get all matches
router.get(
  '/',
  protect,
  authorizeAnyCapability([
    Capability.ADMINISTRATION,
    Capability.CURRENT_MEMBER,
    Capability.ACTIVE_PLAYER,
  ]),
  validateRequest({ query: matchListQuerySchema }),
  MatchController.getMatches as any
);

// Get match by ID
router.get(
  '/:id',
  protect,
  authorizeAnyCapability([
    Capability.ADMINISTRATION,
    Capability.CURRENT_MEMBER,
    Capability.ACTIVE_PLAYER,
  ]),
  MatchController.getMatchById as any
);

// Create match (admin only)
router.post(
  '/',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: createMatchSchema }),
  MatchController.createMatch as any
);

// Update match (admin only)
router.put(
  '/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: updateMatchSchema }),
  MatchController.updateMatch as any
);

// Delete match (admin only)
router.delete(
  '/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: deleteMatchSchema }),
  MatchController.deleteMatch as any
);

router.put(
  '/:id/result',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: setMatchResultSchema }),
  MatchController.setResult as any
);

router.get(
  '/:id/lineup-context',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  MatchController.getLineupContext as any
);

// Update lineup
router.put(
  '/:id/lineup',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: updateLineupSchema }),
  MatchController.updateLineup as any
);

router.put(
  '/:id/availability/self',
  protect,
  authorizeCapability(Capability.ACTIVE_PLAYER),
  validateRequest({ body: setOwnMatchAvailabilitySchema }),
  MatchController.setOwnAvailability as any
);

router.put(
  '/:id/availability/:playerId',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: setPlayerMatchAvailabilitySchema }),
  MatchController.setPlayerAvailability as any
);

// Import matches from CSV (admin only)
router.post(
  '/import-csv',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  uploadMatchCsv,
  validateMatchCsvImportFields,
  MatchController.importFromCSV as any
);

// Current Match access derives from Player.teamIds. Removing a Team association
// does not delete retained Match Availability or Lineup references.

export default router;
