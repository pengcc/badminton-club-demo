import { createHash, randomBytes } from 'node:crypto';
import type { Response } from 'express';
import mongoose, { Types, type ClientSession } from 'mongoose';
import type {
  AccountKind,
  MembershipStatus,
} from '@club/shared-types/core/enums';
import { config } from '../config';
import { AuthSession } from '../models/AuthSession';
import { ORDINARY_AUTH_SESSION_COOKIE } from '@club/shared-types/core/authSession';
import { IdentityDependencyClaimService } from './identityDependencyClaimService';

export const AUTH_SESSION_COOKIE_NAME = ORDINARY_AUTH_SESSION_COOKIE;
export const AUTH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface IssuedAuthSession {
  token: string;
  expiresAt: Date;
}

export interface ResolvedAuthSession {
  id: string;
  userId: string;
  authSessionGeneration: number;
  expiresAt: Date;
}

interface AuthSessionReplacement {
  cookieHeader: string | undefined;
  userId: Types.ObjectId;
  expectedUserVersion: number;
  accountKind: AccountKind;
  membershipStatus?: MembershipStatus;
  authSessionGeneration: number;
}

export type AuthSessionResolution =
  | { kind: 'valid'; session: ResolvedAuthSession }
  | { kind: 'invalid' };

function digest(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function normalizedGeneration(value: unknown): number {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

function cookieValue(cookieHeader: string | undefined): string | undefined {
  for (const part of cookieHeader?.split(';') ?? []) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    if (name !== AUTH_SESSION_COOKIE_NAME) continue;
    const value = part.slice(separator + 1).trim();
    return value || undefined;
  }
  return undefined;
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
}

export class AuthSessionService {
  static digest(token: string): string {
    return digest(token);
  }

  static generation(value: unknown): number {
    return normalizedGeneration(value);
  }

  static credentialFromCookie(
    cookieHeader: string | undefined
  ): string | undefined {
    return cookieValue(cookieHeader);
  }

  static async create(
    userId: string,
    authSessionGeneration: number,
    session?: ClientSession
  ): Promise<IssuedAuthSession> {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + AUTH_SESSION_TTL_MS);
    await AuthSession.create(
      [
        {
          tokenDigest: digest(token),
          userId: new Types.ObjectId(userId),
          authSessionGeneration: normalizedGeneration(authSessionGeneration),
          expiresAt,
        },
      ],
      session ? { session } : undefined
    );
    return { token, expiresAt };
  }

  static async replacePresented(
    replacement: AuthSessionReplacement
  ): Promise<IssuedAuthSession> {
    const session = await mongoose.startSession();
    try {
      let issued: IssuedAuthSession | undefined;
      let completed = false;
      await session.withTransaction(async () => {
        completed = false;
        await IdentityDependencyClaimService.claimUser(
          {
            userId: replacement.userId,
            expectedVersion: replacement.expectedUserVersion,
            accountKind: replacement.accountKind,
            membershipStatus: replacement.membershipStatus,
          },
          session
        );

        const presented = cookieValue(replacement.cookieHeader);
        if (presented) {
          await AuthSession.deleteOne(
            { tokenDigest: digest(presented) },
            { session }
          );
        }
        issued = await this.create(
          replacement.userId.toString(),
          replacement.authSessionGeneration,
          session
        );
        completed = true;
      });
      if (!completed || !issued) {
        throw new Error(
          'Authentication session transaction produced no result'
        );
      }
      return issued;
    } finally {
      await session.endSession();
    }
  }

  static async resolve(
    cookieHeader: string | undefined,
    now = new Date()
  ): Promise<AuthSessionResolution> {
    const token = cookieValue(cookieHeader);
    if (!token) return { kind: 'invalid' };

    const record = await AuthSession.findOne({ tokenDigest: digest(token) })
      .select('+tokenDigest')
      .lean();
    if (!record || record.expiresAt.getTime() <= now.getTime()) {
      return { kind: 'invalid' };
    }

    return {
      kind: 'valid',
      session: {
        id: record._id.toString(),
        userId: record.userId.toString(),
        authSessionGeneration: normalizedGeneration(
          record.authSessionGeneration
        ),
        expiresAt: record.expiresAt,
      },
    };
  }

  static async invalidatePresented(
    cookieHeader: string | undefined
  ): Promise<void> {
    const token = cookieValue(cookieHeader);
    if (!token) return;
    await AuthSession.deleteOne({ tokenDigest: digest(token) });
  }

  static async invalidateById(sessionId: string): Promise<void> {
    await AuthSession.deleteOne({ _id: sessionId });
  }

  static async deleteOlderGenerations(
    userId: string,
    currentGeneration: number,
    session?: ClientSession
  ): Promise<void> {
    await AuthSession.deleteMany(
      {
        userId: new Types.ObjectId(userId),
        authSessionGeneration: { $ne: normalizedGeneration(currentGeneration) },
      },
      session ? { session } : undefined
    );
  }

  static async deleteAllForUser(
    userId: string,
    session: ClientSession
  ): Promise<void> {
    await AuthSession.deleteMany(
      { userId: new Types.ObjectId(userId) },
      { session }
    );
  }

  static setCookie(res: Response, issued: IssuedAuthSession): void {
    res.cookie(AUTH_SESSION_COOKIE_NAME, issued.token, {
      ...cookieOptions(),
      maxAge: AUTH_SESSION_TTL_MS,
      expires: issued.expiresAt,
    });
  }
}
