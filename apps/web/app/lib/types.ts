/**
 * Frontend Types File
 *
 * Re-exports shared types from @club/shared-types View layer.
 * View layer types extend API types with computed display fields (badges, formatted dates, etc.)
 */

// Import and re-export View layer types (includes display fields + API data)
import type { UserView } from '@club/shared-types/view/user';
import type { MatchView } from '@club/shared-types/view/match';
import type { PlayerView } from '@club/shared-types/view/player';
import type { TeamView } from '@club/shared-types/view/team';
import { LineupPosition, Gender } from '@club/shared-types/core/enums';

/**
 * Primary entity types for components
 * Use View layer types which include:
 * - All API response data (id, name, etc.)
 * - Computed display fields (statusBadge, roleBadge, displayName, etc.)
 * - Formatted data (dateTimeDisplay, scoreDisplay, etc.)
 */
export type User = UserView.UserCard;
export type Match = MatchView.MatchCard;
export type Player = PlayerView.PlayerCard;
export type Team = TeamView.TeamCard;

/**
 * Form data types for create/edit operations
 * These define the shape of form state before submission
 */
export type UserFormData = UserView.UserFormData;
export type MatchFormData = MatchView.MatchFormData;
export type PlayerFormData = PlayerView.PlayerFormData;
export type TeamFormData = TeamView.TeamFormData;

// Re-export shared enums for frontend use
export { LineupPosition, Gender };


// Lineup position display configuration for UI
export const LINEUP_POSITION_CONFIG: Record<LineupPosition, {
  ranking: number;
  maxPlayers: number;
  displayName: string;
  allowedGenders: Gender | Gender[];
}> = {
  [LineupPosition.MEN_SINGLES_1]: { ranking: 1, maxPlayers: 1, allowedGenders: Gender.MALE, displayName: "Men's Singles 1" },
  [LineupPosition.MEN_SINGLES_2]: { ranking: 2, maxPlayers: 1, allowedGenders: Gender.MALE, displayName: "Men's Singles 2" },
  [LineupPosition.MEN_SINGLES_3]: { ranking: 3, maxPlayers: 1, allowedGenders: Gender.MALE, displayName: "Men's Singles 3" },
  [LineupPosition.WOMEN_SINGLES]: { ranking: 4, maxPlayers: 1, allowedGenders: Gender.FEMALE, displayName: "Women's Singles" },
  [LineupPosition.MENS_DOUBLES_1]: { ranking: 5, maxPlayers: 2, allowedGenders: Gender.MALE, displayName: "Men's Doubles 1" },
  [LineupPosition.MENS_DOUBLES_2]: { ranking: 6, maxPlayers: 2, allowedGenders: Gender.MALE, displayName: "Men's Doubles 2" },
  [LineupPosition.WOMEN_DOUBLES]: { ranking: 7, maxPlayers: 2, allowedGenders: Gender.FEMALE, displayName: "Women's Doubles" },
  [LineupPosition.MIXED_DOUBLES]: { ranking: 8, maxPlayers: 2, allowedGenders: [Gender.MALE, Gender.FEMALE], displayName: "Mixed Doubles" },
};

/**
 * Frontend-only UI helper types
 * These are minimal types for UI state and display logic only
 */

// Generic search/filter state for UI components
export interface SearchFilters {
  search?: string;
  searchTerm?: string;
  filterTeam?: string;
  statusFilter?: string;
  yearFilter?: string;
}