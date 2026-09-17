import { describe, expect, it } from 'vitest';
import { Language } from '../core/enums';
import {
  activityAvailabilityUpdateSchema,
  activityMutationSchema,
  getActivityCompleteness,
  resolveActivityText,
} from '../api/activity';

const translations = {
  de: { name: 'Sommerfest', description: 'Deutsch' },
  en: { name: '', description: '' },
  zh: { name: '夏日活动', description: '中文' },
};
const videoDescription = { de: 'Video', en: '', zh: '' };

describe('Activity contracts', () => {
  it('accepts only an explicit boolean availability update', () => {
    expect(activityAvailabilityUpdateSchema.parse({ enabled: true })).toEqual({
      enabled: true,
    });
    expect(() =>
      activityAvailabilityUpdateSchema.parse({ enabled: 'true' })
    ).toThrow();
  });

  it('requires the canonical German name and accepts incomplete optional translations', () => {
    expect(
      activityMutationSchema.parse({
        activity: { translations, videoDescription },
      }).activity
    ).toMatchObject({ translations, videoDescription, retainedImages: [] });

    expect(() =>
      activityMutationSchema.parse({
        activity: {
          translations: {
            ...translations,
            de: { ...translations.de, name: '' },
          },
          videoDescription,
        },
      })
    ).toThrow('German activity name is required');
  });

  it('resolves requested content through German only', () => {
    expect(
      resolveActivityText(translations, videoDescription, Language.ENGLISH)
    ).toEqual({
      name: 'Sommerfest',
      description: 'Deutsch',
      videoDescription: 'Video',
    });
  });

  it('reports required and optional translation completeness', () => {
    expect(getActivityCompleteness(translations, videoDescription)).toEqual({
      name: { complete: false, missingLanguages: [Language.ENGLISH] },
      description: { complete: false, missingLanguages: [Language.ENGLISH] },
      videoDescription: {
        complete: false,
        missingLanguages: [Language.ENGLISH, Language.CHINESE],
      },
    });
  });
});
