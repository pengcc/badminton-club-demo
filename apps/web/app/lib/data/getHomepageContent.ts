import { cache } from 'react';
import type { HomepageContentPublicResponse } from '@club/shared-types/api/homepageContent';
import type { ClubInformationPublicResponse } from '@club/shared-types/api/clubInformation';
import {
  LOCATION_WEEKDAYS,
  type LocationTimeSlot,
} from '@club/shared-types/api/location';
import type { Language } from '@club/shared-types/core/enums';
import {
  announcementExternalLinkSchema,
  AnnouncementType,
  type AnnouncementPublicResponse,
} from '@club/shared-types/api/announcement';
import type { PublicProjectionResult } from './publicProjection';
import { LOCATIONS_CACHE_TAG } from './publicContentCache';

export type PublicAnnouncement = AnnouncementPublicResponse;

export interface PublicLocation {
  id: string;
  name: string;
  address: string;
  timeSlots: LocationTimeSlot[];
  imageUrl: string;
}

// Server-only API_URL (not exposed to browser) for SSR, fallback to public URL
const API_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3003';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isHomepageContentEnvelope(
  value: unknown
): value is { success: true; data: HomepageContentPublicResponse } {
  if (!isRecord(value) || value.success !== true || !isRecord(value.data)) {
    return false;
  }
  const data = value.data;
  return (
    typeof data.mainMessage === 'string' &&
    data.mainMessage.trim().length > 0 &&
    typeof data.visitUsIntroduction === 'string' &&
    typeof data.contactIntroduction === 'string'
  );
}

function isClubInformationEnvelope(
  value: unknown
): value is { success: true; data: ClubInformationPublicResponse } {
  if (!isRecord(value) || value.success !== true || !isRecord(value.data)) {
    return false;
  }
  const data = value.data;
  return (
    typeof data.officialNameGerman === 'string' &&
    data.officialNameGerman.trim().length > 0 &&
    typeof data.nameEnglish === 'string' &&
    typeof data.nameChinese === 'string' &&
    typeof data.localizedName === 'string' &&
    data.localizedName.trim().length > 0 &&
    typeof data.shortName === 'string' &&
    data.shortName.trim().length > 0 &&
    (data.foundingYear === null ||
      (typeof data.foundingYear === 'number' &&
        Number.isInteger(data.foundingYear) &&
        data.foundingYear >= 1800 &&
        data.foundingYear <= 2200)) &&
    typeof data.introduction === 'string' &&
    data.introduction.trim().length > 0
  );
}

function isAnnouncement(value: unknown): value is PublicAnnouncement {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.title === 'string' &&
    value.title.trim().length > 0 &&
    typeof value.content === 'string' &&
    value.content.trim().length > 0 &&
    typeof value.displayDate === 'string' &&
    value.displayDate.length > 0 &&
    Object.values(AnnouncementType).includes(value.type as AnnouncementType) &&
    (value.externalLink === undefined ||
      (typeof value.externalLink === 'string' &&
        announcementExternalLinkSchema.safeParse(value.externalLink).success))
  );
}

function isLocationTimeSlot(value: unknown): value is LocationTimeSlot {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.weekday === 'string' &&
    LOCATION_WEEKDAYS.includes(
      value.weekday as (typeof LOCATION_WEEKDAYS)[number]
    ) &&
    typeof value.startTime === 'string' &&
    typeof value.endTime === 'string' &&
    typeof value.active === 'boolean'
  );
}

function isLocation(value: unknown): value is PublicLocation {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    typeof value.address === 'string' &&
    value.address.trim().length > 0 &&
    typeof value.imageUrl === 'string' &&
    Array.isArray(value.timeSlots) &&
    value.timeSlots.every(isLocationTimeSlot)
  );
}

function isListEnvelope<T>(
  value: unknown,
  isItem: (item: unknown) => item is T
): value is { success: true; data: T[] } {
  return (
    isRecord(value) &&
    value.success === true &&
    Array.isArray(value.data) &&
    value.data.every(isItem)
  );
}

/**
 * Server-side data fetching for homepage content
 * Uses ISR with 1-hour revalidation
 */
export const getHomepageContent = cache(
  async (
    locale: Language
  ): Promise<PublicProjectionResult<HomepageContentPublicResponse>> => {
    try {
      const response = await fetch(
        `${API_URL}/api/content?language=${locale}`,
        {
          next: { revalidate: 3600 },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch content: ${response.statusText}`);
      }

      const result: unknown = await response.json();
      if (!isHomepageContentEnvelope(result)) {
        throw new Error('Homepage content: invalid response');
      }
      return { status: 'ready', data: result.data };
    } catch {
      console.error('Homepage content retrieval failed');
      return { status: 'unavailable' };
    }
  }
);

export const getClubInformation = cache(
  async (
    locale: Language
  ): Promise<PublicProjectionResult<ClubInformationPublicResponse>> => {
    try {
      const response = await fetch(
        `${API_URL}/api/club-information?language=${locale}`,
        { next: { revalidate: 3600 } }
      );
      if (!response.ok) {
        throw new Error(
          `Failed to fetch club information: ${response.statusText}`
        );
      }
      const result: unknown = await response.json();
      if (!isClubInformationEnvelope(result)) {
        throw new Error('Club information: invalid response');
      }
      return { status: 'ready', data: result.data };
    } catch {
      console.error('Club information retrieval failed');
      return { status: 'unavailable' };
    }
  }
);

/**
 * Server-side data fetching for announcements
 * Uses ISR with 1-hour revalidation
 */
export const getAnnouncements = cache(
  async (
    locale: Language
  ): Promise<PublicProjectionResult<PublicAnnouncement[]>> => {
    try {
      const response = await fetch(
        `${API_URL}/api/announcements?language=${locale}`,
        {
          next: { revalidate: 3600 }, // ISR: 1 hour background refresh
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch announcements: ${response.statusText}`
        );
      }

      const result: unknown = await response.json();
      if (!isListEnvelope(result, isAnnouncement)) {
        throw new Error('Announcements: invalid response');
      }
      return { status: 'ready', data: result.data };
    } catch {
      console.error('Announcement retrieval failed');
      return { status: 'unavailable' };
    }
  }
);

/**
 * Server-side data fetching for locations
 * Uses ISR with 1-hour revalidation
 */
export const getLocations = cache(
  async (
    locale: Language
  ): Promise<PublicProjectionResult<PublicLocation[]>> => {
    try {
      const response = await fetch(
        `${API_URL}/api/locations?language=${locale}`,
        {
          next: { revalidate: 3600, tags: [LOCATIONS_CACHE_TAG] },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch locations: ${response.statusText}`);
      }

      const result: unknown = await response.json();
      if (!isListEnvelope(result, isLocation)) {
        throw new Error('Locations: invalid response');
      }
      return { status: 'ready', data: result.data };
    } catch {
      console.error('Location retrieval failed');
      return { status: 'unavailable' };
    }
  }
);

/**
 * Server-side data fetching for membership configuration
 * Always fetches fresh data (no cache) since the admin toggle must reflect immediately
 */
export const getMembershipConfig = cache(
  async (): Promise<{ membershipOpen: boolean }> => {
    try {
      const response = await fetch(`${API_URL}/api/settings/membership`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch membership config: ${response.statusText}`
        );
      }

      const result = await response.json();
      return result.data || { membershipOpen: false };
    } catch {
      console.error('Membership configuration retrieval failed');
      return { membershipOpen: false };
    }
  }
);
