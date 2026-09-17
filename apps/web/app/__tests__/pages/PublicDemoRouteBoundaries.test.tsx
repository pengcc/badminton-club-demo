import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getDemoRuntimeStatus: vi.fn(),
  getServerSession: vi.fn(),
  connection: vi.fn(),
  setRequestLocale: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock('@app/lib/data/getDemoRuntimeStatus', () => mocks);
vi.mock('@app/lib/auth/getServerSessionUser', () => mocks);
vi.mock('next/server', () => ({ connection: mocks.connection }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next-intl/server', () => ({
  setRequestLocale: mocks.setRequestLocale,
  getMessages: async () => ({}),
  getTranslations: async () => (key: string) => key,
}));
vi.mock('next-intl', () => ({
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));
vi.mock('@app/components/Header', () => ({
  default: ({ showHomeLink = true }: { showHomeLink?: boolean }) => (
    <div>Header {showHomeLink && <a href="/en">Centered Home</a>}</div>
  ),
}));
vi.mock('@app/components/Login/LoginClient', () => ({
  default: ({ showPasswordRecovery }: { showPasswordRecovery: boolean }) => (
    <div>
      Login {showPasswordRecovery && <a href="/en/forgot-password">Recovery</a>}
    </div>
  ),
}));
vi.mock('@app/components/Login/PasswordRecoveryRequestClient', () => ({
  default: () => <div>Password recovery form</div>,
}));
vi.mock('@app/components/MembershipApplicantEmailEntry', () => ({
  default: () => <div>Application access form</div>,
}));
vi.mock('@app/components/Account/AccountClient', () => ({
  default: () => <div>Account</div>,
}));
vi.mock('@app/hooks/useAuth', () => ({
  ProtectedAuthProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));
vi.mock('@app/components/Dashboard/SessionUnavailable', () => ({
  SessionUnavailable: () => <div>Session unavailable</div>,
}));

import LoginPage from '@app/[lang]/login/page';
import ForgotPasswordPage from '@app/[lang]/forgot-password/page';
import ApplicationAccessPage from '@app/[lang]/apply/access/page';
import AccountPage from '@app/[lang]/account/page';

const params = () => Promise.resolve({ lang: 'en' });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDemoRuntimeStatus.mockResolvedValue('disabled');
  mocks.connection.mockResolvedValue(undefined);
  mocks.redirect.mockImplementation((path: string) => {
    throw new Error(`redirect:${path}`);
  });
  mocks.getServerSession.mockResolvedValue({
    kind: 'verified',
    user: { id: 'ordinary-user' },
  });
});

describe('public demo route boundaries', () => {
  it.each([
    'enabled',
    'unavailable',
  ])('redirects excluded recovery routes when demo status is %s', async (status) => {
    mocks.getDemoRuntimeStatus.mockResolvedValue(status);
    await expect(ApplicationAccessPage({ params: params() })).rejects.toThrow(
      'redirect:/en/membership'
    );
    await expect(ForgotPasswordPage({ params: params() })).rejects.toThrow(
      'redirect:/en/login'
    );
  });

  it('retains both recovery forms when demo runtime is disabled', async () => {
    render(await ApplicationAccessPage({ params: params() }));
    render(await ForgotPasswordPage({ params: params() }));
    expect(screen.getByText('Application access form')).toBeVisible();
    expect(screen.getByText('Password recovery form')).toBeVisible();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it.each([
    'enabled',
    'disabled',
    'unavailable',
  ])('keeps login available and passes the recovery decision for %s', async (status) => {
    mocks.getDemoRuntimeStatus.mockResolvedValue(status);
    render(await LoginPage({ params: params() }));
    expect(screen.getByText(/Login/)).toBeVisible();
    expect(
      screen.queryByRole('link', { name: 'Centered Home' })
    ).not.toBeInTheDocument();
    expect(Boolean(screen.queryByRole('link', { name: 'Recovery' }))).toBe(
      status === 'disabled'
    );
  });

  it.each([
    LoginPage,
    ForgotPasswordPage,
    ApplicationAccessPage,
  ])('establishes request-time rendering before fetching demo status', async (page) => {
    await page({ params: params() });
    expect(mocks.setRequestLocale.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.connection.mock.invocationCallOrder[0]!
    );
    expect(mocks.connection.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.getDemoRuntimeStatus.mock.invocationCallOrder[0]!
    );
  });

  it('redirects Demo Admin Account access before rendering the account surface', async () => {
    mocks.getServerSession.mockResolvedValue({
      kind: 'verified',
      user: { id: 'demo-user', demoMode: true },
    });
    await expect(AccountPage({ params: params() })).rejects.toThrow(
      'redirect:/en/dashboard'
    );
    expect(mocks.getDemoRuntimeStatus).not.toHaveBeenCalled();
  });

  it('preserves ordinary verified Account access', async () => {
    render(await AccountPage({ params: params() }));
    expect(screen.getByText('Account')).toBeVisible();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('preserves unauthenticated and unavailable session outcomes', async () => {
    mocks.getServerSession.mockResolvedValueOnce({ kind: 'unauthenticated' });
    await expect(AccountPage({ params: params() })).rejects.toThrow(
      'redirect:/en/login'
    );
    mocks.getServerSession.mockResolvedValueOnce({ kind: 'unavailable' });
    render(await AccountPage({ params: params() }));
    expect(screen.getByText('Session unavailable')).toBeVisible();
    expect(screen.queryByText('Account')).not.toBeInTheDocument();
  });
});
