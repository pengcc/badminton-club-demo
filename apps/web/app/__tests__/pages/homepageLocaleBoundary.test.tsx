import { Children, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Language } from '@club/shared-types/core/enums';

const setRequestLocale = vi.hoisted(() => vi.fn());
const notFound = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  })
);

vi.mock('next-intl/server', () => ({ setRequestLocale }));
vi.mock('next/server', () => ({ connection: async () => undefined }));
vi.mock('next/navigation', () => ({ notFound }));
vi.mock('@app/components/DiscoveryHeader', () => ({
  default: 'test-header',
}));
vi.mock('@app/components/HeroSection', () => ({ default: 'test-hero' }));
vi.mock('@app/components/LatestUpdates', () => ({
  default: 'test-latest-updates',
}));
vi.mock('@app/components/VisitUs', () => ({ default: 'test-visit-us' }));
vi.mock('@app/components/ContactSection', () => ({
  default: 'test-contact',
}));
vi.mock('@app/components/ParticipationActions', () => ({
  default: 'test-participation-actions',
}));
vi.mock('@app/components/AboutUs', () => ({ default: 'test-about-us' }));
vi.mock('@app/components/Documents', () => ({ default: 'test-documents' }));
vi.mock('@app/components/Footer', () => ({ default: 'test-footer' }));

import Home from '@app/[lang]/page';

describe('homepage locale boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    Language.GERMAN,
    Language.ENGLISH,
    Language.CHINESE,
  ])('passes supported language %s to every homepage CMS consumer', async (language) => {
    const page = await Home({ params: Promise.resolve({ lang: language }) });
    const pageChildren = Children.toArray(page.props.children);
    const header = pageChildren[0] as ReactElement<{ lang: Language }>;
    const main = pageChildren[1] as ReactElement<{ children: ReactNode }>;
    const cmsSections = Children.toArray(main.props.children) as ReactElement<{
      locale: Language;
    }>[];

    expect(setRequestLocale).toHaveBeenCalledWith(language);
    expect(header.props.lang).toBe(language);
    expect(cmsSections.map((section) => section.props.locale)).toEqual([
      language,
      language,
      language,
      language,
      language,
      language,
      language,
    ]);
  });

  it('reaches not found before locale setup or homepage tree construction', async () => {
    await expect(
      Home({ params: Promise.resolve({ lang: 'fr' }) })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFound).toHaveBeenCalledOnce();
    expect(setRequestLocale).not.toHaveBeenCalled();
  });
});
