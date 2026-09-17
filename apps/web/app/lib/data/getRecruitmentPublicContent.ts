import { unstable_cache } from 'next/cache';
import type { RecruitmentPublicContentPublicResponse } from '@club/shared-types/api/recruitmentPublicContent';
import type { Language } from '@club/shared-types/core/enums';
import { RECRUITMENT_INFORMATION_CACHE_TAG } from './publicContentCache';
import type { PublicContentResult } from './getParticipationPublicContent';

const API_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3003';

function isRecruitmentContent(
  value: unknown
): value is RecruitmentPublicContentPublicResponse {
  if (!value || typeof value !== 'object') return false;
  const content = value as Record<string, unknown>;
  return (
    typeof content.isOpen === 'boolean' &&
    typeof content.introduction === 'string' &&
    content.introduction.trim().length > 0 &&
    typeof content.requirements === 'string' &&
    content.requirements.trim().length > 0 &&
    typeof content.tryoutGuidance === 'string' &&
    content.tryoutGuidance.trim().length > 0 &&
    (content.contactEntryId === null ||
      typeof content.contactEntryId === 'string')
  );
}

const loadRecruitment = unstable_cache(
  async (locale: Language): Promise<RecruitmentPublicContentPublicResponse> => {
    const response = await fetch(
      `${API_URL}/api/recruitment-content?language=${locale}`
    );
    if (!response.ok)
      throw new Error(`Recruitment content: ${response.status}`);
    const body: unknown = await response.json();
    const data =
      body && typeof body === 'object'
        ? (body as { data?: unknown }).data
        : undefined;
    if (
      (body as { success?: unknown })?.success !== true ||
      !isRecruitmentContent(data)
    ) {
      throw new Error('Recruitment content: invalid response');
    }
    return data;
  },
  ['recruitment-information-projection', API_URL],
  { tags: [RECRUITMENT_INFORMATION_CACHE_TAG], revalidate: 3600 }
);

export async function getRecruitmentPublicContent(
  locale: Language
): Promise<PublicContentResult<RecruitmentPublicContentPublicResponse>> {
  try {
    return { status: 'ready', content: await loadRecruitment(locale) };
  } catch {
    console.error('Recruitment public information retrieval failed');
    return { status: 'unavailable' };
  }
}
