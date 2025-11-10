'use client';

import React, { useState, lazy, Suspense } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@app/hooks/useAuth';
import { Button } from '@app/components/ui/button';
import ErrorBoundary from '@app/components/ErrorBoundary';
import {
  Trophy,
  Users,
  Calendar,
  Shield,
  BarChart3
} from 'lucide-react';

// Lazy load tab components with error handling
const PlayersTab = lazy(() =>
  import('./matchTabs/PlayersTab').catch(err => {
    console.error('Error loading PlayersTab:', err);
    return { default: () => <div>Error loading tab</div> };
  })
);
const UpcomingMatchesTab = lazy(() =>
  import('./matchTabs/UpcomingMatchesTab').catch(err => {
    console.error('Error loading UpcomingMatchesTab:', err);
    return { default: () => <div>Error loading tab</div> };
  })
);
const MatchHistoryTab = lazy(() =>
  import('./matchTabs/MatchHistoryTab').catch(err => {
    console.error('Error loading MatchHistoryTab:', err);
    return { default: () => <div>Error loading tab</div> };
  })
);
const MatchManagementTab = lazy(() =>
  import('./matchTabs/MatchManagementTab').catch(err => {
    console.error('Error loading MatchManagementTab:', err);
    return { default: () => <div>Error loading tab</div> };
  })
);
const TeamManagementTab = lazy(() =>
  import('./matchTabs/TeamManagementTab').catch(err => {
    console.error('Error loading TeamManagementTab:', err);
    return { default: () => <div>Error loading tab</div> };
  })
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
  const [activeTab, setActiveTab] = useState('players');

  const isAdmin = user?.role === 'admin';

  // Preload tabs on hover for better UX
  const handleTabHover = (tabName: string) => {
    // Trigger module load without waiting
    if (tabName === 'players') import('./matchTabs/PlayersTab');
    if (tabName === 'upcoming') import('./matchTabs/UpcomingMatchesTab');
    if (tabName === 'history') import('./matchTabs/MatchHistoryTab');
    if (tabName === 'management' && isAdmin) import('./matchTabs/MatchManagementTab');
    if (tabName === 'teams' && isAdmin) import('./matchTabs/TeamManagementTab');
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
  const visibleTabs = tabs.filter(tab => !tab.adminOnly || isAdmin);

  return (
    <div className="bg-white rounded-lg sm:shadow-md p-4 sm:p-6 mt-4">
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
              className="flex items-center gap-2 hover:bg-primary hover:text-primary-foreground text-sm sm:text-base"
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </Button>
          );
        })}
      </div>

      {/* Tab Content with Error Boundaries and Suspense */}
      <ErrorBoundary>
        <Suspense fallback={<div className="text-center py-8">Loading...</div>}>
          {activeTab === 'players' && <PlayersTab />}
          {activeTab === 'upcoming' && <UpcomingMatchesTab />}
          {activeTab === 'history' && <MatchHistoryTab />}
          {activeTab === 'management' && isAdmin && <MatchManagementTab />}
          {activeTab === 'teams' && isAdmin && <TeamManagementTab />}
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
