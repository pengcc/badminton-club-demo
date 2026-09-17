import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import Header from '@app/components/Header';
import de from '../../../messages/de/common.json';
import en from '../../../messages/en/common.json';
import zh from '../../../messages/zh/common.json';

vi.mock('@app/components/ShowcaseNotice', () => ({
  default: () => <span>Demo disclosure</span>,
}));
vi.mock('@app/components/MainNav', () => ({
  default: () => <nav>Discovery</nav>,
}));
vi.mock('@app/components/LanguageSwitcher', () => ({
  default: () => <span>Languages</span>,
}));
vi.mock('@app/components/UserMenu', () => ({
  default: () => <span>Product menu</span>,
}));

describe('localized discovery demo entry', () => {
  it.each([
    ['de', de],
    ['en', en],
    ['zh', zh],
  ] as const)('links %s discovery directly to ordinary Login', (lang, common) => {
    render(
      <NextIntlClientProvider locale={lang} messages={{ common }}>
        <Header lang={lang} intent="discovery" />
      </NextIntlClientProvider>
    );
    expect(
      screen.getByRole('link', { name: common.navigation.tryDemo })
    ).toHaveAttribute('href', `/${lang}/login`);
    const entry = screen.getByRole('link', { name: common.navigation.tryDemo });
    expect(entry).toHaveAttribute('data-variant', 'ghost');
    expect(entry).toHaveClass('whitespace-nowrap');
    expect(entry).not.toHaveClass('whitespace-normal');
    expect(screen.getByText('Discovery')).toBeInTheDocument();
  });
  it.each([
    ['de', de],
    ['en', en],
    ['zh', zh],
  ] as const)('keeps the Logo as the only %s Login Home escape', (lang, common) => {
    render(
      <NextIntlClientProvider locale={lang} messages={{ common }}>
        <Header lang={lang} intent="focused" showHomeLink={false} />
      </NextIntlClientProvider>
    );
    expect(
      screen.queryByRole('link', { name: common.navigation.home })
    ).not.toBeInTheDocument();
    const homeLinks = screen
      .getAllByRole('link')
      .filter((link) => link.getAttribute('href') === `/${lang}`);
    expect(homeLinks).toHaveLength(1);
    expect(homeLinks[0]).toContainElement(
      screen.getByRole('img', { name: common.club_name })
    );
    expect(screen.getByText('Languages')).toBeInTheDocument();
  });
  it.each([
    'focused',
    'neutral',
    'product',
  ] as const)('preserves %s account behavior', (intent) => {
    render(
      <NextIntlClientProvider locale="en" messages={{ common: en }}>
        <Header lang="en" intent={intent} />
      </NextIntlClientProvider>
    );
    expect(
      screen.queryByRole('link', { name: en.navigation.tryDemo })
    ).not.toBeInTheDocument();
    if (intent === 'product')
      expect(screen.getByText('Product menu')).toBeInTheDocument();
    else
      expect(
        screen.getByRole('link', { name: en.userMenu.account })
      ).toHaveAttribute('href', '/en/account');
  });
});
