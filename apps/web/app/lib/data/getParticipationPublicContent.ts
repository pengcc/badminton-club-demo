import { unstable_cache } from 'next/cache';
import type { TasterSessionPublicContentPublicResponse } from '@club/shared-types/api/tasterSessionPublicContent';
import type { MembershipPublicContentPublicResponse } from '@club/shared-types/api/membershipPublicContent';
import type { Language } from '@club/shared-types/core/enums';
import {
  MEMBERSHIP_INFORMATION_CACHE_TAG,
  TASTER_INFORMATION_CACHE_TAG,
} from './publicContentCache';

export type PublicContentResult<T> =
  | { status: 'ready'; content: T }
  | { status: 'unavailable' };

const API_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3003';

function hasStringFields(value: unknown, fields: readonly string[]): boolean {
  if (!value || typeof value !== 'object') return false;
  return fields.every(
    (field) => typeof (value as Record<string, unknown>)[field] === 'string'
  );
}

async function load<T>(
  path: string,
  locale: Language,
  fields: readonly string[]
): Promise<T> {
  const response = await fetch(`${API_URL}/api/${path}?language=${locale}`);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  const body: unknown = await response.json();
  const data =
    body && typeof body === 'object'
      ? (body as { data?: unknown }).data
      : undefined;
  if (
    (body as { success?: unknown })?.success !== true ||
    !hasStringFields(data, fields)
  ) {
    throw new Error(`${path}: invalid response`);
  }
  return data as T;
}

const loadTaster = unstable_cache(
  (locale: Language) =>
    load<TasterSessionPublicContentPublicResponse>(
      'taster-session-content',
      locale,
      [
        'homepageSummary',
        'introduction',
        'preparation',
        'participationGuidance',
        'followUpGuidance',
      ]
    ),
  ['taster-information-projection', API_URL],
  { tags: [TASTER_INFORMATION_CACHE_TAG], revalidate: 3600 }
);

const loadMembership = unstable_cache(
  (locale: Language) =>
    load<MembershipPublicContentPublicResponse>('membership-content', locale, [
      'homepageSummary',
      'introduction',
      'membershipTypes',
      'membershipPath',
      'applicationPreparation',
      'studentProof',
    ]),
  ['membership-information-projection', API_URL],
  { tags: [MEMBERSHIP_INFORMATION_CACHE_TAG], revalidate: 3600 }
);

export async function getTasterSessionPublicContent(
  locale: Language
): Promise<PublicContentResult<TasterSessionPublicContentPublicResponse>> {
  try {
    return { status: 'ready', content: await loadTaster(locale) };
  } catch {
    console.error('Taster Session public information retrieval failed');
    return { status: 'unavailable' };
  }
}

export async function getMembershipPublicContent(
  locale: Language
): Promise<PublicContentResult<MembershipPublicContentPublicResponse>> {
  try {
    return { status: 'ready', content: await loadMembership(locale) };
  } catch {
    console.error('Membership public information retrieval failed');
    return { status: 'unavailable' };
  }
}

export async function getMembershipAvailability(): Promise<boolean | null> {
  try {
    const response = await fetch(`${API_URL}/api/settings/membership`, {
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const body: unknown = await response.json();
    const value = (body as { data?: { membershipOpen?: unknown } })?.data
      ?.membershipOpen;
    return typeof value === 'boolean' ? value : null;
  } catch {
    return null;
  }
}
