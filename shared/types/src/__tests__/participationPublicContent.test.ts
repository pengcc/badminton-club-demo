import { describe, expect, it } from 'vitest';
import { Language } from '../core/enums';
import {
  getTasterSessionPublicContentCompleteness,
  resolveTasterSessionPublicContent,
  tasterSessionPublicContentValuesSchema,
} from '../api/tasterSessionPublicContent';
import {
  getMembershipPublicContentCompleteness,
  membershipPublicContentValuesSchema,
  resolveMembershipPublicContent,
} from '../api/membershipPublicContent';
import {
  getRecruitmentPublicContentCompleteness,
  recruitmentPublicContentValuesSchema,
  resolveRecruitmentPublicContent,
} from '../api/recruitmentPublicContent';

const localized = (de: string, en = '', zh = '') => ({ de, en, zh });

describe('bounded participation public-content contracts', () => {
  it('requires German for every required Taster field and allows empty optional fields', () => {
    const parsed = tasterSessionPublicContentValuesSchema.safeParse({
      homepageSummary: localized('Kurz'),
      introduction: localized('Einführung'),
      preparation: localized(''),
      participationGuidance: localized(''),
      followUpGuidance: localized(''),
    });

    expect(parsed.success).toBe(true);
    expect(
      tasterSessionPublicContentValuesSchema.safeParse({
        homepageSummary: localized(''),
        introduction: localized('Einführung'),
        preparation: localized(''),
        participationGuidance: localized(''),
        followUpGuidance: localized(''),
      }).success
    ).toBe(false);
  });

  it('uses only the requested translation and German fallback for Taster content', () => {
    const content = {
      homepageSummary: localized('Kurz', '', '简介'),
      introduction: localized('Einführung', 'Introduction'),
      preparation: localized('Vorbereitung'),
      participationGuidance: localized(''),
      followUpGuidance: localized('Antwort'),
    };

    expect(
      resolveTasterSessionPublicContent(content, Language.ENGLISH)
    ).toMatchObject({
      homepageSummary: 'Kurz',
      introduction: 'Introduction',
      preparation: 'Vorbereitung',
      participationGuidance: '',
    });
    expect(
      getTasterSessionPublicContentCompleteness(content).preparation.complete
    ).toBe(false);
  });

  it('enforces the exact required Membership fields and reports missing locales', () => {
    const content = {
      homepageSummary: localized('Kurz'),
      introduction: localized('Einführung'),
      membershipTypes: localized('Arten'),
      membershipPath: localized('Weg'),
      applicationPreparation: localized(''),
      studentProof: localized(''),
    };

    expect(membershipPublicContentValuesSchema.safeParse(content).success).toBe(
      true
    );
    expect(
      getMembershipPublicContentCompleteness(content).membershipPath
        .missingLanguages
    ).toEqual([Language.ENGLISH, Language.CHINESE]);
    expect(
      resolveMembershipPublicContent(content, Language.CHINESE).membershipTypes
    ).toBe('Arten');
  });

  it('keeps Recruitment localized content required and the Contact identity nullable', () => {
    const content = {
      isOpen: false,
      introduction: localized('Einführung', '', '介绍'),
      requirements: localized('Erfahrung'),
      tryoutGuidance: localized('Kontakt aufnehmen'),
      contactEntryId: null,
    };

    expect(
      recruitmentPublicContentValuesSchema.safeParse(content).success
    ).toBe(true);
    expect(
      recruitmentPublicContentValuesSchema.safeParse({
        ...content,
        requirements: localized(''),
      }).success
    ).toBe(false);
    expect(
      resolveRecruitmentPublicContent(content, Language.ENGLISH)
    ).toMatchObject({
      isOpen: false,
      introduction: 'Einführung',
      contactEntryId: null,
    });
    expect(
      getRecruitmentPublicContentCompleteness(content).introduction
        .missingLanguages
    ).toEqual([Language.ENGLISH]);
  });
});
