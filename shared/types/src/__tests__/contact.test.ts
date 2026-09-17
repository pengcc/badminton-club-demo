import { describe, expect, it } from 'vitest';
import { Language } from '../core/enums';
import {
  contactExternalLinkSchema,
  contactEntryValuesSchema,
  getContactEntryCompleteness,
  resolveContactEntryText,
} from '../api/contact';

const values = {
  category: 'General inquiries',
  title: { de: 'Kontakt', en: '', zh: '联系' },
  description: { de: 'Schreib uns.', en: '', zh: '请联系我们。' },
  email: 'info@example.test',
  retainedQrCode: '',
  qrExplanation: { de: '', en: '', zh: '' },
  externalLink: '',
  externalLinkLabel: { de: '', en: '', zh: '' },
  isActive: true,
  order: 0,
};

describe('Contact entry contract', () => {
  it('requires the bounded owner fields and German canonical copy', () => {
    expect(contactEntryValuesSchema.parse(values)).toEqual(values);
    expect(
      contactEntryValuesSchema.safeParse({
        ...values,
        title: { ...values.title, de: '' },
      }).success
    ).toBe(false);
  });

  it('requires a German label for an external link', () => {
    expect(
      contactEntryValuesSchema.safeParse({
        ...values,
        externalLink: 'https://example.test/contact',
      }).success
    ).toBe(false);
  });

  it('accepts only empty or HTTP(S) external links', () => {
    expect(contactExternalLinkSchema.parse('')).toBe('');
    expect(contactExternalLinkSchema.parse('http://example.test/contact')).toBe(
      'http://example.test/contact'
    );
    expect(
      contactExternalLinkSchema.parse('https://example.test/contact')
    ).toBe('https://example.test/contact');
    for (const value of [
      'javascript:alert(1)',
      'data:text/html,test',
      'mailto:contact@example.test',
      'ftp://example.test/file',
    ]) {
      expect(contactExternalLinkSchema.safeParse(value).success).toBe(false);
    }
  });

  it('falls back to German and reports incomplete translations', () => {
    expect(resolveContactEntryText(values, Language.ENGLISH)).toMatchObject({
      title: 'Kontakt',
      description: 'Schreib uns.',
    });
    expect(getContactEntryCompleteness(values).title).toEqual({
      complete: false,
      missingLanguages: [Language.ENGLISH],
    });
  });
});
