import type { Api } from '../../api/team';
import type { TeamView } from '../team';
import type { WithStringId, WithTimestamp } from '../../core/typeUtils';

/**
 * Helper functions to transform between API and view layer types
 */
export const TeamViewTransformers = {

  /**
   * Transform API response to team profile view
   * Note: playerIds is computed by backend from Player.teamIds (Phase 3 unidirectional)
   */
  toTeamCard(team: Api.TeamResponse & WithStringId & WithTimestamp): TeamView.TeamCard {
    return {
      ...team,
      playerCount: team.playerIds?.length || 0, // Safe access - playerIds computed by backend
      captainName: undefined, // To be populated from players data
      players: [], // To be populated from players data
    };
  },

  /**
   * Transform form data to create team request
   */
  toCreateRequest(formData: TeamView.TeamFormData): Api.CreateTeamRequest {
    return {
      name: formData.name,
      matchLevel: formData.matchLevel,
      createdById: '' // To be set by the controller
    };
  },

  /**
   * Transform form data to update team request
   */
  toUpdateRequest(formData: Partial<TeamView.TeamFormData>): Api.UpdateTeamRequest {
    return {
      name: formData.name,
      matchLevel: formData.matchLevel,
      updatedById: '' // To be set by the controller
    };
  }
};