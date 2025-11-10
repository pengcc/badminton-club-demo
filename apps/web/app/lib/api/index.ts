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
export type { ApiResponse, ApiError, PaginatedResponse, PaginationParams, FilterParams } from './types';

// Export all Match API functions
export {
  getMatches,
  getMatch,
  createMatch,
  updateMatch,
  deleteMatch,
  toggleMatchPlayerAvailability,
  // syncMatchPlayers - removed (auto-sync on backend)
  updateMatchLineup,
} from './matchApi';

// Export all User API functions
export {
  getUsers,
  getUsersWithFilters,
  getUser,
  createUser,
  updateUser,
  batchUpdateUsers,
  deleteUser,
} from './userApi';
export type { UserFilterParams, BatchUpdateResponse } from './userApi';

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
  addPlayerToTeam,
  removePlayerFromTeam,
} from './playerApi';
export type { PlayerQueryParams } from './playerApi';

// Export all Membership Application API functions
export {
  submitMembershipApplication,
  getMembershipApplications,
  getMembershipApplication,
  reviewMembershipApplication,
  submitLegacyMembershipApplication,
} from './membershipApplicationApi';
export type { MembershipApplicationQueryParams, ReviewApplicationRequest } from './membershipApplicationApi';

// Export all Auth API functions
export {
  login,
  register,
  refreshToken,
  verifyToken,
} from './authApi';

// Export all PDF API functions
export {
  generateMembershipApplicationPDF,
  generateSEPAMandatePDF,
  generateMembershipPackagePDF,
} from './pdfApi';

// Export all Content API functions
export {
  getContent,
  updateContent,
} from './contentApi';
export type { ContentQueryParams, ContentItem } from './contentApi';

// Export Dashboard API functions
export {
  getDashboardStats,
} from './dashboardApi';
export type { DashboardStats } from './dashboardApi';

// Default export for compatibility
import apiClient from './client';
export default apiClient;
