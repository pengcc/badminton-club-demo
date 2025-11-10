// shared/types/core/middlewareAuth.ts
// Express middleware and infrastructure auth types
import { UserRole } from './enums';

/**
 * JWT payload interface
 */
export interface JWTPayload {
  readonly sub: string; // User ID
  readonly role: UserRole;
  readonly iat: number; // Issued at timestamp
  readonly exp: number; // Expiration timestamp
}

/**
 * Authenticated user information
 */
export interface AuthUser {
  readonly id: string;
  readonly role: UserRole;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
}

/**
 * Authentication request with strict typing
 */
export interface AuthenticatedRequest<TBody = unknown, TQuery = unknown, TParams = unknown> {
  readonly user: AuthUser;
  readonly body: TBody;
  readonly query: TQuery;
  readonly params: TParams;
}

/**
 * Authorization scopes for endpoints
 */
export const AuthScope = {
  // Match scopes
  CREATE_MATCH: 'matches:create',
  READ_MATCH: 'matches:read',
  UPDATE_MATCH: 'matches:update',
  DELETE_MATCH: 'matches:delete',
  UPDATE_MATCH_STATUS: 'matches:update:status',
  UPDATE_MATCH_LINEUP: 'matches:update:lineup',
  UPDATE_MATCH_SCORE: 'matches:update:score',

  // Team scopes
  CREATE_TEAM: 'teams:create',
  READ_TEAM: 'teams:read',
  UPDATE_TEAM: 'teams:update',
  DELETE_TEAM: 'teams:delete',
  MANAGE_TEAM_MEMBERS: 'teams:manage:members',

  // Player scopes
  CREATE_PLAYER: 'players:create',
  READ_PLAYER: 'players:read',
  UPDATE_PLAYER: 'players:update',
  DELETE_PLAYER: 'players:delete',

  // User management scopes
  CREATE_USER: 'users:create',
  READ_USER: 'users:read',
  UPDATE_USER: 'users:update',
  DELETE_USER: 'users:delete',
  MANAGE_USER_ROLES: 'users:manage:roles',

  // Content management scopes
  MANAGE_CONTENT: 'content:manage'
} as const;

/**
 * Auth error types
 */
export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED'
}
