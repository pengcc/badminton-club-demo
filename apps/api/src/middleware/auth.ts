import type { Request, Response, NextFunction, RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { Types } from 'mongoose';
import { User } from '../models/User';
import { AppError } from '../utils/errors';
import type { AuthUser, JWTPayload } from '@club/shared-types/core/middlewareAuth';
import { UserRole } from '@club/shared-types/core/enums';

/**
 * Generic authenticated request with strongly typed body, query and params
 */
export interface AuthenticatedRequest<
  TBody = any,
  TQuery = any,
  TParams = any
> extends Request<TParams, any, TBody, TQuery> {
  user: AuthUser;
  container: {
    resolve<T>(token: { new (...args: any[]): T }): T;
  };
}

/**
 * Type for role-based authorization
 */
type AuthorizeRoles = UserRole | UserRole[];

/**
 * Type guard to check if a value is an AuthUser
 */
const isAuthUser = (user: any): user is AuthUser => {
  return user &&
    typeof user.id === 'string' &&
    Object.values(UserRole).includes(user.role) &&
    typeof user.firstName === 'string' &&
    typeof user.lastName === 'string';
};

/**
 * Authentication middleware - verifies JWT token and attaches user to request
 */
export const protect: RequestHandler = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next(new AppError('Invalid authorization header format', 401));
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return next(new AppError('Not authorized to access this route', 401));
    }

    try {
      // Use a unified secret retrieval strategy matching the auth routes
      const jwtSecret = process.env.JWT_SECRET || 'fallback_secret';
      if (!process.env.JWT_SECRET) {
        // Surface a clear warning in logs if fallback secret is being used (development aid)
        console.warn('[auth.protect] JWT_SECRET not set; using insecure fallback_secret. Set JWT_SECRET in environment for production.');
      }

      const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

      if (!decoded.sub || !Types.ObjectId.isValid(decoded.sub)) {
        return next(new AppError('Invalid token payload', 401));
      }

      const user = await User.findById(decoded.sub).select('+role +firstName +lastName +email');

      if (!user) {
        return next(new AppError('User not found', 401));
      }

      const authUser: AuthUser = {
        id: user.id,
        role: user.role,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName
      };

      if (!isAuthUser(authUser)) {
        return next(new AppError('Invalid user data', 401));
      }

      (req as AuthenticatedRequest).user = authUser;
      next();
    } catch (error: any) {
      if (error instanceof jwt.JsonWebTokenError) {
        return next(new AppError('Invalid or expired token', 401));
      }
      // Preserve existing AppError details instead of masking them
      if (error instanceof AppError) {
        return next(error);
      }
      return next(new AppError('Authentication error', 401));
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Role-based authorization middleware
 */
export const authorize = (roles: AuthorizeRoles): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authReq = req as AuthenticatedRequest;

    if (!authReq.user) {
      return next(new AppError('Not authorized to access this route', 401));
    }

    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    if (!allowedRoles.includes(authReq.user.role)) {
      return next(
        new AppError(`User role ${authReq.user.role} is not authorized to access this route`, 403)
      );
    }

    next();
  };
};

/**
 * Ownership check function type - returns true if user owns the resource
 */
type OwnershipCheck = (resourceId: string, userId: string, container: AuthenticatedRequest['container']) => Promise<boolean>;

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
      const resourceId = typeof resourceIdParam === 'string'
        ? req.params[resourceIdParam]
        : resourceIdParam(req);

      if (!resourceId) {
        return next(new AppError('Resource ID not found in request', 400));
      }

      // Allow admins to access any resource
      if (authReq.user.role === UserRole.ADMIN) {
        return next();
      }

      if (ownershipCheck) {
        // Use custom ownership check for complex cases
        const isOwner = await ownershipCheck(resourceId, authReq.user.id, authReq.container);
        if (!isOwner) {
          return next(new AppError('Not authorized to access this resource', 403));
        }
      } else {
        // Direct user ID comparison for simple cases
        if (resourceId !== authReq.user.id) {
          return next(new AppError('Not authorized to access this resource', 403));
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};