import { describe, expect, it } from 'vitest';
import {
  getTeamPublicContentCompleteness,
  resolveTeamPublicContent,
  teamPublicContentValuesSchema,
} from '../api/teamPublicContent';
import { Language } from '../core/enums';

const content = {
  enabled: true,
  title: { de: 'Mannschaften', en: '', zh: '球队' },
  description: { de: 'Unsere Mannschaften', en: '', zh: '' },
};

describe('Team public content contract', () => {
  it('uses German fallback and reports incomplete translations', () => {
    expect(resolveTeamPublicContent(content, Language.ENGLISH)).toEqual({
      enabled: true,
      title: 'Mannschaften',
      description: 'Unsere Mannschaften',
    });
    expect(getTeamPublicContentCompleteness(content)).toEqual({
      title: { complete: false, missingLanguages: [Language.ENGLISH] },
      description: {
        complete: false,
        missingLanguages: [Language.ENGLISH, Language.CHINESE],
      },
    });
  });

  it('requires German title and introduction only when enabled', () => {
    expect(
      teamPublicContentValuesSchema.safeParse({
        enabled: true,
        title: { de: '', en: 'Teams', zh: '' },
        description: { de: '', en: 'Introduction', zh: '' },
      }).success
    ).toBe(false);
    expect(
      teamPublicContentValuesSchema.safeParse({
        enabled: false,
        title: { de: '', en: '', zh: '' },
        description: { de: '', en: '', zh: '' },
      }).success
    ).toBe(true);
  });
});
