import { Router } from 'express';
import {
  membershipPublicContentQuerySchema,
  updateMembershipPublicContentSchema,
} from '@club/shared-types/api/membershipPublicContent';
import { Capability } from '@club/shared-types/core/enums';
import { MembershipPublicContentController } from '../controllers/membershipPublicContentController';
import type { AuthenticatedRequest } from '../middleware/auth';
import { authorizeCapability, protect } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router: Router = Router();

router.get(
  '/admin',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  MembershipPublicContentController.getAdministrationContent
);
router.put(
  '/admin',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: updateMembershipPublicContentSchema }),
  (req, res) =>
    MembershipPublicContentController.updateContent(
      req as AuthenticatedRequest,
      res
    )
);
router.get(
  '/',
  validateRequest({ query: membershipPublicContentQuerySchema }),
  MembershipPublicContentController.getPublicContent
);

export default router;
