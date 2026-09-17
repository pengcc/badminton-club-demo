import { describe, expect, it } from 'vitest';
import type { Api } from '@club/shared-types/api/auth';
import {
  AccountKind,
  Capability,
  MembershipStatus,
} from '@club/shared-types/core/enums';
import {
  canUseDashboard,
  getFilteredNavigation,
  isAdmin,
} from '../../lib/access/permissions';
import { getDashboardNavigation } from '../../lib/navigation/dashboardNav';

function user(capabilities: Capability[]): Api.User {
  return {
    id: 'user-1',
    email: 'user@example.test',
    firstName: 'Capability',
    lastName: 'Tester',
    name: 'Capability Tester',
    accountKind: AccountKind.PERSON,
    capabilities,
    membershipStatus: MembershipStatus.INACTIVE,
  };
}

function navigationIds(authUser: Api.User): string[] {
  return getFilteredNavigation(authUser, getDashboardNavigation('en')).map(
    (item) => item.id
  );
}

describe('WP6 frontend capability reflection', () => {
  it('shows administrative navigation from capabilities, not role labels', () => {
    const admin = user([
      Capability.AUTHENTICATED_ACCOUNT,
      Capability.ADMINISTRATION,
    ]);

    expect(isAdmin(admin)).toBe(true);
    expect(navigationIds(admin)).toEqual(
      expect.arrayContaining(['members', 'matches', 'applications', 'audit'])
    );
    expect(navigationIds(admin)).toContain('membership-terminations');
    expect(navigationIds(admin)).toContain('content');
    expect(navigationIds(admin)).not.toContain('activities');
  });

  it('shows current-member workflows without administrative entries', () => {
    const member = user([
      Capability.AUTHENTICATED_ACCOUNT,
      Capability.CURRENT_MEMBER,
      Capability.MEMBERSHIP_SELF_SERVICE,
    ]);

    expect(navigationIds(member)).toEqual(['matches', 'guest-play']);
  });

  it('limits external Players to the sporting dashboard', () => {
    const external = user([
      Capability.AUTHENTICATED_ACCOUNT,
      Capability.ACTIVE_PLAYER,
      Capability.EXTERNAL_PLAYER,
    ]);

    expect(navigationIds(external)).toEqual(['matches']);
  });

  it('keeps account-only users out of the dashboard', () => {
    const suspended = user([
      Capability.AUTHENTICATED_ACCOUNT,
      Capability.MEMBERSHIP_SELF_SERVICE,
    ]);

    expect(navigationIds(suspended)).toEqual([]);
    expect(canUseDashboard(suspended)).toBe(false);
  });

  it('does not trust a stale designation without the projected capability', () => {
    const staleAdmin = user([Capability.AUTHENTICATED_ACCOUNT]);

    expect(isAdmin(staleAdmin)).toBe(false);
    expect(navigationIds(staleAdmin)).toEqual([]);
  });

  it('limits the Demo Admin navigation to the approved portfolio areas', () => {
    const demoAdmin = user([
      Capability.AUTHENTICATED_ACCOUNT,
      Capability.ADMINISTRATION,
    ]);
    demoAdmin.demoMode = true;

    expect(navigationIds(demoAdmin)).toEqual(['members', 'matches', 'content']);
  });
});
