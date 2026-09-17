import { Router } from 'express';
import {
  teamPublicContentQuerySchema,
  updateTeamPublicContentSchema,
} from '@club/shared-types/api/teamPublicContent';
import { Capability } from '@club/shared-types/core/enums';
import { TeamPublicContentController } from '../controllers/teamPublicContentController';
import type { AuthenticatedRequest } from '../middleware/auth';
import { authorizeCapability, protect } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router: Router = Router();

router.get(
  '/admin',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  TeamPublicContentController.getAdministrationContent
);

router.put(
  '/admin',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: updateTeamPublicContentSchema }),
  (req, res) =>
    TeamPublicContentController.updateContent(req as AuthenticatedRequest, res)
);

router.get(
  '/',
  validateRequest({ query: teamPublicContentQuerySchema }),
  TeamPublicContentController.getPublicContent
);

export default router;
