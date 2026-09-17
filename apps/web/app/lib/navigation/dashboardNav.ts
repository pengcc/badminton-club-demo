import { Capability } from '@club/shared-types/core/enums';
import {
  Users,
  Trophy,
  FileText,
  Calendar,
  UserPlus,
  Settings,
  Shield,
  Home,
  CalendarX,
} from 'lucide-react';

export interface NavigationItem {
  id: string;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  requiredCapabilities: Capability[];
  badge?: string;
}

export function normalizeDashboardPath(pathname: string, lang: string): string {
  return pathname === `/${lang}/dashboard/training`
    ? `/${lang}/dashboard/taster-sessions`
    : pathname;
}

/**
 * Dashboard navigation configuration
 * Defines all available navigation items with their access levels
 */
export const getDashboardNavigation = (lang: string): NavigationItem[] => [
  {
    id: 'members',
    labelKey: 'navigation.members',
    icon: Users,
    path: `/${lang}/dashboard/members`,
    requiredCapabilities: [Capability.ADMINISTRATION],
  },
  {
    id: 'matches',
    labelKey: 'navigation.matches',
    icon: Trophy,
    path: `/${lang}/dashboard/matches`,
    requiredCapabilities: [
      Capability.ADMINISTRATION,
      Capability.CURRENT_MEMBER,
      Capability.ACTIVE_PLAYER,
    ],
  },
  {
    id: 'applications',
    labelKey: 'navigation.applications',
    icon: FileText,
    path: `/${lang}/dashboard/applications`,
    requiredCapabilities: [Capability.ADMINISTRATION],
  },
  {
    id: 'membership-terminations',
    labelKey: 'navigation.membershipTerminations',
    icon: CalendarX,
    path: `/${lang}/dashboard/membership-terminations`,
    requiredCapabilities: [Capability.ADMINISTRATION],
  },
  {
    id: 'settings',
    labelKey: 'navigation.settings',
    icon: Settings,
    path: `/${lang}/dashboard/settings`,
    requiredCapabilities: [Capability.ADMINISTRATION],
  },
  {
    id: 'content',
    labelKey: 'navigation.content',
    icon: Home,
    path: `/${lang}/dashboard/content`,
    requiredCapabilities: [Capability.ADMINISTRATION],
  },
  {
    id: 'audit',
    labelKey: 'navigation.audit',
    icon: Shield,
    path: `/${lang}/dashboard/audit`,
    requiredCapabilities: [Capability.ADMINISTRATION],
  },
  {
    id: 'taster-sessions',
    labelKey: 'navigation.tasterSessions',
    icon: Calendar,
    path: `/${lang}/dashboard/taster-sessions`,
    requiredCapabilities: [Capability.ADMINISTRATION],
  },
  {
    id: 'guest-play',
    labelKey: 'navigation.guestPlay',
    icon: UserPlus,
    path: `/${lang}/dashboard/guest-play`,
    requiredCapabilities: [
      Capability.ADMINISTRATION,
      Capability.CURRENT_MEMBER,
    ],
  },
];
