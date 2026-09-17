import { describe, expect, it } from 'vitest';
import deMessages from '@app/../messages/de/common.json';
import enMessages from '@app/../messages/en/common.json';
import zhMessages from '@app/../messages/zh/common.json';
import {
  getDiscoveryNavItems,
  isDiscoveryPageCurrent,
} from '@app/components/MainNav';

const expectedKeys = [
  'navigation.home',
  'navigation.training',
  'navigation.teams',
  'navigation.activities',
  'navigation.join',
  'navigation.contact',
  'navigation.about',
  'navigation.documents',
];

describe('public discovery navigation', () => {
  it.each([
    'de',
    'en',
    'zh',
  ])('uses the approved taxonomy and locale-qualified destinations for %s', (locale) => {
    const items = getDiscoveryNavItems(locale, true);

    expect(items.map(({ key }) => key)).toEqual(expectedKeys);
    expect(items.map(({ href }) => href)).toEqual([
      `/${locale}`,
      `/${locale}#visit-us`,
      `/${locale}/teams`,
      `/${locale}/activities`,
      `/${locale}#participation`,
      `/${locale}#contact`,
      `/${locale}#about-us`,
      `/${locale}#documents`,
    ]);
  });

  it('omits only Activities when the capability is not enabled', () => {
    const disabled = getDiscoveryNavItems('en', false);

    expect(disabled.map(({ key }) => key)).toEqual(
      expectedKeys.filter((key) => key !== 'navigation.activities')
    );
    expect(disabled.some(({ href }) => href === '/en/activities')).toBe(false);
  });

  it('marks only exact page destinations as current', () => {
    expect(isDiscoveryPageCurrent('/en', '/en')).toBe(true);
    expect(isDiscoveryPageCurrent('/en/teams/', '/en/teams')).toBe(true);
    expect(isDiscoveryPageCurrent('/en/activities', '/en/activities')).toBe(
      true
    );
    expect(isDiscoveryPageCurrent('/en', '/en#visit-us')).toBe(false);
    expect(isDiscoveryPageCurrent('/en/membership', '/en')).toBe(false);
  });

  it.each([
    ['de', deMessages],
    ['en', enMessages],
    ['zh', zhMessages],
  ])('provides complete localized navigation controls for %s', (_locale, messages) => {
    expect(messages.navigation).toMatchObject({
      home: expect.any(String),
      training: expect.any(String),
      teams: expect.any(String),
      activities: expect.any(String),
      join: expect.any(String),
      contact: expect.any(String),
      about: expect.any(String),
      documents: expect.any(String),
      openMenu: expect.any(String),
      closeMenu: expect.any(String),
      menuTitle: expect.any(String),
      discoveryLabel: expect.any(String),
      discoveryMenuLabel: expect.any(String),
      languageSelector: expect.any(String),
    });
    expect(messages.accessibility.skipToContent).toEqual(expect.any(String));
    expect(messages.footer.navigationLabel).toEqual(expect.any(String));
    expect(messages.membershipInformation.recoveryLink).toEqual(
      expect.any(String)
    );
  });
});
