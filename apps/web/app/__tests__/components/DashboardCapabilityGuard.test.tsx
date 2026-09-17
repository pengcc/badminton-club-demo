import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Api } from '@club/shared-types/api/auth';
import {
  AccountKind,
  Capability,
  MembershipStatus,
} from '@club/shared-types/core/enums';
import dashboard from '../../../messages/en/dashboard.json';
import dashboardZh from '../../../messages/zh/dashboard.json';

const mocks = vi.hoisted(() => ({
  pathname: '/en/dashboard/members',
  push: vi.fn(),
  user: null as Api.User | null,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mocks.user,
    sessionRefreshFailed: false,
    retrySession: vi.fn(),
  }),
}));

vi.mock('../../components/Header', () => ({
  default: () => <header>Header</header>,
}));

vi.mock('../../components/Dashboard/Sidebar', () => ({
  Sidebar: () => <aside>Sidebar</aside>,
}));

import DashboardLayout from '../../components/Dashboard/DashboardLayout';

function renderDashboard(
  children: React.ReactNode,
  locale = 'en',
  messages = dashboard
) {
  return render(
    <NextIntlClientProvider locale={locale} messages={{ dashboard: messages }}>
      <DashboardLayout lang={locale}>{children}</DashboardLayout>
    </NextIntlClientProvider>
  );
}

function externalPlayer(): Api.User {
  return {
    id: 'external-user',
    email: 'external@example.test',
    firstName: 'External',
    lastName: 'Player',
    name: 'External Player',
    accountKind: AccountKind.PERSON,
    capabilities: [
      Capability.AUTHENTICATED_ACCOUNT,
      Capability.ACTIVE_PLAYER,
      Capability.EXTERNAL_PLAYER,
    ],
    playerId: 'external-player',
    membershipStatus: MembershipStatus.INACTIVE,
  };
}

describe('WP6 dashboard denied state', () => {
  beforeEach(() => {
    mocks.user = externalPlayer();
    mocks.pathname = '/en/dashboard/members';
    mocks.push.mockReset();
  });

  it('does not render a dashboard page without its projected capability', () => {
    renderDashboard(<div>Member administration</div>);

    expect(screen.getByRole('alert')).toHaveTextContent('Access denied');
    expect(screen.queryByText('Member administration')).not.toBeInTheDocument();
  });

  it('renders an approved external-Player dashboard page', () => {
    mocks.pathname = '/en/dashboard/matches';

    renderDashboard(<div>Match workflows</div>);

    expect(screen.getByText('Match workflows')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('localizes the denied shell state without changing capability behavior', () => {
    mocks.pathname = '/zh/dashboard/members';

    renderDashboard(<div>Member administration</div>, 'zh', dashboardZh);

    expect(screen.getByRole('alert')).toHaveTextContent('访问被拒绝');
    expect(screen.getByRole('button', { name: '前往可用区域' })).toBeVisible();
  });
});
