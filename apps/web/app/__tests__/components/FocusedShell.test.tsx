import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));
vi.mock('@app/components/Logo', () => ({ default: () => <div>Logo</div> }));
vi.mock('@app/components/MainNav', () => ({
  default: () => <nav>Main navigation</nav>,
}));
vi.mock('@app/components/LanguageSwitcher', () => ({
  default: () => <div>Language switcher</div>,
}));
vi.mock('@app/components/UserMenu', () => ({
  default: () => <div>User menu</div>,
}));

import Header from '@app/components/Header';
import { buildLocaleSwitchHref } from '@app/lib/navigation/localeSwitch';

describe('focused Header intent', () => {
  it('adds a focusable skip path only to discovery pages', () => {
    const { rerender } = render(<Header intent="discovery" lang="en" />);

    expect(
      screen.getByRole('link', { name: 'accessibility.skipToContent' })
    ).toHaveAttribute('href', '#main-content');

    rerender(<Header intent="focused" lang="en" />);
    expect(
      screen.queryByRole('link', { name: 'accessibility.skipToContent' })
    ).not.toBeInTheDocument();
  });

  it('offers a same-origin localized Home link without discovery navigation', () => {
    render(<Header intent="focused" lang="de" />);

    expect(
      screen.getByRole('link', { name: 'navigation.home' })
    ).toHaveAttribute('href', '/de');
    expect(screen.queryByText('Main navigation')).not.toBeInTheDocument();
    expect(screen.getByText('Language switcher')).toBeInTheDocument();
  });

  it('can suppress locale switching for non-replayable routes', () => {
    render(<Header intent="focused" lang="en" showLanguageSwitcher={false} />);

    expect(
      screen.getByRole('link', { name: 'navigation.home' })
    ).toBeInTheDocument();
    expect(screen.queryByText('Language switcher')).not.toBeInTheDocument();
  });

  it('keeps discovery stateless and delegates sign-in to Login', () => {
    render(<Header intent="discovery" lang="zh" />);

    expect(
      screen.getByRole('link', { name: 'navigation.tryDemo' })
    ).toHaveAttribute('href', '/zh/login');
    expect(screen.queryByText('User menu')).not.toBeInTheDocument();
  });

  it('renders the authenticated menu only on protected product surfaces', () => {
    render(<Header intent="product" lang="en" />);

    expect(screen.getByText('User menu')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'userMenu.account' })
    ).not.toBeInTheDocument();
  });

  it.each([
    'neutral',
    'product',
  ] as const)('keeps %s intent free of discovery and focused controls', (intent) => {
    render(<Header intent={intent} lang="en" />);

    expect(screen.queryByText('Main navigation')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'navigation.home' })
    ).not.toBeInTheDocument();
    expect(screen.getByText('Language switcher')).toBeInTheDocument();
  });
});

describe('safe locale continuity', () => {
  it('preserves public Homepage and Activities context', () => {
    expect(
      buildLocaleSwitchHref({
        pathname: '/en',
        search: '?campaign=summer',
        hash: '#participation',
        newLanguage: 'de',
      })
    ).toBe('/de?campaign=summer#participation');
    expect(
      buildLocaleSwitchHref({
        pathname: '/de/activities',
        search: '?page=3',
        hash: '#activity-list',
        newLanguage: 'zh',
      })
    ).toBe('/zh/activities?page=3#activity-list');
  });

  it('preserves only the controlled registration key on Apply', () => {
    expect(
      buildLocaleSwitchHref({
        pathname: '/en/apply',
        search: '?tracking=drop&k=Registration_Key_123',
        hash: '#drop',
        newLanguage: 'de',
      })
    ).toBe('/de/apply?k=Registration_Key_123');
  });

  it.each([
    '/en/apply/access',
    '/en/apply/continue',
    '/en/set-password',
    '/en/verify-email-change/One_Time_Token',
    '/en/login',
  ])('drops query and hash context from %s', (pathname) => {
    expect(
      buildLocaleSwitchHref({
        pathname,
        search: '?token=Do_Not_Replay',
        hash: '#private-state',
        newLanguage: 'zh',
      })
    ).toBe(pathname.replace('/en', '/zh'));
  });
});
