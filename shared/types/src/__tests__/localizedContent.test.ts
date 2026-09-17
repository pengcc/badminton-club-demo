import { describe, expect, it } from 'vitest';
import { Language } from '../core/enums';
import {
  getLocalizedTextCompleteness,
  isContentLanguage,
  resolveLocalizedText,
} from '../api/localizedContent';
import {
  getHomepageContentCompleteness,
  homepageContentValuesSchema,
  resolveHomepageContent,
} from '../api/homepageContent';

const localized = (de: string, en = '', zh = '') => ({ de, en, zh });

describe('localized public content', () => {
  it('recognizes only supported content languages', () => {
    expect(isContentLanguage('de')).toBe(true);
    expect(isContentLanguage('en')).toBe(true);
    expect(isContentLanguage('zh')).toBe(true);
    expect(isContentLanguage('fr')).toBe(false);
    expect(isContentLanguage('favicon.ico')).toBe(false);
    expect(isContentLanguage('')).toBe(false);
    expect(isContentLanguage(undefined)).toBe(false);
    expect(isContentLanguage(null)).toBe(false);
    expect(isContentLanguage(1)).toBe(false);
  });

  it('uses requested content and falls back only to German', () => {
    const content = localized('Deutsch', '', '中文');

    expect(resolveLocalizedText(content, Language.CHINESE)).toBe('中文');
    expect(resolveLocalizedText(content, Language.ENGLISH)).toBe('Deutsch');
  });

  it('distinguishes absent optional content from incomplete translations', () => {
    expect(getLocalizedTextCompleteness(localized(''), true)).toEqual({
      complete: true,
      missingLanguages: [],
    });
    expect(getLocalizedTextCompleteness(localized('Deutsch'))).toEqual({
      complete: false,
      missingLanguages: [Language.ENGLISH, Language.CHINESE],
    });
  });

  it('requires canonical German for required homepage fields', () => {
    const result = homepageContentValuesSchema.safeParse({
      mainMessage: localized('', 'English'),
      visitUsIntroduction: localized(''),
      contactIntroduction: localized(''),
    });

    expect(result.success).toBe(false);
  });

  it('resolves the homepage projection and reports completeness', () => {
    const content = {
      mainMessage: localized('Willkommen', '', '欢迎'),
      visitUsIntroduction: localized('Besucht uns'),
      contactIntroduction: localized(''),
    };

    expect(resolveHomepageContent(content, Language.ENGLISH)).toEqual({
      mainMessage: 'Willkommen',
      visitUsIntroduction: 'Besucht uns',
      contactIntroduction: '',
    });
    expect(getHomepageContentCompleteness(content).mainMessage).toEqual({
      complete: false,
      missingLanguages: [Language.ENGLISH],
    });
    expect(getHomepageContentCompleteness(content).contactIntroduction).toEqual(
      { complete: true, missingLanguages: [] }
    );
  });
});
