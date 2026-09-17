// shared/types/core/middlewareAuth.ts
// Express middleware and infrastructure auth types
import type { AccountKind, Capability } from './enums';

/**
 * Authenticated user information
 */
export interface AuthUser {
  readonly id: string;
  readonly accountKind: AccountKind;
  readonly displayName: string;
  readonly capabilities: Capability[];
  readonly playerId?: string;
  readonly email: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly demoMode?: boolean;
}

/**
 * Authentication request with strict typing
 */
export interface AuthenticatedRequest<
  TBody = unknown,
  TQuery = unknown,
  TParams = unknown,
> {
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
  UPDATE_MATCH_RESULT: 'matches:update:result',

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
  MANAGE_ADMINISTRATOR_DESIGNATION: 'users:manage:administrator-designation',

  // Content management scopes
  MANAGE_CONTENT: 'content:manage',
} as const;

/**
 * Auth error types
 */
export enum AuthErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SESSION_INVALID = 'SESSION_INVALID',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',
}
