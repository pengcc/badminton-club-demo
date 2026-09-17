import { cache } from 'react';
import type { PublicProjectionResult } from './publicProjection';

/**
 * Server-side data fetching for the Activities page.
 * Uses React cache() and ISR with 1-hour revalidation.
 * Supports pagination via page/limit params.
 */

const API_URL = process.env.API_URL || 'http://localhost:3003';

export interface PublicActivity {
  id: string;
  name: string;
  description: string;
  images: string[];
  videoLink: string;
  videoDescription: string;
  isVisible: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ActivitiesPageData {
  activities: PublicActivity[];
  pagination: PaginationInfo;
}

export type ActivitiesPageProjectionResult =
  | PublicProjectionResult<ActivitiesPageData>
  | { status: 'disabled' };

/**
 * Fetch visible activities for the public page (SSR with ISR)
 */
export const getPublicActivities = cache(
  async (
    language: string = 'en',
    page: number = 1,
    limit: number = 6
  ): Promise<ActivitiesPageProjectionResult> => {
    try {
      const response = await fetch(
        `${API_URL}/api/activities?language=${language}&page=${page}&limit=${limit}`,
        {
          next: { revalidate: 3600 }, // ISR: revalidate every hour
        }
      );

      if (!response.ok) {
        throw new Error(`Activities: ${response.status}`);
      }

      const body: unknown = await response.json();
      if (!isActivitiesEnvelope(body)) {
        throw new Error('Activities: invalid response');
      }
      if (!body.availability.enabled) return { status: 'disabled' };
      return {
        status: 'ready',
        data: { activities: body.data, pagination: body.pagination },
      };
    } catch {
      console.error('Activity retrieval failed');
      return { status: 'unavailable' };
    }
  }
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isActivity(value: unknown): value is PublicActivity {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    typeof value.description === 'string' &&
    Array.isArray(value.images) &&
    value.images.every((image) => typeof image === 'string') &&
    typeof value.videoLink === 'string' &&
    typeof value.videoDescription === 'string' &&
    value.isVisible === true &&
    typeof value.order === 'number' &&
    typeof value.createdAt === 'string' &&
    typeof value.updatedAt === 'string'
  );
}

function isPagination(value: unknown): value is PaginationInfo {
  if (!isRecord(value)) return false;
  return (
    Number.isInteger(value.page) &&
    Number(value.page) >= 1 &&
    Number.isInteger(value.limit) &&
    Number(value.limit) >= 1 &&
    Number.isInteger(value.total) &&
    Number(value.total) >= 0 &&
    Number.isInteger(value.totalPages) &&
    Number(value.totalPages) >= 0
  );
}

function isActivitiesEnvelope(value: unknown): value is {
  success: true;
  availability: { enabled: boolean };
  data: PublicActivity[];
  pagination: PaginationInfo;
} {
  return (
    isRecord(value) &&
    value.success === true &&
    isRecord(value.availability) &&
    typeof value.availability.enabled === 'boolean' &&
    Array.isArray(value.data) &&
    value.data.every(isActivity) &&
    isPagination(value.pagination)
  );
}
