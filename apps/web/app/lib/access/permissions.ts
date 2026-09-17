import type { Api } from '@club/shared-types/api/auth';
import type { NavigationItem } from '@app/lib/navigation/dashboardNav';
import { Capability } from '@club/shared-types/core/enums';

/**
 * Centralized RBAC (Role-Based Access Control) logic
 * All permission checks should go through these functions
 */

/**
 * Check if user has admin role
 */
export function isAdmin(user: Api.User | null | undefined): boolean {
  return hasCapability(user, Capability.ADMINISTRATION);
}

/**
 * Check if user has player access (member or admin)
 */
export function isPlayer(user: Api.User | null | undefined): boolean {
  return hasCapability(user, Capability.ACTIVE_PLAYER);
}

/**
 * Reflect a backend-projected capability. Frontend checks never grant access.
 */
export function hasCapability(
  user: Api.User | null | undefined,
  capability: Capability
): boolean {
  return user?.capabilities?.includes(capability) ?? false;
}

export function hasAnyCapability(
  user: Api.User | null | undefined,
  capabilities: readonly Capability[]
): boolean {
  return capabilities.some((capability) => hasCapability(user, capability));
}

export function canUseDashboard(user: Api.User | null | undefined): boolean {
  return hasAnyCapability(user, [
    Capability.ADMINISTRATION,
    Capability.CURRENT_MEMBER,
    Capability.ACTIVE_PLAYER,
  ]);
}

/**
 * Filter navigation items based on user's access level
 */
export function getFilteredNavigation(
  user: Api.User | null | undefined,
  navigationItems: NavigationItem[]
): NavigationItem[] {
  if (!user) return [];

  const capabilityFiltered = navigationItems.filter((item) =>
    hasAnyCapability(user, item.requiredCapabilities)
  );
  return user.demoMode
    ? capabilityFiltered.filter((item) =>
        ['members', 'matches', 'content'].includes(item.id)
      )
    : capabilityFiltered;
}
