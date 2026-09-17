import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { User } from '../models/User';
import { AppError } from '../utils/errors';
import {
  evaluateUserCapabilities,
  reportCapabilityContradictions,
} from '../services/capabilityPolicyService';
import type { AuthUser } from '@club/shared-types/core/middlewareAuth';
import { AccountKind, Capability } from '@club/shared-types/core/enums';
import { SESSION_INVALID_ERROR_CODE } from '@club/shared-types/core/authSession';
import {
  AuthSessionService,
  type ResolvedAuthSession,
} from '../services/authSessionService';
import { isTrustedFirstPartyRequest } from './firstPartyRequest';
import { UserPersistenceTransformer } from '../transformers/user';
import { DemoRuntimePolicyService } from '../services/demoRuntimePolicyService';

/**
 * Augment Express Request type to include user and container properties
 * This allows TypeScript to recognize these properties on all Request objects
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      authSession?: ResolvedAuthSession;
      container?: {
        resolve<T>(token: { new (...args: any[]): T }): T;
      };
    }
  }
}

/**
 * Generic authenticated request with strongly typed body, query and params
 */
export interface AuthenticatedRequest<TBody = any, TQuery = any, TParams = any>
  extends Request<TParams, any, TBody, TQuery> {
  user: AuthUser;
  authSession: ResolvedAuthSession;
  container: {
    resolve<T>(token: { new (...args: any[]): T }): T;
  };
}

/**
 * Type guard to check if a value is an AuthUser
 */
const isAuthUser = (user: any): user is AuthUser => {
  return (
    user &&
    typeof user.id === 'string' &&
    Object.values(AccountKind).includes(user.accountKind) &&
    Array.isArray(user.capabilities) &&
    user.capabilities.every((capability: Capability) =>
      Object.values(Capability).includes(capability)
    ) &&
    typeof user.displayName === 'string'
  );
};

async function cleanupLogicallyInvalidSession(
  sessionId: string
): Promise<void> {
  try {
    await AuthSessionService.invalidateById(sessionId);
  } catch {
    // Generation and eligibility checks are the revocation authority. Row deletion is cleanup.
    console.warn('[auth-session-cleanup-failed]');
  }
}

/**
 * Authentication middleware - resolves the ordinary account session and
 * attaches current persisted capability state to the request.
 */
export const protect: RequestHandler = async (req, res, next) => {
  try {
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) &&
      !isTrustedFirstPartyRequest({
        origin: req.get('origin'),
        referer: req.get('referer'),
      })
    ) {
      return next(
        new AppError(
          'Request origin is not trusted',
          403,
          'FIRST_PARTY_REQUEST_REQUIRED'
        )
      );
    }

    const resolution = await AuthSessionService.resolve(req.headers.cookie);
    if (resolution.kind === 'invalid') {
      return next(
        new AppError(
          'Session is invalid or expired',
          401,
          SESSION_INVALID_ERROR_CODE
        )
      );
    }

    const user = await User.findById(resolution.session.userId).select(
      '+accountKind +administratorDesignation +firstName +lastName +email +membershipStatus +accountSuspension +authSessionGeneration'
    );
    const generation = AuthSessionService.generation(
      user?.authSessionGeneration
    );
    if (!user || generation !== resolution.session.authSessionGeneration) {
      await cleanupLogicallyInvalidSession(resolution.session.id);
      return next(
        new AppError(
          'Session is invalid or expired',
          401,
          SESSION_INVALID_ERROR_CODE
        )
      );
    }

    let domainUser: ReturnType<typeof UserPersistenceTransformer.toDomain>;
    try {
      domainUser = UserPersistenceTransformer.toDomain(
        user.toObject() as never
      );
    } catch {
      await cleanupLogicallyInvalidSession(resolution.session.id);
      return next(
        new AppError(
          'Session is invalid or expired',
          401,
          SESSION_INVALID_ERROR_CODE
        )
      );
    }

    if (
      domainUser.accountKind === AccountKind.PERSON &&
      domainUser.accountSuspension
    ) {
      await cleanupLogicallyInvalidSession(resolution.session.id);
      return next(
        new AppError(
          'Session is invalid or expired',
          401,
          SESSION_INVALID_ERROR_CODE
        )
      );
    }

    const decision = await evaluateUserCapabilities({
      ...domainUser,
      _id: domainUser.id,
      passwordSetupExpiresAt: user.passwordSetupExpiresAt,
    });
    reportCapabilityContradictions(decision, 'protected_request');
    if (!decision.capabilities.includes(Capability.AUTHENTICATED_ACCOUNT)) {
      await cleanupLogicallyInvalidSession(resolution.session.id);
      return next(
        new AppError(
          'Session is invalid or expired',
          401,
          SESSION_INVALID_ERROR_CODE
        )
      );
    }

    const authUser: AuthUser = {
      id: domainUser.id,
      accountKind: domainUser.accountKind,
      displayName:
        domainUser.accountKind === AccountKind.SUPER_ADMIN
          ? 'Super Admin'
          : `${domainUser.lastName}, ${domainUser.firstName}`,
      capabilities: decision.capabilities,
      playerId: decision.playerId,
      email: domainUser.email,
      firstName:
        domainUser.accountKind === AccountKind.PERSON
          ? domainUser.firstName
          : undefined,
      lastName:
        domainUser.accountKind === AccountKind.PERSON
          ? domainUser.lastName
          : undefined,
      ...(DemoRuntimePolicyService.isDemoAdmin(domainUser)
        ? { demoMode: true }
        : {}),
    };

    if (!isAuthUser(authUser)) {
      await cleanupLogicallyInvalidSession(resolution.session.id);
      return next(
        new AppError(
          'Session is invalid or expired',
          401,
          SESSION_INVALID_ERROR_CODE
        )
      );
    }

    if (
      !DemoRuntimePolicyService.permitsProtectedRequest(
        authUser,
        req.method,
        req.originalUrl
      )
    ) {
      return next(
        new AppError(
          'This area is unavailable in the public demo',
          403,
          'DEMO_SCOPE_DENIED'
        )
      );
    }

    (req as AuthenticatedRequest).user = authUser;
    (req as AuthenticatedRequest).authSession = resolution.session;
    next();
  } catch (error) {
    next(
      error instanceof AppError
        ? error
        : AppError.internal('Authentication service is unavailable')
    );
  }
};

function logCapabilityDenial(
  req: Request,
  requiredCapabilities: readonly Capability[]
): void {
  const authReq = req as AuthenticatedRequest;
  console.warn('[capability-denied]', {
    method: req.method,
    path: req.originalUrl,
    accountKind: authReq.user?.accountKind,
    requiredCapabilities,
  });
}

/**
 * Backend-authoritative capability guard. Must run after protect so the
 * decision reflects current User and Player persistence state.
 */
export const authorizeCapability = (capability: Capability): RequestHandler => {
  return authorizeAnyCapability([capability]);
};

export const authorizeAnyCapability = (
  capabilities: readonly Capability[]
): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      return next(AppError.unauthorized('Not authorized to access this route'));
    }

    if (
      !capabilities.some((capability) =>
        authReq.user.capabilities.includes(capability)
      )
    ) {
      logCapabilityDenial(req, capabilities);
      return next(AppError.forbidden('Required capability is not available'));
    }

    next();
  };
};

/**
 * Ownership check function type - returns true if user owns the resource
 */
type OwnershipCheck = (
  resourceId: string,
  userId: string,
  container: AuthenticatedRequest['container']
) => Promise<boolean>;

/**
 * Middleware to check if user is accessing their own resource
 * @param resourceIdParam The param name or function to extract resource ID
 * @param ownershipCheck Optional function to check ownership for complex cases
 */
export const authorizeOwner = (
  resourceIdParam: string | ((req: Request) => string),
  ownershipCheck?: OwnershipCheck
): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      return next(new AppError('Not authorized to access this route', 401));
    }

    try {
      const resourceId =
        typeof resourceIdParam === 'string'
          ? (req.params[resourceIdParam] as string)
          : resourceIdParam(req);

      if (!resourceId) {
        return next(new AppError('Resource ID not found in request', 400));
      }

      // Allow admins to access any resource
      if (authReq.user.capabilities.includes(Capability.ADMINISTRATION)) {
        return next();
      }

      if (ownershipCheck) {
        // Use custom ownership check for complex cases
        const isOwner = await ownershipCheck(
          resourceId,
          authReq.user.id,
          authReq.container
        );
        if (!isOwner) {
          return next(
            new AppError('Not authorized to access this resource', 403)
          );
        }
      } else {
        // Direct user ID comparison for simple cases
        if (resourceId !== authReq.user.id) {
          return next(
            new AppError('Not authorized to access this resource', 403)
          );
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
