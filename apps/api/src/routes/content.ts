import { Router } from 'express';
import {
  homepageContentQuerySchema,
  updateHomepageContentSchema,
} from '@club/shared-types/api/homepageContent';
import { Capability } from '@club/shared-types/core/enums';
import { HomepageContentController } from '../controllers/homepageContentController';
import type { AuthenticatedRequest } from '../middleware/auth';
import { authorizeCapability, protect } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router: Router = Router();

router.get(
  '/admin',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  HomepageContentController.getAdministrationContent
);

router.put(
  '/admin',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: updateHomepageContentSchema }),
  (req, res) =>
    HomepageContentController.updateContent(req as AuthenticatedRequest, res)
);

router.get(
  '/',
  validateRequest({ query: homepageContentQuerySchema }),
  HomepageContentController.getPublicContent
);

export default router;
