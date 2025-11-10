import { Response, Request, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  count?: number;
  total?: number;
  page?: number;
  pages?: number;
  currentPage?: number;
  totalPages?: number;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  total: number;
}

/**
 * Utility class for standardized API responses
 */
export class ResponseHelper {
  /**
   * Send success response
   */
  static success<T>(res: Response, data?: T, message?: string, statusCode: number = 200): void {
    const response: ApiResponse<T> = {
      success: true,
      message,
      data
    };
    res.status(statusCode).json(response);
  }

  /**
   * Send success response with pagination
   */
  static successWithPagination<T>(
    res: Response,
    data: T[],
    pagination: PaginationOptions,
    message?: string,
    statusCode: number = 200
  ): void {
    const { page, limit, total } = pagination;
    const response: ApiResponse<T[]> = {
      success: true,
      message,
      data,
      count: data.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      currentPage: page,
      totalPages: Math.ceil(total / limit)
    };
    res.status(statusCode).json(response);
  }

  /**
   * Send error response
   */
  static error(res: Response, message: string, statusCode: number = 500): void {
    const response: ApiResponse = {
      success: false,
      message
    };
    res.status(statusCode).json(response);
  }

  /**
   * Send validation error response
   */
  static validationError(res: Response, errors: any): void {
    let message: string;

    if (errors.name === 'ValidationError') {
      const messages = Object.values(errors.errors).map((val: any) => val.message);
      message = messages.join(', ');
    } else if (Array.isArray(errors)) {
      message = errors.join(', ');
    } else {
      message = errors.toString();
    }

    this.error(res, message, 400);
  }

  /**
   * Send not found error
   */
  static notFound(res: Response, resource: string = 'Resource'): void {
    this.error(res, `${resource} not found`, 404);
  }

  /**
   * Send unauthorized error
   */
  static unauthorized(res: Response, message: string = 'Not authorized'): void {
    this.error(res, message, 403);
  }

  /**
   * Send bad request error
   */
  static badRequest(res: Response, message: string): void {
    this.error(res, message, 400);
  }
}

/**
 * Permission checking utility
 */
export class PermissionHelper {
  /**
   * Check if user can access resource
   */
  static canAccess(userRole: string, resourceOwnerId: string, requestingUserId: string): boolean {
    const isAdmin = userRole === 'admin';
    const isOwner = resourceOwnerId === requestingUserId;
    return isAdmin || isOwner;
  }

  /**
   * Check if user is admin
   */
  static isAdmin(userRole: string): boolean {
    return userRole === 'admin' || userRole === 'super admin';
  }

  /**
   * Check if user is super admin
   */
  static isSuperAdmin(userRole: string): boolean {
    return userRole === 'super admin';
  }
}

/**
 * Validation utility
 */
export class ValidationHelper {
  /**
   * Validate required fields
   */
  static validateRequiredFields(data: any, requiredFields: string[]): string[] {
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      if (!data[field]) {
        missingFields.push(field);
      }
    }

    return missingFields;
  }

  /**
   * Filter allowed fields from request body
   */
  static filterAllowedFields(data: any, allowedFields: string[]): any {
    const filtered: any = {};

    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.includes(key) && value !== undefined) {
        filtered[key] = value;
      }
    }

    return filtered;
  }

  /**
   * Parse pagination parameters
   */
  static parsePagination(query: any, defaultLimit: number = 10): { page: number; limit: number; skip: number } {
    const page = Math.max(1, parseInt(query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(query.limit as string) || defaultLimit));
    const skip = (page - 1) * limit;

    return { page, limit, skip };
  }
}

export const asyncHandler = (fn: (req: AuthenticatedRequest, res: Response) => Promise<any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req as AuthenticatedRequest, res);
    } catch (error) {
      next(error);
    }
  };
};