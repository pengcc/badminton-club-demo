import { cache } from 'react';
import type { PublicProjectionResult } from './publicProjection';
import { ACTIVITIES_AVAILABILITY_CACHE_TAG } from './publicContentCache';

const API_URL = process.env.API_URL || 'http://localhost:3003';

export const getActivitiesAvailability = cache(
  async (): Promise<PublicProjectionResult<{ enabled: boolean }>> => {
    try {
      const response = await fetch(`${API_URL}/api/activities/availability`, {
        next: {
          revalidate: 3600,
          tags: [ACTIVITIES_AVAILABILITY_CACHE_TAG],
        },
      });
      if (!response.ok)
        throw new Error(`Activities availability: ${response.status}`);

      const body: unknown = await response.json();
      if (
        !body ||
        typeof body !== 'object' ||
        !('success' in body) ||
        body.success !== true ||
        !('data' in body) ||
        !body.data ||
        typeof body.data !== 'object' ||
        !('enabled' in body.data) ||
        typeof body.data.enabled !== 'boolean'
      ) {
        throw new Error('Activities availability: invalid response');
      }

      return { status: 'ready', data: { enabled: body.data.enabled } };
    } catch {
      console.error('Activity availability retrieval failed');
      return { status: 'unavailable' };
    }
  }
);
