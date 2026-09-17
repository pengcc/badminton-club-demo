import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getServerSession: vi.fn(),
  redirect: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock('next-intl', () => ({
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));
vi.mock('next-intl/server', () => ({
  getMessages: () => Promise.resolve({}),
  getTranslations: () => (key: string) =>
    ({
      sessionUnavailableTitle: 'Session verification unavailable',
      sessionUnavailableDescription:
        'Session verification could not be completed.',
      retrySession: 'Retry verification',
    })[key] ?? key,
}));
vi.mock('@app/lib/auth/getServerSessionUser', () => ({
  getServerSession: mocks.getServerSession,
}));
vi.mock('@app/hooks/useAuth', () => ({
  ProtectedAuthProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));
vi.mock('@app/components/Dashboard/DashboardLayout', () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

import DashboardLayoutPage from '@app/[lang]/dashboard/layout';

describe('dashboard server session boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`redirect:${path}`);
    });
  });

  it('redirects a confirmed unauthenticated session to Login', async () => {
    mocks.getServerSession.mockResolvedValue({ kind: 'unauthenticated' });

    await expect(
      DashboardLayoutPage({
        children: <div>Dashboard</div>,
        params: Promise.resolve({ lang: 'en' }),
      })
    ).rejects.toThrow('redirect:/en/login');
  });

  it('renders owned recovery when verification is unavailable', async () => {
    mocks.getServerSession.mockResolvedValue({ kind: 'unavailable' });

    render(
      await DashboardLayoutPage({
        children: <div>Dashboard</div>,
        params: Promise.resolve({ lang: 'en' }),
      })
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Session verification unavailable'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry verification' }));
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('bootstraps a verified dashboard exactly once', async () => {
    const user = { id: 'user-1' };
    mocks.getServerSession.mockResolvedValue({ kind: 'verified', user });

    render(
      await DashboardLayoutPage({
        children: <div>Dashboard</div>,
        params: Promise.resolve({ lang: 'en' }),
      })
    );

    expect(screen.getByText('Dashboard')).toBeVisible();
    expect(mocks.getServerSession).toHaveBeenCalledOnce();
  });
});
