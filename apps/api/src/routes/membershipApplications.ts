import type { Router } from 'express';
import express from 'express';
import { authorizeCapability, protect } from '../middleware/auth';
import { MembershipApplicationController } from '../controllers/membershipApplicationController';
import { Capability } from '@club/shared-types/core/enums';
import rateLimit from 'express-rate-limit';
import { RegistrationAccessController } from '../controllers/registrationAccessController';
import { MembershipApplicantController } from '../controllers/membershipApplicantController';
import {
  requireApplicantSession,
  requireTrustedApplicantOrigin,
} from '../middleware/membershipApplicant';
import { MembershipApplicantAccessService } from '../services/membershipApplicantAccessService';
import { uploadMembershipStudentProof } from '../middleware/membershipStudentProof';

const router: Router = express.Router();

const registrationAccessLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Registration is unavailable' },
});

const genericApplicantLimitMessage = {
  success: true,
  message: 'If the request is eligible, an email will arrive shortly.',
};

export const APPLICANT_EMAIL_RATE_LIMITS = {
  perMinute: 1,
  perHour: 5,
  perDay: 10,
  perIpHour: 20,
} as const;

function emailLimiter(windowMs: number, max: number) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) =>
      MembershipApplicantAccessService.hashRateLimitEmail(req.body?.email),
    handler: (_req, res) => res.status(202).json(genericApplicantLimitMessage),
  });
}

const applicantEmailLimits = [
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: APPLICANT_EMAIL_RATE_LIMITS.perIpHour,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => res.status(202).json(genericApplicantLimitMessage),
  }),
  emailLimiter(60 * 1000, APPLICANT_EMAIL_RATE_LIMITS.perMinute),
  emailLimiter(60 * 60 * 1000, APPLICANT_EMAIL_RATE_LIMITS.perHour),
  emailLimiter(24 * 60 * 60 * 1000, APPLICANT_EMAIL_RATE_LIMITS.perDay),
];

router.post(
  '/applicant/verification-requests',
  ...applicantEmailLimits,
  MembershipApplicantController.requestInitial as any
);

router.post(
  '/applicant/access-requests',
  ...applicantEmailLimits,
  MembershipApplicantController.requestAccess as any
);

router.post(
  '/applicant/access/consume',
  registrationAccessLimiter,
  requireTrustedApplicantOrigin,
  MembershipApplicantController.consume as any
);

router.get(
  '/applicant/application',
  requireApplicantSession,
  MembershipApplicantController.getCurrent as any
);

router.patch(
  '/applicant/application',
  requireApplicantSession,
  requireTrustedApplicantOrigin,
  MembershipApplicantController.save as any
);

router.patch(
  '/applicant/application/communication-locale',
  requireApplicantSession,
  requireTrustedApplicantOrigin,
  MembershipApplicantController.synchronizeLocale as any
);

router.post(
  '/applicant/application/submit',
  requireApplicantSession,
  requireTrustedApplicantOrigin,
  MembershipApplicantController.submit as any
);

router.post(
  '/applicant/email-change-requests',
  requireApplicantSession,
  requireTrustedApplicantOrigin,
  ...applicantEmailLimits,
  MembershipApplicantController.requestEmailChange as any
);

router.post(
  '/applicant/application/withdraw',
  requireApplicantSession,
  requireTrustedApplicantOrigin,
  MembershipApplicantController.withdraw as any
);

router.patch(
  '/applicant/application/student-proof',
  requireApplicantSession,
  requireTrustedApplicantOrigin,
  uploadMembershipStudentProof,
  MembershipApplicantController.replaceStudentProof as any
);

router.get(
  '/applicant/application/documents/:kind',
  requireApplicantSession,
  MembershipApplicantController.downloadDocument as any
);

router.post(
  '/applicant/application/documents/email',
  requireApplicantSession,
  requireTrustedApplicantOrigin,
  MembershipApplicantController.emailDocuments as any
);

router.get(
  '/registration-access/validate',
  registrationAccessLimiter,
  RegistrationAccessController.validate as any
);

router.get(
  '/registration-access',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  RegistrationAccessController.getAdminState as any
);

router.post(
  '/registration-access/generate',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  RegistrationAccessController.generate as any
);

router.post(
  '/registration-access/rotate',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  RegistrationAccessController.rotate as any
);

// Get application statistics (admin only)
router.get(
  '/applications/stats',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  MembershipApplicationController.getApplicationStats as any
);

// Get pending applications (admin only)
router.get(
  '/applications/pending',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  MembershipApplicationController.getPendingApplications as any
);

// Get all membership applications (admin only)
router.get(
  '/applications',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  MembershipApplicationController.getAllApplications as any
);

// Get a specific membership application (admin only)
router.get(
  '/applications/:id',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  MembershipApplicationController.getApplicationById as any
);

// Update the internal review note (admin only)
router.patch(
  '/applications/:id/review-note',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  MembershipApplicationController.updateApplication as any
);

// Approve application (admin only)
router.post(
  '/applications/:id/approve',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  MembershipApplicationController.approveApplication as any
);

router.post(
  '/applications/:id/password-setup/reissue',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  MembershipApplicationController.reissuePasswordSetup as any
);

router.post(
  '/applications/:id/decision-notification/retry',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  MembershipApplicationController.retryDecisionNotification as any
);

router.get(
  '/applications/:id/student-proof/:proofId',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  MembershipApplicationController.getStudentProof as any
);

router.delete(
  '/applications/:id/student-proof/:proofId',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  MembershipApplicationController.deleteStudentProof as any
);

router.post(
  '/applications/:id/signed-receipts/:kind/confirm',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  MembershipApplicationController.confirmSignedReceipt as any
);

router.post(
  '/applications/:id/signed-receipts/:kind/reset',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  MembershipApplicationController.resetSignedReceipt as any
);

// Reject application (admin only)
router.post(
  '/applications/:id/reject',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  MembershipApplicationController.rejectApplication as any
);

// Contact applicant (admin only)
router.post(
  '/applications/:id/contact',
  protect,
  authorizeCapability(Capability.ADMINISTRATION),
  MembershipApplicationController.contactApplicant as any
);

export default router;
