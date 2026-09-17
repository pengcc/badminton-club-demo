import { z } from 'zod';
import { MembershipStatus, PlayerPosition, PlayerType } from '../core/enums';
import type { AccountSetupSummary } from './accountOnboarding';

/**
 * API layer types for Player
 * Serializes Domain.Player for transport (Date → ISO string)
 */
export namespace Api {
  // API response type - converts Date to ISO string
  export interface PlayerResponse {
    id: string;
    userId: string; // Reference to User
    type: PlayerType;

    // User info (populated from User)
    userName: string; // Computed from user's firstName/lastName
    userEmail: string;
    userGender?: string; // Gender from User entity

    // Player-specific fields
    singlesRanking: number; // Ranking for singles play (0-5000)
    doublesRanking: number; // Ranking for doubles play (0-5000)
    rankingDisplay: string; // COMPUTED: "singlesRanking/doublesRanking"
    preferredPositions?: PlayerPosition[];
    isActivePlayer: boolean;
    membershipStatus?: MembershipStatus;
    isEffectivelyEligible?: boolean;

    // Relationships
    teamIds: string[];
    matchCount: number; // Computed from matchIds.length

    createdAt: string; // ISO string for JSON serialization
    updatedAt: string; // ISO string for JSON serialization

    /** Present only on administrator-authorized Player projections. */
    accountSetup?: AccountSetupSummary;
    /** Present only on administrator-authorized Player projections. */
    passwordRecoveryAvailable?: boolean;
  }

  // List response
  export interface PlayerListResponse {
    success: true;
    data: PlayerResponse[];
  }

  // Create request
  export interface CreatePlayerRequest {
    userId: string; // Must reference a valid User
    type: PlayerType;
    singlesRanking?: number;
    doublesRanking?: number;
    preferredPositions?: PlayerPosition[];
    isActivePlayer?: boolean;
    teamIds?: string[];
  }

  // Update request
  export interface UpdatePlayerRequest {
    singlesRanking?: number;
    doublesRanking?: number;
    preferredPositions?: PlayerPosition[];
  }

  export interface BatchUpdatePlayersRequest {
    playerIds: string[];
    updates: {
      singlesRanking?: number;
      doublesRanking?: number;
      singlesRankingOffset?: number;
      doublesRankingOffset?: number;
      addToTeams?: string[];
      removeFromTeams?: string[];
    };
  }

  export interface BatchUpdatePlayersResult {
    updatedCount: number;
    failures?: Array<{
      playerId: string;
      message: string;
    }>;
  }

  export type PlayerLifecycleBatchAction = 'enable' | 'deactivate';

  export interface PlayerLifecycleCandidate {
    userId: string;
    userName: string;
    membershipStatus: MembershipStatus;
    playerId?: string;
    isParticipationEnabled: boolean;
    isEffectivelyEligible: boolean;
  }

  export interface PlayerLifecycleBatchRequest {
    userIds: string[];
    action: PlayerLifecycleBatchAction;
    reason: string;
  }

  export interface PlayerLifecycleBatchItemResult {
    userId: string;
    playerId?: string;
    replayed?: boolean;
    error?: { code: string; message: string };
  }

  export interface PlayerLifecycleBatchResult {
    success: boolean;
    updatedCount: number;
    failureCount: number;
    items: PlayerLifecycleBatchItemResult[];
  }

  export interface PlayerCleanupResult {
    playerId: string;
    userId: string;
  }

  export interface ConvertFormerMemberToExternalRequest {
    reason: string;
  }

  // URL parameters
  export interface PlayerUrlParams {
    id: string;
  }
}

/**
 * API validation schemas
 */
export const ApiSchemas = {
  createPlayer: z.object({
    userId: z.string().uuid(),
    type: z.enum(PlayerType),
    singlesRanking: z.number().min(0).max(5000).optional(),
    doublesRanking: z.number().min(0).max(5000).optional(),
    ranking: z.number().min(0).max(1000).optional(), // @deprecated
    preferredPositions: z.array(z.enum(PlayerPosition)).optional(),
    isActivePlayer: z.boolean().optional(),
    teamIds: z.array(z.string().uuid()).optional(),
  }),

  updatePlayer: z.object({
    singlesRanking: z.number().min(0).max(5000).optional(),
    doublesRanking: z.number().min(0).max(5000).optional(),
    ranking: z.number().min(0).max(1000).optional(), // @deprecated
    preferredPositions: z.array(z.enum(PlayerPosition)).optional(),
  }),

  urlParams: z.object({
    id: z.string(),
  }),
};
