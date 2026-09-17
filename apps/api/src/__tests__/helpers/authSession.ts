import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { vi } from 'vitest';
import { config } from '../../config';
import { AuthSession } from '../../models/AuthSession';
import {
  AccountKind,
  AccountOnboardingStatus,
  Gender,
  MembershipStatus,
} from '@club/shared-types/core/enums';
import {
  AUTH_SESSION_COOKIE_NAME,
  AuthSessionService,
} from '../../services/authSessionService';

interface MockSessionRecord {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  authSessionGeneration: number;
  expiresAt: Date;
}

const mockSessions = new Map<string, MockSessionRecord>();

export const FIRST_PARTY_ORIGIN = new URL(config.frontendUrl).origin;

const canonicalTimestamp = new Date('2026-01-01T00:00:00.000Z');

export function canonicalAuthUserDocument(
  overrides: Record<string, unknown> = {}
) {
  const accountKind =
    overrides.accountKind === AccountKind.SUPER_ADMIN
      ? AccountKind.SUPER_ADMIN
      : AccountKind.PERSON;
  const id = String(overrides.id ?? overrides._id ?? new Types.ObjectId());
  const base = {
    _id: overrides._id ?? id,
    id,
    email: overrides.email ?? 'authenticated@example.test',
    accountKind,
    accountOnboardingStatus:
      overrides.accountOnboardingStatus ?? AccountOnboardingStatus.READY,
    authSessionGeneration: overrides.authSessionGeneration ?? 0,
    createdAt: overrides.createdAt ?? canonicalTimestamp,
    updatedAt: overrides.updatedAt ?? canonicalTimestamp,
  };
  const plain =
    accountKind === AccountKind.SUPER_ADMIN
      ? {
          ...base,
          administratorDesignation: false,
          isPlayer: false,
        }
      : {
          ...base,
          firstName: overrides.firstName ?? 'Authenticated',
          lastName: overrides.lastName ?? 'User',
          gender: overrides.gender ?? Gender.NON_BINARY,
          dateOfBirth: overrides.dateOfBirth ?? '1990-01-01',
          administratorDesignation: overrides.administratorDesignation ?? false,
          membershipStatus:
            overrides.membershipStatus ?? MembershipStatus.ACTIVE,
          accountSuspension: overrides.accountSuspension,
          isPlayer: overrides.isPlayer ?? false,
        };

  return {
    ...plain,
    toObject: () => plain,
  };
}

export function installMockAuthSessionStore(): void {
  mockSessions.clear();
  vi.spyOn(AuthSession, 'findOne').mockImplementation(((filter: {
    tokenDigest?: string;
  }) => ({
    select: () => ({
      lean: async () =>
        filter.tokenDigest
          ? (mockSessions.get(filter.tokenDigest) ?? null)
          : null,
    }),
  })) as never);
  vi.spyOn(AuthSession, 'deleteOne').mockResolvedValue({
    acknowledged: true,
  } as never);
}

export function mockAuthSessionCookie(
  userId: string,
  authSessionGeneration = 0
): string {
  if (!vi.isMockFunction(AuthSession.findOne)) {
    installMockAuthSessionStore();
  }
  const token = `test-${randomUUID()}`;
  mockSessions.set(AuthSessionService.digest(token), {
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId(userId),
    authSessionGeneration,
    expiresAt: new Date(Date.now() + 60_000),
  });
  return `${AUTH_SESSION_COOKIE_NAME}=${token}`;
}

export async function createAuthSessionCookie(
  userId: string,
  authSessionGeneration = 0
): Promise<string> {
  const issued = await AuthSessionService.create(userId, authSessionGeneration);
  return `${AUTH_SESSION_COOKIE_NAME}=${issued.token}`;
}
