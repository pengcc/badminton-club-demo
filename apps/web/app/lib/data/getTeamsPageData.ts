import { cache } from 'react';
import type { TeamPublicContentPublicResponse } from '@club/shared-types/api/teamPublicContent';
import type { Language, TeamLevel } from '@club/shared-types/core/enums';
import { teamMatchLevelSchema } from '@club/shared-types/schemas/team';
import type { PublicProjectionResult } from './publicProjection';

// Server-only API_URL (not exposed to browser) for SSR, fallback to public URL
const API_URL =
  process.env.API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  'http://localhost:3003';

export interface PublicTeam {
  shortName: string;
  leagueTeamName: string;
  matchLevel: TeamLevel;
}

export type TeamPublicContent = TeamPublicContentPublicResponse;

/**
 * Server-side data fetching for public teams list
 * Uses ISR with 1-hour revalidation
 */
export const getPublicTeams = cache(
  async (): Promise<PublicProjectionResult<PublicTeam[]>> => {
    try {
      const response = await fetch(`${API_URL}/api/teams/public`, {
        next: { revalidate: 3600 }, // ISR: 1 hour background refresh
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch teams: ${response.statusText}`);
      }

      const result: unknown = await response.json();
      if (!isTeamListEnvelope(result)) {
        throw new Error('Public teams: invalid response');
      }
      return { status: 'ready', data: result.data };
    } catch {
      console.error('Public Team retrieval failed');
      return { status: 'unavailable' };
    }
  }
);

/**
 * Server-side data fetching for team page global content
 * Uses ISR with 1-hour revalidation
 */
export const getTeamPublicContent = cache(
  async (
    language: Language
  ): Promise<PublicProjectionResult<TeamPublicContent>> => {
    try {
      const response = await fetch(
        `${API_URL}/api/team-public-content?language=${language}`,
        {
          next: { revalidate: 3600 }, // ISR: 1 hour background refresh
        }
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch team public content: ${response.statusText}`
        );
      }

      const result: unknown = await response.json();
      if (!isTeamContentEnvelope(result)) {
        throw new Error('Team public content: invalid response');
      }
      return { status: 'ready', data: result.data };
    } catch {
      console.error('Team public content retrieval failed');
      return { status: 'unavailable' };
    }
  }
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isPublicTeam(value: unknown): value is PublicTeam {
  if (!isRecord(value)) return false;
  return (
    typeof value.shortName === 'string' &&
    value.shortName.trim().length > 0 &&
    typeof value.leagueTeamName === 'string' &&
    value.leagueTeamName.trim().length > 0 &&
    teamMatchLevelSchema.safeParse(value.matchLevel).success
  );
}

function isTeamListEnvelope(
  value: unknown
): value is { success: true; data: PublicTeam[] } {
  return (
    isRecord(value) &&
    value.success === true &&
    Array.isArray(value.data) &&
    value.data.every(isPublicTeam)
  );
}

function isTeamContentEnvelope(
  value: unknown
): value is { success: true; data: TeamPublicContent } {
  if (!isRecord(value) || value.success !== true || !isRecord(value.data)) {
    return false;
  }
  const data = value.data;
  return (
    typeof data.enabled === 'boolean' &&
    typeof data.title === 'string' &&
    typeof data.description === 'string' &&
    (!data.enabled ||
      (data.title.trim().length > 0 && data.description.trim().length > 0))
  );
}
