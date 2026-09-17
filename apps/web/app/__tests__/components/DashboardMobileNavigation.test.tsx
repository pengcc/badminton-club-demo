import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Capability } from '@club/shared-types/core/enums';
import dashboardDe from '../../../messages/de/dashboard.json';
import dashboardEn from '../../../messages/en/dashboard.json';
import dashboardZh from '../../../messages/zh/dashboard.json';

const mocks = vi.hoisted(() => ({
  pathname: '/de/dashboard/members',
  push: vi.fn(),
  refetch: vi.fn(),
  user: null as unknown,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ push: mocks.push }),
}));

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mocks.user,
    sessionRefreshFailed: false,
    retrySession: mocks.refetch,
  }),
}));

vi.mock('../../components/Header', () => ({
  default: () => <header>Header</header>,
}));

import DashboardLayout from '../../components/Dashboard/DashboardLayout';

const adminUser = {
  id: 'admin-user',
  firstName: 'Admin',
  lastName: 'User',
  fullName: 'Admin User',
  capabilities: [Capability.ADMINISTRATION],
};

function renderDashboard(
  lang: 'de' | 'en' | 'zh',
  dashboardMessages:
    | typeof dashboardDe
    | typeof dashboardEn
    | typeof dashboardZh
) {
  return render(
    <NextIntlClientProvider
      locale={lang}
      messages={{ dashboard: dashboardMessages }}
    >
      <DashboardLayout lang={lang}>
        <div>Protected dashboard content</div>
      </DashboardLayout>
    </NextIntlClientProvider>
  );
}

describe('Dashboard mobile navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.pathname = '/de/dashboard/members';
    mocks.user = adminUser;
  });

  it('uses the existing Sheet modal interaction and returns focus to the localized trigger', async () => {
    const user = userEvent.setup();
    renderDashboard('de', dashboardDe);

    const trigger = screen.getByRole('button', {
      name: 'Dashboard-Navigation öffnen',
    });
    await user.click(trigger);

    const dialog = screen.getByRole('dialog', {
      name: 'Dashboard-Navigation',
    });
    expect(
      within(dialog).getByRole('button', {
        name: 'Dashboard-Navigation schließen',
      })
    ).toBeVisible();
    const membersLink = within(dialog).getByRole('link', {
      name: 'Mitglieder',
    });
    expect(membersLink.querySelector('button')).toBeNull();
    expect(
      within(dialog).getByRole('link', { name: 'Austritte' })
    ).toBeVisible();

    await user.keyboard('{Escape}');
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
    expect(trigger).toHaveFocus();

    await user.click(trigger);
    await user.click(
      within(screen.getByRole('dialog')).getByRole('link', {
        name: 'Mitglieder',
      })
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    );
  });

  it('uses English catalog labels in the desktop and mobile navigation surfaces', async () => {
    const user = userEvent.setup();
    mocks.pathname = '/en/dashboard/members';
    renderDashboard('en', dashboardEn);

    expect(
      screen.getAllByRole('link', { name: 'Membership exits' })
    ).not.toHaveLength(0);
    await user.click(
      screen.getByRole('button', { name: 'Open dashboard navigation' })
    );
    expect(
      within(screen.getByRole('dialog')).getByRole('link', {
        name: 'Membership exits',
      })
    ).toBeVisible();
  });

  it('uses Chinese catalog labels for navigation and account presentation', async () => {
    const user = userEvent.setup();
    mocks.pathname = '/zh/dashboard/members';
    renderDashboard('zh', dashboardZh);

    expect(screen.getByText('管理员')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '打开仪表板导航' }));
    expect(screen.getByRole('dialog', { name: '仪表板导航' })).toBeVisible();
    expect(screen.getByRole('link', { name: '成员' })).toBeVisible();
    expect(screen.getByRole('link', { name: '新人体验活动' })).toBeVisible();
    expect(screen.getByRole('link', { name: '退会管理' })).toBeVisible();
  });
});
