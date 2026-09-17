import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import dashboard from '../../../messages/en/dashboard.json';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  retrySession: vi.fn(),
  user: { id: 'user-1', capabilities: [] },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/en/dashboard/members',
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mocks.user,
    sessionRefreshFailed: true,
    retrySession: mocks.retrySession,
  }),
}));
vi.mock('../../lib/access/permissions', () => ({
  isAdmin: () => true,
  getFilteredNavigation: (_user: unknown, navigation: unknown) => navigation,
}));
vi.mock('../../lib/navigation/dashboardNav', () => ({
  getDashboardNavigation: () => [
    { path: '/en/dashboard/members', labelKey: 'navigation.members' },
  ],
  normalizeDashboardPath: (path: string) => path,
}));
vi.mock('../../components/Header', () => ({
  default: () => <div>Header</div>,
}));
vi.mock('../../components/Dashboard/Sidebar', () => ({
  Sidebar: () => <div>Sidebar</div>,
}));

import DashboardLayout from '../../components/Dashboard/DashboardLayout';

describe('Dashboard session recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps verified work visible after a background refetch failure', () => {
    render(
      <NextIntlClientProvider locale="en" messages={{ dashboard }}>
        <DashboardLayout lang="en">
          <div>Protected task</div>
        </DashboardLayout>
      </NextIntlClientProvider>
    );

    expect(screen.getByText('Protected task')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(
      'latest session verification failed'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry verification' }));
    expect(mocks.retrySession).toHaveBeenCalledOnce();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
