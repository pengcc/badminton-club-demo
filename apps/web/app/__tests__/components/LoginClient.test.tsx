import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import common from '../../../messages/en/common.json';
import login from '../../../messages/en/login.json';
import { Capability } from '@club/shared-types/core/enums';
import type { LoginFailureKind } from '@app/services/authService';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  assign: vi.fn(),
  error: null as Error | null,
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ lang: 'en' }),
}));
vi.mock('@app/services/authService', () => ({
  AuthService: {
    useLogin: () => ({ mutateAsync: mocks.mutateAsync, error: mocks.error }),
  },
}));
vi.mock('@app/lib/navigation/documentNavigation', () => ({
  navigateToDocument: mocks.assign,
}));

import LoginClient from '@app/components/Login/LoginClient';

function loginFailure(kind: LoginFailureKind) {
  return Object.assign(new Error('Login failed'), { kind });
}

describe('LoginClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.error = null;
    mocks.mutateAsync.mockResolvedValue({
      user: { id: 'admin', capabilities: [Capability.ADMINISTRATION] },
    });
  });

  it('performs one login mutation and one hard navigation', async () => {
    const user = userEvent.setup();
    const testPassword = `test-${Date.now()}`;
    render(
      <NextIntlClientProvider locale="en" messages={{ common, login }}>
        <LoginClient showPasswordRecovery />
      </NextIntlClientProvider>
    );

    await user.type(
      screen.getByRole('textbox', { name: 'Email' }),
      'member@example.test'
    );
    const passwordInput = document.querySelector<HTMLInputElement>(
      'input[name="password"]'
    );
    if (!passwordInput) throw new Error('Password input not found');
    await user.type(passwordInput, testPassword);
    await user.click(screen.getByRole('button', { name: 'Login' }));

    expect(mocks.mutateAsync).toHaveBeenCalledOnce();
    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      email: 'member@example.test',
      password: testPassword,
    });
    expect(mocks.assign).toHaveBeenCalledOnce();
    expect(mocks.assign).toHaveBeenCalledWith('/en/dashboard');
  });

  it.each([
    true,
    false,
  ])('shows password recovery only when allowed: %s', (showPasswordRecovery) => {
    render(
      <NextIntlClientProvider locale="en" messages={{ common, login }}>
        <LoginClient showPasswordRecovery={showPasswordRecovery} />
      </NextIntlClientProvider>
    );
    const recovery = screen.queryByRole('link', {
      name: login.forgot_password,
    });
    if (showPasswordRecovery) {
      expect(recovery).toHaveAttribute('href', '/en/forgot-password');
    } else {
      expect(recovery).not.toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Login' })).toBeEnabled();
  });

  it('projects the empty password error without invoking login', async () => {
    const user = userEvent.setup();
    render(
      <NextIntlClientProvider locale="en" messages={{ common, login }}>
        <LoginClient showPasswordRecovery />
      </NextIntlClientProvider>
    );

    await user.type(
      screen.getByRole('textbox', { name: 'Email' }),
      'member@example.test'
    );
    await user.click(screen.getByRole('button', { name: 'Login' }));

    const passwordInput = document.querySelector<HTMLInputElement>(
      'input[name="password"]'
    );
    if (!passwordInput) throw new Error('Password input not found');

    expect(passwordInput).toHaveAttribute('aria-invalid', 'true');
    expect(passwordInput).toHaveAttribute('aria-describedby', 'password-error');
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it('prefills the intentionally public synthetic demo credentials', async () => {
    process.env.NEXT_PUBLIC_SHOWCASE_DEMO_EMAIL = 'demo.admin@club.invalid';
    process.env.NEXT_PUBLIC_SHOWCASE_DEMO_PASSWORD = 'demo1234';
    const user = userEvent.setup();

    render(
      <NextIntlClientProvider locale="en" messages={{ common, login }}>
        <LoginClient showPasswordRecovery={false} />
      </NextIntlClientProvider>
    );
    await user.click(screen.getByRole('button', { name: login.demo_fill }));

    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveValue(
      'demo.admin@club.invalid'
    );
    expect(document.querySelector('input[name="password"]')).toHaveValue(
      'demo1234'
    );
    delete process.env.NEXT_PUBLIC_SHOWCASE_DEMO_EMAIL;
    delete process.env.NEXT_PUBLIC_SHOWCASE_DEMO_PASSWORD;
  });

  it.each([
    [loginFailure('invalid_credentials'), login.error_invalid_credentials],
    [loginFailure('sign_in_denied'), login.error_signin_denied],
    [loginFailure('unavailable'), login.error_generic],
    [new Error('unexpected failure'), login.error_generic],
  ])('renders bounded login feedback for %s', (failure, expectedMessage) => {
    mocks.error = failure;

    render(
      <NextIntlClientProvider locale="en" messages={{ common, login }}>
        <LoginClient showPasswordRecovery />
      </NextIntlClientProvider>
    );

    expect(screen.getByRole('alert')).toHaveTextContent(expectedMessage);
    if (expectedMessage !== login.error_invalid_credentials) {
      expect(screen.getByRole('alert')).not.toHaveTextContent(
        login.error_invalid_credentials
      );
    }
  });
});
