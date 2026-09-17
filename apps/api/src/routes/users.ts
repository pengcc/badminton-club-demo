import { memberCsvUpload } from '../middleware/memberCsvUpload';
import { memberCsvImportController } from '../controllers/memberCsvImportController';
import type { Router } from 'express';
import express from 'express';
import { UserController } from '../controllers/userController';
import type { AuthenticatedRequest } from '../middleware/auth';
import {
  authorizeCapability,
  authorizeOwner,
  protect,
} from '../middleware/auth';
import { Capability } from '@club/shared-types/core/enums';
import { validateRequest } from '../middleware/validation';
import {
  accountEstablishmentSchema,
  activePassiveMembershipTransitionSchema,
  administratorDesignationSchema,
  emailChangeRequestSchema,
  memberListQuerySchema,
  memberExportQuerySchema,
  suspendAccountSchema,
  updateUserSchema,
  accountDeletionSchema,
} from '@club/shared-types/schemas';
import { administratorPasswordRecoverySchema } from '@club/shared-types/api/auth';
import { PasswordRecoveryService } from '../services/passwordRecoveryService';

const router: Router = express.Router();

for (const [path, apply] of [
  ['preview', false],
  ['apply', true],
] as const) {
  router.post(
    `/member-import/${path}`,
    protect,
    authorizeCapability(Capability.ADMINISTRATION),
    memberCsvUpload(apply),
    memberCsvImportController(apply)
  );
}

router.get(
  '/member-export/rich',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ query: memberExportQuerySchema }),
  UserController.getRichMemberExport
);

// Create new user (admin only)
router.post(
  '/',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: accountEstablishmentSchema }),
  UserController.createUser as any
);

router.post(
  '/:id/membership-activity',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: activePassiveMembershipTransitionSchema }),
  UserController.transitionMembershipActivity as any
);

router.post(
  '/:id/account-suspension',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: suspendAccountSchema }),
  UserController.suspendAccount as any
);

router.delete(
  '/:id/account-suspension',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  UserController.unsuspendAccount as any
);

router.post(
  '/:id/password-recovery',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: administratorPasswordRecoverySchema }),
  async (req, res) => {
    const deliveryStatus = await PasswordRecoveryService.requestForUser(
      req.params.id as string,
      (res.locals.validatedBody ?? req.body).locale
    );
    res.status(200).json({ success: true, data: { deliveryStatus } });
  }
);

// Get users with filters (admin only)
router.get(
  '/filter',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ query: memberListQuerySchema }),
  UserController.getMemberList
);

// Get all users (admin only)
router.get(
  '/',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  UserController.getAllUsers as any
);

// Get single user
router.get(
  '/:id',
  protect,
  authorizeCapability(Capability.AUTHENTICATED_ACCOUNT),
  authorizeOwner((req) => req.params.id as string),
  (req, res) => UserController.getUserById(req as AuthenticatedRequest, res)
);

// Maintain a bounded Person Profile (owner or administrator support).
router.put(
  '/:id',
  protect,
  authorizeCapability(Capability.AUTHENTICATED_ACCOUNT),
  authorizeOwner((req) => req.params.id as string),
  validateRequest({ body: updateUserSchema }),
  UserController.updateUser as any
);

router.put(
  '/:id/administrator-designation',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: administratorDesignationSchema }),
  UserController.setAdministratorDesignation as any
);

// Delete user (admin only)
router.delete(
  '/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  validateRequest({ body: accountDeletionSchema }),
  UserController.deleteUser as any
);

// Resend invitation (admin only)
router.post(
  '/:id/invite',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  UserController.sendInvitation
);

// Toggle player status and manage Player entity lifecycle (admin only)
router.patch(
  '/:id/player-status',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  (req, res) =>
    UserController.togglePlayerStatus(req as AuthenticatedRequest, res)
);

// Request email change (authenticated users only)
router.post(
  '/request-email-change',
  protect,
  authorizeCapability(Capability.AUTHENTICATED_ACCOUNT),
  validateRequest({ body: emailChangeRequestSchema }),
  (req, res) =>
    UserController.requestEmailChange(req as AuthenticatedRequest, res)
);

// Verify email change (public endpoint with token)
router.get('/verify-email-change/:token', UserController.verifyEmailChange);

// Cancel email change (authenticated users only)
router.post(
  '/cancel-email-change',
  protect,
  authorizeCapability(Capability.AUTHENTICATED_ACCOUNT),
  (req, res) =>
    UserController.cancelEmailChange(req as AuthenticatedRequest, res)
);

export default router;
