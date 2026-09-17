import { Router, type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { Capability } from '@club/shared-types/core/enums';
import {
  createTasterSessionRequestSchema,
  tasterSessionArchiveCommandSchema,
  tasterSessionDeliveryRetrySchema,
  tasterSessionDispositionSchema,
  tasterSessionListQuerySchema,
  tasterSessionPreferenceOptionsQuerySchema,
  tasterSessionRequestParamsSchema,
} from '@club/shared-types/api/tasterSessionRequest';
import { TasterSessionRequestController } from '../controllers/tasterSessionRequestController';
import { authorizeCapability, protect } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router: ReturnType<typeof Router> = Router();
const submissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests' },
});
const admin = [
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
] as RequestHandler[];

router.get(
  '/preference-options',
  validateRequest({ query: tasterSessionPreferenceOptionsQuerySchema }),
  TasterSessionRequestController.preferences as RequestHandler
);
router.post(
  '/',
  submissionLimiter,
  validateRequest({ body: createTasterSessionRequestSchema }),
  TasterSessionRequestController.create as RequestHandler
);
router.get(
  '/',
  ...admin,
  validateRequest({ query: tasterSessionListQuerySchema }),
  TasterSessionRequestController.list as RequestHandler
);
router.get(
  '/stats',
  ...admin,
  TasterSessionRequestController.stats as RequestHandler
);
router.get(
  '/:id',
  ...admin,
  validateRequest({ params: tasterSessionRequestParamsSchema }),
  TasterSessionRequestController.get as RequestHandler
);
router.post(
  '/:id/disposition',
  ...admin,
  validateRequest({
    params: tasterSessionRequestParamsSchema,
    body: tasterSessionDispositionSchema,
  }),
  TasterSessionRequestController.dispose as RequestHandler
);
router.post(
  '/:id/archive',
  ...admin,
  validateRequest({
    params: tasterSessionRequestParamsSchema,
    body: tasterSessionArchiveCommandSchema,
  }),
  TasterSessionRequestController.archive as unknown as RequestHandler
);
router.post(
  '/:id/unarchive',
  ...admin,
  validateRequest({
    params: tasterSessionRequestParamsSchema,
    body: tasterSessionArchiveCommandSchema,
  }),
  TasterSessionRequestController.unarchive as unknown as RequestHandler
);
router.post(
  '/:id/delivery/retry',
  ...admin,
  validateRequest({
    params: tasterSessionRequestParamsSchema,
    body: tasterSessionDeliveryRetrySchema,
  }),
  TasterSessionRequestController.retryDelivery as unknown as RequestHandler
);

export default router;
