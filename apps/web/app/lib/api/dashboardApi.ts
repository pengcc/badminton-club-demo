import { getUsers } from './userApi';
import { getTeams } from './teamApi';
import { getMatches } from './matchApi';
import { getPlayers } from './playerApi';
import { MatchListView } from '@club/shared-types/core/enums';

/**
 * Dashboard Statistics API module
 * Aggregates data from multiple endpoints for dashboard stats
 */

export interface DashboardStats {
  totalMembers: number;
  totalTeams: number;
  upcomingMatches: number;
  activePlayers: number;
}

/**
 * Get aggregated dashboard statistics
 * This combines data from multiple endpoints to provide an overview
 */
export const getDashboardStats = async (): Promise<DashboardStats> => {
  try {
    const [users, teams, matches, players] = await Promise.all([
      getUsers(),
      getTeams(),
      getMatches(MatchListView.UPCOMING),
      getPlayers(),
    ]);

    const activePlayers = players.filter(
      (player) => player.isActivePlayer
    ).length;

    const upcomingMatches = matches.length;

    return {
      totalMembers: users.length,
      totalTeams: teams.length,
      upcomingMatches,
      activePlayers,
    };
  } catch {
    console.error('Dashboard statistics retrieval failed');
    return {
      totalMembers: 0,
      totalTeams: 0,
      upcomingMatches: 0,
      activePlayers: 0,
    };
  }
};
