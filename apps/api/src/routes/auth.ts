import type { Router } from 'express';
import express from 'express';
import rateLimit from 'express-rate-limit';
import type { Api } from '@club/shared-types/api/auth';
import {
  passwordCredentialStatusSchema,
  passwordRecoveryRequestSchema,
  passwordRecoveryResetSchema,
} from '@club/shared-types/api/auth';
import { User } from '../models/User.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { authorizeCapability, protect } from '../middleware/auth.js';
import { AccountKind, Capability } from '@club/shared-types/core/enums';
import {
  UserApiTransformer,
  UserPersistenceTransformer,
} from '../transformers/user';
import {
  evaluateUserCapabilities,
  reportCapabilityContradictions,
} from '../services/capabilityPolicyService';
import { PasswordSetupService } from '../services/passwordSetupService';
import { AuthSessionService } from '../services/authSessionService';
import { requireFirstPartyRequest } from '../middleware/firstPartyRequest';
import { PasswordChangeService } from '../services/passwordChangeService';
import { PasswordRecoveryService } from '../services/passwordRecoveryService';
import { createLoginRateLimiter } from '../middleware/loginRateLimiter';
import { DemoRuntimePolicyService } from '../services/demoRuntimePolicyService';

const router: Router = express.Router();
const loginRateLimiter = createLoginRateLimiter();

const passwordSetupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Password setup is unavailable' },
});

const GENERIC_RECOVERY_MESSAGE =
  'If the request is eligible, an email will arrive shortly.';
const genericRecoveryResponse = {
  success: true as const,
  message: GENERIC_RECOVERY_MESSAGE,
};

export const PASSWORD_RECOVERY_RATE_LIMITS = {
  perMinute: 1,
  perHour: 5,
  perIpHour: 20,
} as const;

function recoveryEmailLimiter(windowMs: number, max: number) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) =>
      PasswordRecoveryService.hashRateLimitEmail(req.body?.email),
    handler: (_req, res) => res.status(202).json(genericRecoveryResponse),
  });
}

const passwordRecoveryRequestLimiters = [
  rateLimit({
    windowMs: 60 * 60 * 1000,
    max: PASSWORD_RECOVERY_RATE_LIMITS.perIpHour,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => res.status(202).json(genericRecoveryResponse),
  }),
  recoveryEmailLimiter(60 * 1000, PASSWORD_RECOVERY_RATE_LIMITS.perMinute),
  recoveryEmailLimiter(60 * 60 * 1000, PASSWORD_RECOVERY_RATE_LIMITS.perHour),
];

router.post(
  '/password-recovery/request',
  requireFirstPartyRequest,
  ...passwordRecoveryRequestLimiters,
  (req, res) => {
    const parsed = passwordRecoveryRequestSchema.safeParse(req.body);
    if (parsed.success) {
      void PasswordRecoveryService.requestByEmail(
        parsed.data.email,
        parsed.data.locale
      ).catch(() => undefined);
    }
    return res.status(202).json(genericRecoveryResponse);
  }
);

router.post(
  '/password-recovery/status',
  requireFirstPartyRequest,
  passwordSetupLimiter,
  async (req, res) => {
    const parsed = passwordCredentialStatusSchema.safeParse(req.body);
    const usable = parsed.success
      ? await PasswordRecoveryService.status(parsed.data.token)
      : false;
    return res.status(200).json({ success: true, data: { usable } });
  }
);

router.post(
  '/password-recovery/reset',
  requireFirstPartyRequest,
  passwordSetupLimiter,
  async (req, res) => {
    const parsed = passwordRecoveryResetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Password recovery link is invalid or expired',
      });
    }
    try {
      await PasswordRecoveryService.consume(
        parsed.data.token,
        parsed.data.password
      );
      return res.status(200).json({
        success: true,
        message: 'Password recovery completed',
      });
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Password recovery link is invalid or expired',
      });
    }
  }
);

router.post(
  '/password-setup/status',
  requireFirstPartyRequest,
  passwordSetupLimiter,
  async (req, res) => {
    const parsed = passwordCredentialStatusSchema.safeParse(req.body);
    const usable = parsed.success
      ? await PasswordSetupService.status(parsed.data.token)
      : false;
    return res.status(200).json({ success: true, data: { usable } });
  }
);

router.post('/password-setup', passwordSetupLimiter, async (req, res) => {
  const { token, password, passwordConfirmation } =
    req.body as Partial<Api.PasswordSetupRequest>;
  if (
    !token ||
    !password ||
    password.length < 8 ||
    password !== passwordConfirmation
  ) {
    return res
      .status(400)
      .json({ success: false, error: 'Password setup request is invalid' });
  }

  try {
    await PasswordSetupService.consume(token, password);
    return res
      .status(200)
      .json({ success: true, message: 'Password setup completed' });
  } catch {
    return res.status(400).json({
      success: false,
      error: 'Password setup link is invalid or expired',
    });
  }
});

// Login
router.post(
  '/login',
  requireFirstPartyRequest,
  loginRateLimiter,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json({ message: 'Please provide email and password' });
      }

      // Find user and include password for comparison
      const user = await User.findOne({ email }).select(
        '+password +authSessionGeneration'
      );

      if (!user || !(await user.comparePassword(password))) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const domainUser = UserPersistenceTransformer.toDomain(
        user.toObject() as any
      );

      if (
        domainUser.accountKind === AccountKind.PERSON &&
        domainUser.accountSuspension
      ) {
        return res.status(403).json({ message: 'Account is not authorized' });
      }

      const decision = await evaluateUserCapabilities({
        ...domainUser,
        _id: domainUser.id,
        passwordSetupExpiresAt: user.passwordSetupExpiresAt,
      });
      reportCapabilityContradictions(decision, 'login');
      if (!decision.capabilities.includes(Capability.AUTHENTICATED_ACCOUNT)) {
        return res.status(403).json({ message: 'Account is not authorized' });
      }

      const issued = await AuthSessionService.replacePresented({
        cookieHeader: req.headers.cookie,
        userId: user._id,
        expectedUserVersion: user.get('__v') ?? 0,
        accountKind: domainUser.accountKind,
        ...(domainUser.accountKind === AccountKind.PERSON
          ? { membershipStatus: domainUser.membershipStatus }
          : {}),
        authSessionGeneration: AuthSessionService.generation(
          user.authSessionGeneration
        ),
      });
      AuthSessionService.setCookie(res, issued);

      const userView = UserApiTransformer.toApi(domainUser);

      res.status(200).json({
        success: true,
        user: {
          ...userView,
          capabilities: decision.capabilities,
          playerId: decision.playerId,
          ...(DemoRuntimePolicyService.isDemoAdmin(domainUser)
            ? { demoMode: true }
            : {}),
        },
      });
    } catch {
      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
      });
    }
  }
);

// Verify Token (Protected Route)
router.get(
  '/verify',
  protect,
  authorizeCapability(Capability.AUTHENTICATED_ACCOUNT),
  async (req, res) => {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user.id;

      // Get user with full details
      const user = await User.findById(userId).lean();
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
        });
      }

      const domainUser = UserPersistenceTransformer.toDomain(user as any);
      const userView = UserApiTransformer.toApi(domainUser);

      res.status(200).json({
        success: true,
        user: {
          ...userView,
          capabilities: authReq.user.capabilities,
          playerId: authReq.user.playerId,
          ...(authReq.user.demoMode ? { demoMode: true } : {}),
        },
      });
    } catch (error: any) {
      console.error('Authentication token verification failed', {
        operation: 'verify_authentication_token',
        reasonCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
      });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
      });
    }
  }
);

// Change Password (Protected Route)
router.patch(
  '/password',
  protect,
  authorizeCapability(Capability.AUTHENTICATED_ACCOUNT),
  async (req, res, next) => {
    try {
      const authReq = req as AuthenticatedRequest<{
        currentPassword: string;
        newPassword: string;
      }>;
      const { currentPassword, newPassword } = authReq.body;
      const userId = authReq.user.id;

      // Validate input
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'Current password and new password are required',
        });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 8 characters long',
        });
      }

      await PasswordChangeService.change({
        userId,
        currentPassword,
        newPassword,
      });

      res.status(200).json({
        success: true,
        message: 'Password changed successfully',
      });
    } catch (error) {
      next(error);
    }
  }
);

// Logout (Protected Route)
router.post('/logout', requireFirstPartyRequest, async (req, res) => {
  try {
    await AuthSessionService.invalidatePresented(req.headers.cookie);

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: any) {
    console.error('Logout failed', {
      operation: 'logout',
      reasonCode: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

export default router;
