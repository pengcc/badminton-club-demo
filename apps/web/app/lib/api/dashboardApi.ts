import { getUsers } from './userApi';
import { getTeams } from './teamApi';
import { getMatches } from './matchApi';
import { getPlayers } from './playerApi';

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
    const [users, teams, matches, playersResponse] = await Promise.all([
      getUsers(),
      getTeams(),
      getMatches(),
      getPlayers(),
    ]);

    const activePlayers =
      playersResponse.data?.filter((player: any) => player.isActivePlayer).length || 0;

    const upcomingMatches = matches.filter(
      (match) => match.status === 'scheduled' && new Date(match.date) > new Date()
    ).length;

    return {
      totalMembers: users.length,
      totalTeams: teams.length,
      upcomingMatches,
      activePlayers,
    };
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return {
      totalMembers: 0,
      totalTeams: 0,
      upcomingMatches: 0,
      activePlayers: 0,
    };
  }
};
