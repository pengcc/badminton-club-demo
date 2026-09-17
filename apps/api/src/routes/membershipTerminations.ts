import type { Router } from 'express';
import express from 'express';
import { Capability } from '@club/shared-types/core/enums';
import {
  approveMembershipTerminationSchema,
  batchRecordMembershipTerminationSchema,
  membershipTerminationListQuerySchema,
  recordMembershipTerminationSchema,
  rejectMembershipTerminationSchema,
  requestMembershipTerminationSchema,
} from '@club/shared-types/schemas';
import { MembershipTerminationController } from '../controllers/membershipTerminationController';
import type { AuthenticatedRequest } from '../middleware/auth';
import { authorizeCapability, protect } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';

const router: Router = express.Router();

router.get(
  '/me',
  protect,
  authorizeCapability(Capability.MEMBERSHIP_SELF_SERVICE),
  (req, res) =>
    MembershipTerminationController.getMine(req as AuthenticatedRequest, res)
);
router.post(
  '/requests',
  protect,
  authorizeCapability(Capability.MEMBERSHIP_SELF_SERVICE),
  validateRequest({ body: requestMembershipTerminationSchema }),
  (req, res) =>
    MembershipTerminationController.request(req as AuthenticatedRequest, res)
);
router.get(
  '/',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ query: membershipTerminationListQuerySchema }),
  MembershipTerminationController.list
);
router.post(
  '/admin-recorded',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: recordMembershipTerminationSchema }),
  (req, res) =>
    MembershipTerminationController.recordOffline(
      req as AuthenticatedRequest,
      res
    )
);
router.post(
  '/batch',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: batchRecordMembershipTerminationSchema }),
  (req, res) =>
    MembershipTerminationController.recordBatch(
      req as AuthenticatedRequest,
      res
    )
);
router.post(
  '/:id/approval',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: approveMembershipTerminationSchema }),
  (req, res) =>
    MembershipTerminationController.approve(req as AuthenticatedRequest, res)
);
router.post(
  '/:id/rejection',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: rejectMembershipTerminationSchema }),
  (req, res) =>
    MembershipTerminationController.reject(req as AuthenticatedRequest, res)
);

export default router;
