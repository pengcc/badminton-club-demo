import { z } from 'zod';

/**
 * View layer interfaces for authentication
 */
export interface AuthTokenView {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  tokenType: string;
}

export interface AuthUserView {
  id: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  isEmailVerified: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuthSessionView {
  id: string;
  userId: string;
  deviceInfo?: {
    userAgent?: string;
    platform?: string;
    browser?: string;
  };
  ipAddress?: string;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
}

/**
 * Zod validation schemas for auth view types
 */
export const authTokenViewSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.string(),
  tokenType: z.string()
});

export const authUserViewSchema = z.object({
  id: z.string().min(1),
  email: z.email(),
  role: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  isEmailVerified: z.boolean(),
  lastLoginAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export const authSessionViewSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  deviceInfo: z.object({
    userAgent: z.string().optional(),
    platform: z.string().optional(),
    browser: z.string().optional()
  }).optional(),
  ipAddress: z.string().optional(),
  createdAt: z.string(),
  expiresAt: z.string(),
  isActive: z.boolean()
});