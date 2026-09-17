import { cookies } from 'next/headers';
import type { Api } from '@club/shared-types/api/auth';
import {
  ORDINARY_AUTH_SESSION_COOKIE,
  SESSION_INVALID_ERROR_CODE,
} from '@club/shared-types/core/authSession';
import { getServerApiBaseUrl } from '@app/lib/api/baseUrl';

const VERIFY_TIMEOUT_MS = 5_000;

export type ServerSessionVerification =
  | { kind: 'verified'; user: Api.User }
  | { kind: 'unauthenticated' }
  | { kind: 'unavailable' };

export async function verifyServerSession(
  cookieValue: string | undefined
): Promise<ServerSessionVerification> {
  if (!cookieValue) return { kind: 'unauthenticated' };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);
  try {
    const response = await fetch(`${getServerApiBaseUrl()}/api/auth/verify`, {
      headers: {
        Cookie: `${ORDINARY_AUTH_SESSION_COOKIE}=${cookieValue}`,
      },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) {
      if (response.status === 401) {
        const payload = (await response.json().catch(() => null)) as {
          code?: string;
        } | null;
        if (payload?.code === SESSION_INVALID_ERROR_CODE) {
          return { kind: 'unauthenticated' };
        }
      }
      return { kind: 'unavailable' };
    }

    const payload = (await response.json()) as { user?: Api.User };
    return payload.user
      ? { kind: 'verified', user: payload.user }
      : { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getServerSession(): Promise<ServerSessionVerification> {
  const cookieStore = await cookies();
  return verifyServerSession(
    cookieStore.get(ORDINARY_AUTH_SESSION_COOKIE)?.value
  );
}
