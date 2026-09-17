import { unstable_cache } from 'next/cache';
import type { Language } from '@club/shared-types/core/enums';
import { PUBLIC_DOCUMENT_CACHE_TAG } from './publicDocumentCache';

export interface PublicDocumentPublic {
  id: string;
  displayName: string;
  documentDate: string;
  fileUrl: string;
}

export type PublicDocumentsResult =
  | { status: 'ready'; documents: PublicDocumentPublic[] }
  | { status: 'unavailable' };

const API_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3003';

function isPublicDocument(value: unknown): value is PublicDocumentPublic {
  if (!value || typeof value !== 'object') return false;
  const document = value as Record<string, unknown>;
  return (
    typeof document.id === 'string' &&
    /^[a-f\d]{24}$/i.test(document.id) &&
    typeof document.displayName === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(document.documentDate)) &&
    typeof document.fileUrl === 'string'
  );
}

async function loadValidatedPublicDocuments(
  locale: Language
): Promise<PublicDocumentPublic[]> {
  const response = await fetch(
    `${API_URL}/api/public-documents?language=${locale}`
  );
  if (!response.ok) throw new Error(`Public Documents: ${response.status}`);
  const body: unknown = await response.json();
  if (
    !body ||
    typeof body !== 'object' ||
    (body as { success?: unknown }).success !== true ||
    !Array.isArray((body as { data?: unknown }).data) ||
    !(body as { data: unknown[] }).data.every(isPublicDocument)
  ) {
    throw new Error('Public Documents: invalid response');
  }
  return (body as { data: PublicDocumentPublic[] }).data;
}

const getCachedPublicDocuments = unstable_cache(
  loadValidatedPublicDocuments,
  ['public-documents-projection-v2', API_URL],
  { tags: [PUBLIC_DOCUMENT_CACHE_TAG], revalidate: 3600 }
);

export async function getPublicDocuments(
  locale: Language
): Promise<PublicDocumentsResult> {
  try {
    return {
      status: 'ready',
      documents: await getCachedPublicDocuments(locale),
    };
  } catch {
    console.error('Public Document retrieval failed');
    return { status: 'unavailable' };
  }
}
