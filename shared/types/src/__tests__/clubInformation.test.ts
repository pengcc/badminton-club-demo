import { describe, expect, it } from 'vitest';
import { Language } from '../core/enums';
import {
  clubInformationValuesSchema,
  getClubInformationCompleteness,
  resolveClubInformation,
} from '../api/clubInformation';

const content = {
  officialNameGerman: 'Deutsch-Chinesischer Badminton Verein e. V.',
  nameEnglish: 'German-Chinese Badminton Club',
  nameChinese: '德中羽毛球俱乐部',
  shortName: 'DCBV',
  foundingYear: 2009,
  introduction: { de: 'Verein', en: '', zh: '俱乐部' },
};

describe('Club Information contract', () => {
  it('requires the finite canonical identity and German introduction', () => {
    expect(clubInformationValuesSchema.safeParse(content).success).toBe(true);
    expect(
      clubInformationValuesSchema.safeParse({
        ...content,
        officialNameGerman: '',
      }).success
    ).toBe(false);
    expect(
      clubInformationValuesSchema.safeParse({
        ...content,
        nameEnglish: '',
        nameChinese: '',
      }).success
    ).toBe(true);
    expect(
      clubInformationValuesSchema.safeParse({
        ...content,
        introduction: { de: '', en: 'Club', zh: '' },
      }).success
    ).toBe(false);
  });

  it('projects the localized name and German introduction fallback', () => {
    expect(resolveClubInformation(content, Language.ENGLISH)).toMatchObject({
      localizedName: 'German-Chinese Badminton Club',
      introduction: 'Verein',
      foundingYear: 2009,
    });
    expect(getClubInformationCompleteness(content).introduction).toEqual({
      complete: false,
      missingLanguages: [Language.ENGLISH],
    });
    const incompleteNames = { ...content, nameEnglish: '', nameChinese: '' };
    expect(
      resolveClubInformation(incompleteNames, Language.CHINESE).localizedName
    ).toBe(content.officialNameGerman);
    expect(
      getClubInformationCompleteness(incompleteNames).nameTranslations
    ).toEqual({
      complete: false,
      missingLanguages: [Language.ENGLISH, Language.CHINESE],
    });
  });
});
