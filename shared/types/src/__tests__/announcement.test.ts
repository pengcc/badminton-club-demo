import { describe, expect, it } from 'vitest';
import { Language } from '../core/enums';
import {
  AnnouncementType,
  announcementMutationSchema,
  getAnnouncementCompleteness,
  resolveAnnouncementText,
} from '../api/announcement';

const translations = {
  de: { title: 'Vereinsabend', content: 'Deutscher Inhalt' },
  en: { title: '', content: '' },
  zh: { title: '俱乐部之夜', content: '中文内容' },
};

describe('Announcement contracts', () => {
  it('requires canonical German content and accepts optional translations', () => {
    expect(
      announcementMutationSchema.parse({
        translations,
        type: AnnouncementType.INFO,
        displayDate: '2026.08.13',
      })
    ).toMatchObject({
      translations,
      externalLink: '',
      isActive: true,
      order: 0,
    });

    expect(() =>
      announcementMutationSchema.parse({
        translations: {
          ...translations,
          de: { title: '', content: 'Inhalt' },
        },
        type: AnnouncementType.INFO,
        displayDate: '2026.08.13',
      })
    ).toThrow('German announcement title is required');
  });

  it('resolves missing requested content through German only', () => {
    expect(resolveAnnouncementText(translations, Language.ENGLISH)).toEqual({
      title: 'Vereinsabend',
      content: 'Deutscher Inhalt',
    });
  });

  it('accepts only valid display dates and optional HTTP(S) links', () => {
    const base = {
      translations,
      type: AnnouncementType.INFO,
      displayDate: '2026.08.13',
    };

    expect(
      announcementMutationSchema.parse({
        ...base,
        externalLink: 'https://example.test/update',
      }).externalLink
    ).toBe('https://example.test/update');
    expect(() =>
      announcementMutationSchema.parse({
        ...base,
        externalLink: 'mailto:club@example.test',
      })
    ).toThrow();
    expect(() =>
      announcementMutationSchema.parse({ ...base, displayDate: '2026.02.31' })
    ).toThrow('Display date must be a valid calendar date');
  });

  it('reports optional-language completeness', () => {
    expect(getAnnouncementCompleteness(translations)).toEqual({
      title: { complete: false, missingLanguages: [Language.ENGLISH] },
      content: { complete: false, missingLanguages: [Language.ENGLISH] },
    });
  });
});
