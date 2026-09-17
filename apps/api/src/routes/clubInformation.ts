import { Router } from 'express';
import {
  clubInformationQuerySchema,
  updateClubInformationSchema,
} from '@club/shared-types/api/clubInformation';
import { Capability } from '@club/shared-types/core/enums';
import { ClubInformationController } from '../controllers/clubInformationController';
import type { AuthenticatedRequest } from '../middleware/auth';
import { authorizeCapability, protect } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router: Router = Router();

router.get(
  '/admin',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  ClubInformationController.getAdministrationContent
);

router.put(
  '/admin',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: updateClubInformationSchema }),
  (req, res) =>
    ClubInformationController.updateContent(req as AuthenticatedRequest, res)
);

router.get(
  '/',
  validateRequest({ query: clubInformationQuerySchema }),
  ClubInformationController.getPublicContent
);

export default router;
