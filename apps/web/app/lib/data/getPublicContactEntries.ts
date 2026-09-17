import { unstable_cache } from 'next/cache';
import { contactExternalLinkSchema } from '@club/shared-types/api/contact';
import type { Language } from '@club/shared-types/core/enums';
import { CONTACT_ENTRIES_CACHE_TAG } from './publicContentCache';

export interface PublicContactEntry {
  id: string;
  category: string;
  title: string;
  description: string;
  email: string;
  qrCode: string;
  qrExplanation: string;
  externalLink: string;
  externalLinkLabel: string;
  order: number;
}

export type PublicContactEntriesResult =
  | { status: 'ready'; entries: PublicContactEntry[] }
  | { status: 'unavailable' };

const API_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3003';

function isEntry(value: unknown): value is PublicContactEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    typeof entry.category === 'string' &&
    typeof entry.title === 'string' &&
    typeof entry.description === 'string' &&
    typeof entry.email === 'string' &&
    typeof entry.qrCode === 'string' &&
    typeof entry.qrExplanation === 'string' &&
    contactExternalLinkSchema.safeParse(entry.externalLink).success &&
    typeof entry.externalLinkLabel === 'string' &&
    typeof entry.order === 'number'
  );
}

async function load(locale: Language): Promise<PublicContactEntry[]> {
  const response = await fetch(
    `${API_URL}/api/contact-entries?language=${locale}`
  );
  if (!response.ok) throw new Error(`Contact entries: ${response.status}`);
  const body: unknown = await response.json();
  if (
    !body ||
    typeof body !== 'object' ||
    (body as { success?: unknown }).success !== true ||
    !Array.isArray((body as { data?: unknown }).data) ||
    !(body as { data: unknown[] }).data.every(isEntry)
  )
    throw new Error('Contact entries: invalid response');
  return (body as { data: PublicContactEntry[] }).data;
}

const cached = unstable_cache(load, ['contact-entries-projection', API_URL], {
  tags: [CONTACT_ENTRIES_CACHE_TAG],
  revalidate: 3600,
});

export async function getPublicContactEntries(
  locale: Language
): Promise<PublicContactEntriesResult> {
  try {
    return { status: 'ready', entries: await cached(locale) };
  } catch {
    console.error('Contact entry retrieval failed');
    return { status: 'unavailable' };
  }
}
