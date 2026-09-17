import { describe, expect, it } from 'vitest';
import { MatchDirection } from '@club/shared-types/core/enums';
import {
  buildMatchScheduleDuplicateKey,
  isMatchScheduleDuplicateError,
  MATCH_SCHEDULE_DUPLICATE_INDEX,
  normalizeMatchScheduleComparison,
  normalizeMatchScheduleText,
} from '../../services/matchScheduleDuplicateKey';

const base = {
  teamId: '507f1f77bcf86cd799439011',
  opponentName: 'BC Grün-Weiß II',
  direction: MatchDirection.HOME,
  startAt: new Date('2026-08-15T17:30:00.000Z'),
  location: 'Sporthalle\nStraße 1, Berlin',
};

describe('Match schedule duplicate key', () => {
  it('normalizes Unicode, whitespace, and German-lowercase comparison text', () => {
    expect(normalizeMatchScheduleText('  BC   Gru\u0308n-Weiß II  ')).toBe(
      'BC Grün-Weiß II'
    );
    expect(normalizeMatchScheduleComparison('  ÄBC   II  ')).toBe('äbc ii');
    expect(
      buildMatchScheduleDuplicateKey({
        ...base,
        opponentName: '  bc   gru\u0308n-weiß ii ',
        location: '  sporthalle \n Straße 1, Berlin ',
      })
    ).toBe(buildMatchScheduleDuplicateKey(base));
  });

  it('keeps every semantic duplicate fact distinct and safely serializes delimiters', () => {
    const key = buildMatchScheduleDuplicateKey(base);
    expect(
      buildMatchScheduleDuplicateKey({
        ...base,
        direction: MatchDirection.AWAY,
      })
    ).not.toBe(key);
    expect(
      buildMatchScheduleDuplicateKey({
        ...base,
        startAt: new Date('2026-08-15T18:30:00.000Z'),
      })
    ).not.toBe(key);
    expect(
      buildMatchScheduleDuplicateKey({ ...base, location: `${base.location}!` })
    ).not.toBe(key);
    expect(
      buildMatchScheduleDuplicateKey({
        ...base,
        opponentName: 'BC Grün-Weiß III',
      })
    ).not.toBe(key);
    expect(
      buildMatchScheduleDuplicateKey({
        ...base,
        opponentName: 'a","home","b',
      })
    ).toContain('a\\",\\"home\\",\\"b');
  });

  it('recognizes only the named schedule-key duplicate violation', () => {
    expect(
      isMatchScheduleDuplicateError({
        code: 11000,
        message: `index: ${MATCH_SCHEDULE_DUPLICATE_INDEX} dup key`,
      })
    ).toBe(true);
    expect(
      isMatchScheduleDuplicateError({
        code: 11000,
        keyPattern: { scheduleDuplicateKey: 1 },
      })
    ).toBe(true);
    expect(
      isMatchScheduleDuplicateError({
        code: 11000,
        message: 'index: users_email_unique dup key',
      })
    ).toBe(false);
    expect(isMatchScheduleDuplicateError(new Error('not mongo'))).toBe(false);
  });
});
