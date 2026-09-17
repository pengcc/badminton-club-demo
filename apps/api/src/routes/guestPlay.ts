import { Router, type RequestHandler } from 'express';
import { Capability } from '@club/shared-types/core/enums';
import {
  createGuestPlaySchema,
  guestPlayCorrectionSchema,
  guestPlayDecisionSchema,
  guestPlayListQuerySchema,
  guestPlayOpportunitiesQuerySchema,
  guestPlayNotificationRetrySchema,
  guestPlayParamsSchema,
  guestPlayVersionCommandSchema,
} from '@club/shared-types/api/guestPlay';
import { GuestPlayController } from '../controllers/guestPlayController';
import { authorizeCapability, protect } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router: ReturnType<typeof Router> = Router();
const member = [
  protect,
  authorizeCapability(Capability.CURRENT_MEMBER),
] as RequestHandler[];
const admin = [
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
] as RequestHandler[];

router.get(
  '/opportunities',
  ...member,
  validateRequest({ query: guestPlayOpportunitiesQuerySchema }),
  GuestPlayController.opportunities as RequestHandler
);
router.post(
  '/',
  ...member,
  validateRequest({ body: createGuestPlaySchema }),
  GuestPlayController.createRequest as RequestHandler
);
router.get(
  '/my-requests',
  ...member,
  GuestPlayController.getMyRequests as RequestHandler
);
router.post(
  '/:id/cancel',
  ...member,
  validateRequest({
    params: guestPlayParamsSchema,
    body: guestPlayVersionCommandSchema,
  }),
  GuestPlayController.cancelOwnRequest as unknown as RequestHandler
);

router.get(
  '/',
  ...admin,
  validateRequest({ query: guestPlayListQuerySchema }),
  GuestPlayController.getAllRequests as RequestHandler
);
router.get('/stats', ...admin, GuestPlayController.getStats as RequestHandler);
router.get(
  '/:id',
  ...admin,
  validateRequest({ params: guestPlayParamsSchema }),
  GuestPlayController.getRequestById as RequestHandler
);
router.post(
  '/:id/decision',
  ...admin,
  validateRequest({
    params: guestPlayParamsSchema,
    body: guestPlayDecisionSchema,
  }),
  GuestPlayController.decide as unknown as RequestHandler
);
router.post(
  '/:id/correction',
  ...admin,
  validateRequest({
    params: guestPlayParamsSchema,
    body: guestPlayCorrectionSchema,
  }),
  GuestPlayController.correctDecision as unknown as RequestHandler
);
router.post(
  '/:id/archive',
  ...admin,
  validateRequest({
    params: guestPlayParamsSchema,
    body: guestPlayVersionCommandSchema,
  }),
  GuestPlayController.archive as unknown as RequestHandler
);
router.post(
  '/:id/restore',
  ...admin,
  validateRequest({
    params: guestPlayParamsSchema,
    body: guestPlayVersionCommandSchema,
  }),
  GuestPlayController.restore as unknown as RequestHandler
);
router.post(
  '/:id/notifications/retry',
  ...admin,
  validateRequest({
    params: guestPlayParamsSchema,
    body: guestPlayNotificationRetrySchema,
  }),
  GuestPlayController.retryNotification as unknown as RequestHandler
);

export default router;
