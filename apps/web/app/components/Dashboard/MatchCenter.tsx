'use client';

import React, { useState, lazy, Suspense, type ComponentType } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@app/hooks/useAuth';
import { Button } from '@app/components/ui/button';
import { isAdmin } from '@app/lib/access/permissions';
import ErrorBoundary from '@app/components/ErrorBoundary';
import { Trophy, Users, Calendar, Shield, BarChart3 } from 'lucide-react';

function LazyTabErrorFallback() {
  const t = useTranslations('dashboard');

  return (
    <div className="text-center py-8">{t('matchCenter.errors.loadingTab')}</div>
  );
}

function lazyTabWithFallback(
  componentName: string,
  loadComponent: () => Promise<{ default: ComponentType }>
) {
  return lazy(() =>
    loadComponent().catch((err) => {
      console.error('Dashboard component loading failed', {
        operation: 'load_dashboard_component',
        componentName,
        reasonCode: err instanceof Error ? err.name : 'UNKNOWN_ERROR',
      });
      return { default: LazyTabErrorFallback };
    })
  );
}

// Lazy load tab components with translated error fallback
const PlayersTab = lazyTabWithFallback(
  'PlayersTab',
  () => import('./matchTabs/PlayersTab')
);
const UpcomingMatchesTab = lazyTabWithFallback(
  'UpcomingMatchesTab',
  () => import('./matchTabs/UpcomingMatchesTab')
);
const MatchHistoryTab = lazyTabWithFallback(
  'MatchHistoryTab',
  () => import('./matchTabs/MatchHistoryTab')
);
const MatchManagementTab = lazyTabWithFallback(
  'MatchManagementTab',
  () => import('./matchTabs/MatchManagementTab')
);
const TeamManagementTab = lazyTabWithFallback(
  'TeamManagementTab',
  () => import('./matchTabs/TeamManagementTab')
);

/**
 * MatchCenter Component - Parent Orchestrator (Refactored)
 *
 * Responsibilities:
 * - Tab navigation and state management
 * - Lazy loading of tab components
 * - Access control for admin-only tabs
 *
 * Data fetching and mutations have been moved to individual tabs.
 * This component no longer manages props drilling or modal states.
 */
export default function MatchCenter() {
  const t = useTranslations('dashboard');
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(
    user.demoMode ? 'management' : 'players'
  );

  const userIsAdmin = isAdmin(user);

  // Preload tabs on hover for better UX
  const handleTabHover = (tabName: string) => {
    // Trigger module load without waiting
    if (tabName === 'players') import('./matchTabs/PlayersTab');
    if (tabName === 'upcoming') import('./matchTabs/UpcomingMatchesTab');
    if (tabName === 'history') import('./matchTabs/MatchHistoryTab');
    if (tabName === 'management' && userIsAdmin)
      import('./matchTabs/MatchManagementTab');
    if (tabName === 'teams' && userIsAdmin)
      import('./matchTabs/TeamManagementTab');
  };

  const tabs = [
    {
      id: 'players',
      label: t('matchCenter.tabs.players'),
      icon: Users,
      adminOnly: false,
    },
    {
      id: 'upcoming',
      label: t('matchCenter.tabs.upcomingMatches'),
      icon: Calendar,
      adminOnly: false,
    },
    {
      id: 'history',
      label: t('matchCenter.tabs.matchHistory'),
      icon: Trophy,
      adminOnly: false,
    },
    {
      id: 'management',
      label: t('matchCenter.tabs.matchManagement'),
      icon: Shield,
      adminOnly: true,
    },
    {
      id: 'teams',
      label: t('matchCenter.tabs.teamManagement'),
      icon: BarChart3,
      adminOnly: true,
    },
  ];

  // Filter tabs based on admin status
  const visibleTabs = tabs.filter(
    (tab) =>
      (!tab.adminOnly || userIsAdmin) &&
      (!user.demoMode || tab.id === 'management')
  );

  return (
    <div className="bg-white rounded-lg sm:shadow-md p-2 sm:p-6 mt-4">
      <div className="flex justify-between items-center mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
          {t('matchCenter.title')}
        </h2>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 mb-6 pb-2">
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? 'default' : 'ghost'}
              onClick={() => setActiveTab(tab.id)}
              onMouseEnter={() => handleTabHover(tab.id)}
              className="flex items-center gap-2 text-sm sm:text-base"
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </Button>
          );
        })}
      </div>

      {/* Tab Content with Error Boundaries and Suspense */}
      <ErrorBoundary>
        <Suspense
          fallback={
            <div className="text-center py-8">{t('matchCenter.loading')}</div>
          }
        >
          {activeTab === 'players' && <PlayersTab />}
          {activeTab === 'upcoming' && <UpcomingMatchesTab />}
          {activeTab === 'history' && <MatchHistoryTab />}
          {activeTab === 'management' && userIsAdmin && <MatchManagementTab />}
          {activeTab === 'teams' && userIsAdmin && <TeamManagementTab />}
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
