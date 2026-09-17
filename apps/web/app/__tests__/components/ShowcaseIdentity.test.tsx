import { render, screen, cleanup } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Header from '@app/components/Header';
import en from '@messages/en/common.json';
import de from '@messages/de/common.json';
import zh from '@messages/zh/common.json';

vi.mock('@app/components/Logo', () => ({ default: () => <span>Brand</span> }));
vi.mock('@app/components/MainNav', () => ({
  default: () => <nav>Discovery</nav>,
}));
vi.mock('@app/components/LanguageSwitcher', () => ({ default: () => null }));
vi.mock('@app/components/UserMenu', () => ({ default: () => null }));
afterEach(cleanup);

describe('shared Showcase disclosure', () => {
  it.each([
    ['de', de],
    ['en', en],
    ['zh', zh],
  ] as const)('survives discovery and Dashboard entry in %s but preserves focused shells', (locale, common) => {
    for (const intent of ['discovery', 'product', 'focused'] as const) {
      render(
        <NextIntlClientProvider locale={locale} messages={{ common }}>
          <Header intent={intent} lang={locale} />
        </NextIntlClientProvider>
      );
      if (intent === 'focused')
        expect(screen.queryByRole('complementary')).toBeNull();
      else {
        expect(
          screen.getByRole('complementary', { name: 'Badminton Club Demo' })
        ).toHaveTextContent(common.showcase.disclosure);
        expect(screen.getByRole('complementary')).toHaveTextContent(
          'Badminton Club Demo'
        );
      }
      cleanup();
    }
  });
});
