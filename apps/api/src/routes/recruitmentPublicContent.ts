import { Router } from 'express';
import {
  recruitmentPublicContentQuerySchema,
  updateRecruitmentPublicContentSchema,
} from '@club/shared-types/api/recruitmentPublicContent';
import { Capability } from '@club/shared-types/core/enums';
import { RecruitmentPublicContentController } from '../controllers/recruitmentPublicContentController';
import type { AuthenticatedRequest } from '../middleware/auth';
import { authorizeCapability, protect } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router: Router = Router();

router.get(
  '/admin',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  RecruitmentPublicContentController.getAdministrationContent
);
router.put(
  '/admin',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: updateRecruitmentPublicContentSchema }),
  (req, res) =>
    RecruitmentPublicContentController.updateContent(
      req as AuthenticatedRequest,
      res
    )
);
router.get(
  '/',
  validateRequest({ query: recruitmentPublicContentQuerySchema }),
  RecruitmentPublicContentController.getPublicContent
);

export default router;
