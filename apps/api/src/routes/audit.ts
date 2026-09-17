import {
  Router,
  type Router as RouterType,
  type RequestHandler,
} from 'express';
import { AuditController } from '../controllers/auditController';
import { authorizeCapability, protect } from '../middleware/auth';
import { Capability } from '@club/shared-types/core/enums';

const router: RouterType = Router();

/**
 * All audit routes require admin authentication
 */

// GET /api/audit - List logs with filters
router.get(
  '/',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  AuditController.getLogs as RequestHandler
);

// GET /api/audit/entity/:type/:id - Entity history
router.get(
  '/entity/:type/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  AuditController.getEntityHistory as RequestHandler
);

// GET /api/audit/:id - Get single log
router.get(
  '/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  AuditController.getLogById as RequestHandler
);

export default router;
