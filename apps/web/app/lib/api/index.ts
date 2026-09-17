/**
 * API Module Barrel Export
 *
 * Re-exports all API functions for backward compatibility with existing components.
 * Components can import from '@app/lib/api' and get all functions.
 *
 * Recommended: Import directly from specific modules for better tree-shaking:
 * - import { getMatches } from '@app/lib/api/matchApi'
 * - import { getUsers } from '@app/lib/api/userApi'
 */

// Export the axios client instance
export { default as api } from './client';

// Export common types
export type {
  ApiResponse,
  ApiError,
  PaginationParams,
  FilterParams,
} from './types';

// Export all Match API functions
export {
  getMatches,
  getMatch,
  createMatch,
  updateMatch,
  deleteMatch,
  setOwnMatchAvailability,
  setPlayerMatchAvailability,
  // syncMatchPlayers - removed (auto-sync on backend)
  updateMatchLineup,
} from './matchApi';

// Export all User API functions
export {
  getUsers,
  getMemberList,
  getUser,
  establishAccount,
  updateUser,
  setAdministratorDesignation,
  deleteUser,
} from './userApi';

// Export all Team API functions
export {
  getTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam,
} from './teamApi';

// Export all Player API functions
export {
  getPlayers,
  getPlayer,
  createPlayer,
  updatePlayer,
  deletePlayer,
  batchUpdatePlayers,
} from './playerApi';

// Export all Membership Application API functions
export {
  getMembershipApplications,
  getMembershipApplication,
  approveMembershipApplication,
  rejectMembershipApplication,
} from './membershipApplicationApi';
export type { MembershipApplicationQueryParams } from './membershipApplicationApi';

export {
  getMyTermination,
  requestTermination,
  listTerminations,
  approveTermination,
  recordOfflineTermination,
  recordTerminationBatch,
} from './membershipTerminationApi';

// Export all Auth API functions
export {
  login,
  verifySession,
} from './authApi';

// Export all Content API functions
export {
  getHomepageContentAdministration,
  updateHomepageContent,
} from './contentApi';
export type {
  HomepageContentAdministrationResponse,
  HomepageContentPublicResponse,
  HomepageContentValues,
} from './contentApi';

// Export Dashboard API functions
export { getDashboardStats } from './dashboardApi';
export type { DashboardStats } from './dashboardApi';

// Default export for compatibility
import apiClient from './client';
export default apiClient;
