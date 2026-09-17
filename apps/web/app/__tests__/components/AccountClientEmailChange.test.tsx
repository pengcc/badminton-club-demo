import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Capability } from '@club/shared-types/core/enums';
import accountDe from '../../../messages/de/account.json';
import commonDe from '../../../messages/de/common.json';
import accountEn from '../../../messages/en/account.json';
import commonEn from '../../../messages/en/common.json';
import accountZh from '../../../messages/zh/account.json';
import commonZh from '../../../messages/zh/common.json';

const mocks = vi.hoisted(() => ({
  lang: 'en',
  accountKind: 'person',
  membershipStatus: 'active',
  capabilities: [] as string[],
  sessionRefreshFailed: false,
  logout: vi.fn(),
  changePassword: vi.fn(),
  passwordPending: false,
  requestEmailChange: vi.fn(),
  updateProfile: vi.fn(),
  retrySession: vi.fn(),
  refetchProfile: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ lang: mocks.lang }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('@app/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      email: 'current@example.test',
      firstName: 'Current',
      lastName: 'Member',
      fullName: 'Current Member',
      name: 'Current Member',
      accountKind: mocks.accountKind,
      membershipType: 'regular',
      membershipStatus: mocks.membershipStatus,
      capabilities: mocks.capabilities,
    },
    sessionRefreshFailed: mocks.sessionRefreshFailed,
    logout: mocks.logout,
    retrySession: mocks.retrySession,
  }),
}));
vi.mock('@app/services/authService', () => ({
  AuthService: {
    useChangePassword: () => ({
      isPending: mocks.passwordPending,
      mutateAsync: mocks.changePassword,
    }),
  },
}));
vi.mock('@app/services/userService', () => ({
  UserService: {
    useRequestEmailChange: () => ({
      isPending: false,
      mutateAsync: mocks.requestEmailChange,
    }),
    useUserProfile: () => ({
      isPending: false,
      isError: false,
      isRefetchError: false,
      refetch: mocks.refetchProfile,
      data: {
        id: 'user-1',
        email: 'current@example.test',
        firstName: 'Current',
        lastName: 'Member',
        fullName: 'Member, Current',
        phone: '+49 30 1234',
        dateOfBirth: '1990-01-01',
        gender: 'female',
        accountKind: 'person',
        administratorDesignation: false,
        membershipStatus: 'active',
        accountOnboardingStatus: 'ready',
        isPlayer: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    }),
    useUpdateUser: () => ({
      isPending: false,
      mutateAsync: mocks.updateProfile,
    }),
  },
}));
vi.mock('@app/components/Header', () => ({
  default: () => <div data-testid="header" />,
}));
vi.mock('@app/lib/navigation/documentNavigation', () => ({
  navigateToDocument: mocks.navigate,
}));

import AccountClient from '../../components/Account/AccountClient';

const localeFixtures = {
  de: { account: accountDe, common: commonDe },
  en: { account: accountEn, common: commonEn },
  zh: { account: accountZh, common: commonZh },
} as const;

function accountElement(locale: keyof typeof localeFixtures) {
  const messages = localeFixtures[locale];
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AccountClient />
    </NextIntlClientProvider>
  );
}

function renderAccount(routeLang: string, locale: keyof typeof localeFixtures) {
  mocks.lang = routeLang;
  return render(accountElement(locale));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.accountKind = 'person';
  mocks.membershipStatus = 'active';
  mocks.capabilities = [Capability.CURRENT_MEMBER];
  mocks.sessionRefreshFailed = false;
  mocks.passwordPending = false;
  mocks.changePassword.mockResolvedValue({ success: true });
  mocks.requestEmailChange.mockResolvedValue({
    pendingEmail: 'next@example.test',
  });
  mocks.updateProfile.mockResolvedValue({});
  mocks.retrySession.mockResolvedValue({});
});

describe('AccountClient email-change request', () => {
  it('saves the Person-owned profile, clears optional phone, and refreshes session name', async () => {
    const user = userEvent.setup();
    renderAccount('en', 'en');

    await user.clear(screen.getByLabelText('First name'));
    await user.type(screen.getByLabelText('First name'), 'Updated');
    await user.clear(screen.getByLabelText('Phone (optional)'));
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledOnce());
    expect(mocks.updateProfile).toHaveBeenCalledWith({
      id: 'user-1',
      formData: { firstName: 'Updated', phone: null },
    });
    await waitFor(() => expect(mocks.retrySession).toHaveBeenCalledOnce());
  });

  it('keeps External Player profile self-service without presenting Membership', () => {
    mocks.membershipStatus = 'inactive';
    mocks.capabilities = [
      Capability.AUTHENTICATED_ACCOUNT,
      Capability.EXTERNAL_PLAYER,
    ];

    renderAccount('en', 'en');

    expect(screen.getByText('Personal profile')).toBeVisible();
    expect(screen.queryByText('Membership')).toBeNull();
  });

  it('keeps a successful name save and exposes failed session refresh recovery', async () => {
    const user = userEvent.setup();
    mocks.retrySession.mockImplementation(async () => {
      mocks.sessionRefreshFailed = true;
      return { isError: true };
    });
    const view = renderAccount('en', 'en');

    await user.clear(screen.getByLabelText('First name'));
    await user.type(screen.getByLabelText('First name'), 'Updated');
    await user.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(mocks.updateProfile).toHaveBeenCalledOnce());
    await waitFor(() => expect(mocks.retrySession).toHaveBeenCalledOnce());
    view.rerender(accountElement('en'));

    expect(
      screen.getByText(
        'Your profile was saved, but the latest account display could not be refreshed.'
      )
    ).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Retry account refresh' })
    );
    expect(mocks.retrySession).toHaveBeenCalledTimes(2);
  });

  it.each([
    {
      routeLang: 'en',
      locale: 'en' as const,
      action: 'Change email',
      field: 'New email address',
      submit: 'Send verification email',
      expectedLocale: 'en',
    },
    {
      routeLang: 'zh',
      locale: 'zh' as const,
      action: '更改邮箱',
      field: '新邮箱地址',
      submit: '发送验证邮件',
      expectedLocale: 'zh',
    },
    {
      routeLang: 'invalid',
      locale: 'de' as const,
      action: 'E-Mail-Adresse ändern',
      field: 'Neue E-Mail-Adresse',
      submit: 'Bestätigungs-E-Mail senden',
      expectedLocale: 'de',
    },
  ])('sends $expectedLocale from the localized Account route', async ({
    routeLang,
    locale,
    action,
    field,
    submit,
    expectedLocale,
  }) => {
    const user = userEvent.setup();
    renderAccount(routeLang, locale);

    await user.click(screen.getByRole('button', { name: action }));
    await user.type(screen.getByLabelText(field), 'next@example.test');
    await user.click(screen.getByRole('button', { name: submit }));

    await waitFor(() =>
      expect(mocks.requestEmailChange).toHaveBeenCalledOnce()
    );
    expect(mocks.requestEmailChange).toHaveBeenCalledWith({
      newEmail: 'next@example.test',
      locale: expectedLocale,
    });
  });

  it('shows a localized bounded error without exposing backend detail', async () => {
    const user = userEvent.setup();
    mocks.requestEmailChange.mockRejectedValue({
      response: { data: { error: 'RAW SERVER EMAIL CHANGE DETAIL' } },
    });
    renderAccount('zh', 'zh');

    await user.click(screen.getByRole('button', { name: '更改邮箱' }));
    await user.type(screen.getByLabelText('新邮箱地址'), 'next@example.test');
    await user.click(screen.getByRole('button', { name: '发送验证邮件' }));

    expect(await screen.findByText('无法发起邮箱更改，请重试。')).toBeVisible();
    expect(
      screen.queryByText('RAW SERVER EMAIL CHANGE DETAIL')
    ).not.toBeInTheDocument();
  });

  it('presents Super Admin email as operator-managed without a failing action', () => {
    mocks.accountKind = 'super_admin';
    renderAccount('en', 'en');

    expect(screen.queryByRole('button', { name: 'Change email' })).toBeNull();
    expect(
      screen.getByText(
        'This operational account email is managed through the Super Admin operator workflow.'
      )
    ).toBeVisible();
  });

  it.each([
    [
      'de',
      'Verwalten Sie Ihre Kontoeinstellungen und persönlichen Angaben',
      'Persönliches Profil',
      'Reguläre Mitgliedschaft',
      'Aktiv',
    ],
    [
      'en',
      'Manage your account settings and preferences',
      'Personal profile',
      'Regular membership',
      'Active',
    ],
    ['zh', '管理您的账户设置和个人信息', '个人资料', '普通会员', '有效'],
  ] as const)('localizes the core Account presentation for %s', (locale, description, personalInfo, membershipType, membershipStatus) => {
    renderAccount(locale, locale);

    expect(screen.getByText(description)).toBeVisible();
    expect(screen.getByText(personalInfo)).toBeVisible();
    expect(screen.getByText(membershipType)).toBeVisible();
    expect(screen.getByText(membershipStatus)).toBeVisible();
  });

  it('uses localized password validation without strengthening the endpoint policy', async () => {
    const user = userEvent.setup();
    renderAccount('de', 'de');

    await user.click(screen.getByRole('button', { name: 'Passwort ändern' }));
    await user.click(
      screen.getByRole('button', { name: 'Passwort aktualisieren' })
    );

    expect(
      screen.getByText('Das aktuelle Passwort ist erforderlich.')
    ).toBeVisible();
    expect(
      screen.getByText('Das neue Passwort ist erforderlich.')
    ).toBeVisible();

    await user.type(
      screen.getByLabelText('Aktuelles Passwort'),
      'old-password'
    );
    await user.type(screen.getByLabelText('Neues Passwort'), 'short');
    await user.type(
      screen.getByLabelText('Neues Passwort bestätigen'),
      'different'
    );
    await user.click(
      screen.getByRole('button', { name: 'Passwort aktualisieren' })
    );

    expect(
      screen.getByText('Das Passwort muss mindestens 8 Zeichen lang sein.')
    ).toBeVisible();
    expect(
      screen.getByText('Die Passwörter stimmen nicht überein.')
    ).toBeVisible();

    await user.clear(screen.getByLabelText('Neues Passwort'));
    await user.clear(screen.getByLabelText('Neues Passwort bestätigen'));
    await user.type(screen.getByLabelText('Neues Passwort'), 'lowercase');
    await user.type(
      screen.getByLabelText('Neues Passwort bestätigen'),
      'lowercase'
    );
    await user.click(
      screen.getByRole('button', { name: 'Passwort aktualisieren' })
    );

    await waitFor(() => expect(mocks.changePassword).toHaveBeenCalledOnce());
    expect(mocks.changePassword).toHaveBeenCalledWith({
      currentPassword: 'old-password',
      newPassword: 'lowercase',
    });
    expect(mocks.navigate).toHaveBeenCalledOnce();
    expect(mocks.navigate).toHaveBeenCalledWith('/de/login');
  });

  it('shows a localized bounded password failure without exposing backend detail', async () => {
    const user = userEvent.setup();
    mocks.changePassword.mockRejectedValue({
      response: { data: { error: 'RAW PASSWORD DETAIL' } },
    });
    renderAccount('zh', 'zh');

    await user.click(screen.getByRole('button', { name: '更改密码' }));
    await user.type(screen.getByLabelText('当前密码'), 'old-password');
    await user.type(screen.getByLabelText('新密码'), 'lowercase');
    await user.type(screen.getByLabelText('确认新密码'), 'lowercase');
    await user.click(screen.getByRole('button', { name: '更新密码' }));

    expect(await screen.findByText('密码修改失败')).toBeVisible();
    expect(screen.queryByText('RAW PASSWORD DETAIL')).not.toBeInTheDocument();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });
});

describe('Account password visibility controls', () => {
  it.each([
    'de',
    'en',
    'zh',
  ] as const)('keeps %s visibility controls independent, keyboard accessible, and safe while pending', async (locale) => {
    const user = userEvent.setup();
    const view = renderAccount(locale, locale);
    const messages = localeFixtures[locale].account;
    await user.click(
      screen.getByRole('button', { name: messages.changePassword })
    );
    const fields = [
      'currentPassword',
      'newPassword',
      'confirmPassword',
    ] as const;
    for (const field of fields) {
      const input = screen.getByLabelText(messages[field]);
      await user.type(input, 'preview-only');
      await user.tab();
      const show = screen.getByRole('button', {
        name: messages.showPassword.replace('{field}', messages[field]),
      });
      expect(show).toHaveFocus();
      await user.keyboard('{Enter}');
      expect(input).toHaveAttribute('type', 'text');
      expect(input).toHaveValue('preview-only');
      expect(show).toHaveFocus();
      for (const other of fields.filter((other) => other !== field)) {
        expect(screen.getByLabelText(messages[other])).toHaveAttribute(
          'type',
          'password'
        );
      }
      await user.keyboard(' ');
      expect(input).toHaveAttribute('type', 'password');
    }
    expect(mocks.changePassword).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();

    mocks.passwordPending = true;
    view.rerender(accountElement(locale));
    expect(
      screen.getByRole('button', { name: messages.updating })
    ).toBeDisabled();
    const reveal = screen.getByRole('button', {
      name: messages.showPassword.replace('{field}', messages.newPassword),
    });
    await user.click(reveal);
    expect(screen.getByLabelText(messages.newPassword)).toHaveAttribute(
      'type',
      'text'
    );
    expect(screen.getByLabelText(messages.newPassword)).toHaveValue(
      'preview-only'
    );
    expect(mocks.changePassword).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();

    await user.click(
      screen.getByRole('button', { name: messages.cancel, exact: true })
    );
    mocks.passwordPending = false;
    view.rerender(accountElement(locale));
    await user.click(
      screen.getByRole('button', { name: messages.changePassword })
    );
    for (const field of fields) {
      expect(screen.getByLabelText(messages[field])).toHaveValue('');
      expect(screen.getByLabelText(messages[field])).toHaveAttribute(
        'type',
        'password'
      );
    }
  });
});
