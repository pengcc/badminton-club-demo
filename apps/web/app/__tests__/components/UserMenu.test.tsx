import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountKind } from '@club/shared-types/core/enums';
import commonMessages from '../../../messages/zh/common.json';
import dashboardMessages from '../../../messages/zh/dashboard.json';
import accountMessages from '../../../messages/zh/account.json';

const auth = vi.hoisted(() => ({
  user: null as Record<string, unknown> | null,
  logout: vi.fn(),
}));

vi.mock('@app/hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('@app/lib/access/permissions', () => ({
  canUseDashboard: () => true,
}));

import UserMenu from '@app/components/UserMenu';

function renderMenu() {
  return render(
    <NextIntlClientProvider
      locale="zh"
      messages={{
        common: commonMessages,
        dashboard: dashboardMessages,
        account: accountMessages,
      }}
    >
      <UserMenu lang="zh" />
    </NextIntlClientProvider>
  );
}

describe('UserMenu', () => {
  beforeEach(() => {
    auth.user = {
      id: 'user-1',
      fullName: '测试用户',
      firstName: '测试',
      lastName: '用户',
      email: 'member@example.test',
      name: '测试用户',
      accountKind: AccountKind.PERSON,
      capabilities: [],
    };
    auth.logout.mockReset();
  });

  it('exposes localized authenticated navigation without nested controls', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: '测试用户' }));

    expect(screen.getByRole('dialog', { name: '账户菜单' })).toBeVisible();
    expect(screen.queryByText('角色：管理员')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '关闭账户菜单' })).toBeVisible();
    const dashboard = screen.getByRole('link', { name: '仪表板' });
    expect(dashboard).toHaveAttribute('href', '/zh/dashboard');
    expect(dashboard.querySelector('button')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '我的账户' })).toHaveAttribute(
      'href',
      '/zh/account'
    );
    expect(screen.getByRole('button', { name: '退出' })).toBeVisible();
  });

  it('does not expose account management to the Demo Admin', async () => {
    if (!auth.user) throw new Error('Expected test user');
    auth.user.demoMode = true;
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: '测试用户' }));

    expect(screen.getByRole('link', { name: '仪表板' })).toBeVisible();
    expect(
      screen.queryByRole('link', { name: '我的账户' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '退出' })).toBeVisible();
  });
});
