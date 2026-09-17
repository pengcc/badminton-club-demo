import { Router } from 'express';
import {
  tasterSessionPublicContentQuerySchema,
  updateTasterSessionPublicContentSchema,
} from '@club/shared-types/api/tasterSessionPublicContent';
import { Capability } from '@club/shared-types/core/enums';
import { TasterSessionPublicContentController } from '../controllers/tasterSessionPublicContentController';
import type { AuthenticatedRequest } from '../middleware/auth';
import { authorizeCapability, protect } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router: Router = Router();

router.get(
  '/admin',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  TasterSessionPublicContentController.getAdministrationContent
);
router.put(
  '/admin',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: updateTasterSessionPublicContentSchema }),
  (req, res) =>
    TasterSessionPublicContentController.updateContent(
      req as AuthenticatedRequest,
      res
    )
);
router.get(
  '/',
  validateRequest({ query: tasterSessionPublicContentQuerySchema }),
  TasterSessionPublicContentController.getPublicContent
);

export default router;
