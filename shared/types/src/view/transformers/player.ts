import type { Api } from '../../api/player';
import type { PlayerView } from '../player';

/**
 * Helper functions to transform between API and view layer types
 */
export const PlayerViewTransformers = {
  /**
   * Transform API response to player card view
   */
  toPlayerCard(player: Api.PlayerResponse): PlayerView.PlayerCard {
    return {
      ...player,
      displayName: player.userName,
      statusBadge: player.isActivePlayer
        ? { label: 'Active', color: 'success' }
        : { label: 'Inactive', color: 'default' },
      stats: {
        gamesPlayed: player.matchCount,
      },
      teams: [] // Transform from player.teams when available
    };
  },

  /**
   * Transform API response to player profile view
   */
  toPlayerProfile(player: Api.PlayerResponse): PlayerView.PlayerProfile {
    return {
      ...player,
      displayName: player.userName,
      statusBadge: player.isActivePlayer
        ? { label: 'Active', color: 'success' }
        : { label: 'Inactive', color: 'default' },
      contactInfo: {
        email: player.userEmail,
        phone: undefined // Will be added when API supports it
      },
      stats: {
        gamesPlayed: player.matchCount,
      },
      recentMatches: [] // Load from match history
    };
  },

  /**
   * Transform form data to update player request
   */
  toUpdateRequest(formData: PlayerView.PlayerFormData): Api.UpdatePlayerRequest {
    return {
      preferredPositions: formData.preferredPositions,
      isActivePlayer: formData.isActivePlayer,
      teamIds: formData.teamIds
    };
  },

  /**
   * Transform filter state to API query params
   */
  toQueryParams(filters: PlayerView.PlayerListState['filters']): Api.PlayerQueryParams {
    return {
      teamId: filters.team,
      isActivePlayer: filters.status === 'active' ? true :
                     filters.status === 'inactive' ? false :
                     undefined,
      // Add other filters when API supports them
      page: 1,
      limit: 20
    };
  }
};