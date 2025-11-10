/**
 * MatchCenter Component Tests - Post-Refactoring
 *
 * Basic smoke tests for refactored MatchCenter with self-contained tabs.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MatchCenter from '../../../components/Dashboard/MatchCenter';

// Mock next-intl
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

// Mock useAuth hook
jest.mock('@app/hooks/useAuth', () => ({
  useAuth: jest.fn(() => ({
    user: {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'admin',
    },
  })),
}));

// Mock lazy-loaded tab components
jest.mock('../../../components/Dashboard/matchTabs/PlayersTab', () => ({
  __esModule: true,
  default: () => <div data-testid="players-tab">PlayersTab</div>,
}));

jest.mock('../../../components/Dashboard/matchTabs/UpcomingMatchesTab', () => ({
  __esModule: true,
  default: () => <div data-testid="upcoming-tab">UpcomingMatchesTab</div>,
}));

jest.mock('../../../components/Dashboard/matchTabs/MatchHistoryTab', () => ({
  __esModule: true,
  default: () => <div data-testid="history-tab">MatchHistoryTab</div>,
}));

jest.mock('../../../components/Dashboard/matchTabs/MatchManagementTab', () => ({
  __esModule: true,
  default: () => <div data-testid="management-tab">MatchManagementTab</div>,
}));

jest.mock('../../../components/Dashboard/matchTabs/TeamManagementTab', () => ({
  __esModule: true,
  default: () => <div data-testid="teams-tab">TeamManagementTab</div>,
}));

describe('MatchCenter - Refactored Architecture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the Match Center header', () => {
    render(<MatchCenter />);

    expect(screen.getByText('matchCenter.title')).toBeInTheDocument();
  });

  it('renders tab navigation buttons', () => {
    render(<MatchCenter />);

    expect(screen.getByText('matchCenter.tabs.players')).toBeInTheDocument();
    expect(screen.getByText('matchCenter.tabs.upcomingMatches')).toBeInTheDocument();
    expect(screen.getByText('matchCenter.tabs.matchHistory')).toBeInTheDocument();
  });

  it('renders PlayersTab by default', async () => {
    render(<MatchCenter />);

    await waitFor(() => {
      expect(screen.getByTestId('players-tab')).toBeInTheDocument();
    });
  });

  it('shows admin tabs for admin users', () => {
    render(<MatchCenter />);

    expect(screen.getByText('matchCenter.tabs.matchManagement')).toBeInTheDocument();
    expect(screen.getByText('matchCenter.tabs.teamManagement')).toBeInTheDocument();
  });

  it('hides admin tabs for non-admin users', () => {
    const { useAuth } = require('@app/hooks/useAuth');
    useAuth.mockReturnValue({
      user: {
        id: 'user-2',
        email: 'user@example.com',
        name: 'Regular User',
        role: 'member',
      },
    });

    render(<MatchCenter />);

    expect(screen.queryByText('matchCenter.tabs.matchManagement')).not.toBeInTheDocument();
    expect(screen.queryByText('matchCenter.tabs.teamManagement')).not.toBeInTheDocument();
  });
});
