import { describe, expect, it } from 'vitest';
import {
  assertValidTerminationDate,
  assertValidTerminationRequestTimestamp,
  berlinDateOnly,
  isQuarterEnd,
  latestNoticeDate,
  parseDateOnly,
} from '../../services/membershipTerminationPolicy';

describe('membership termination date policy', () => {
  it.each([
    '2026-03-31',
    '2026-06-30',
    '2026-09-30',
    '2026-12-31',
  ])('accepts quarter end %s', (date) => expect(isQuarterEnd(date)).toBe(true));

  it('returns false for a valid non-quarter date', () => {
    expect(isQuarterEnd('2026-02-28')).toBe(false);
  });

  it.each([
    '2026-06-31',
    '2026/06/30',
    'not-a-date',
  ])('rejects invalid date %s', (date) =>
    expect(() => isQuarterEnd(date)).toThrow());

  it('computes the latest notice date including leap years', () => {
    expect(latestNoticeDate('2026-06-30')).toBe('2026-05-31');
    expect(latestNoticeDate('2028-03-31')).toBe('2028-02-29');
  });

  it('uses the Berlin calendar date at the summer notice boundary', () => {
    expect(() =>
      assertValidTerminationDate({
        effectiveDate: '2026-06-30',
        requestedAt: new Date('2026-05-31T21:59:59.999Z'),
        evaluatedAt: new Date('2026-05-31T21:59:59.999Z'),
      })
    ).not.toThrow();
    expect(() =>
      assertValidTerminationDate({
        effectiveDate: '2026-06-30',
        requestedAt: new Date('2026-05-31T22:00:00.000Z'),
        evaluatedAt: new Date('2026-05-31T22:00:00.000Z'),
      })
    ).toThrow(/full calendar month/);
  });

  it('uses the Berlin calendar date at a winter offset', () => {
    expect(berlinDateOnly(new Date('2026-02-28T22:59:59.999Z'))).toBe(
      '2026-02-28'
    );
    expect(berlinDateOnly(new Date('2026-02-28T23:00:00.000Z'))).toBe(
      '2026-03-01'
    );
  });

  it('rejects insufficient notice, elapsed dates, and future request times', () => {
    expect(() =>
      assertValidTerminationDate({
        effectiveDate: '2026-06-30',
        requestedAt: new Date('2026-06-01T00:00:00.000Z'),
        evaluatedAt: new Date('2026-06-01T00:00:00.000Z'),
      })
    ).toThrow(/full calendar month/);
    expect(() =>
      assertValidTerminationDate({
        effectiveDate: '2026-06-30',
        requestedAt: new Date('2026-05-01T00:00:00.000Z'),
        evaluatedAt: new Date('2026-06-30T00:00:00.000Z'),
      })
    ).toThrow(/future/);
    expect(() =>
      assertValidTerminationDate({
        effectiveDate: '2026-09-30',
        requestedAt: new Date('2026-07-02T00:00:00.000Z'),
        evaluatedAt: new Date('2026-07-01T00:00:00.000Z'),
      })
    ).toThrow(/cannot be in the future/);
  });

  it('rejects invalid request and evaluation timestamps independently of scheduling', () => {
    expect(() =>
      assertValidTerminationRequestTimestamp({
        requestedAt: new Date('invalid'),
        evaluatedAt: new Date('2026-07-01T00:00:00.000Z'),
      })
    ).toThrow(/Request timestamp is invalid/);
    expect(() =>
      assertValidTerminationRequestTimestamp({
        requestedAt: new Date('2026-07-01T00:00:00.000Z'),
        evaluatedAt: new Date('invalid'),
      })
    ).toThrow(/Evaluation timestamp is invalid/);
  });

  it('strictly parses calendar dates', () => {
    expect(parseDateOnly('2028-02-29').toISOString()).toBe(
      '2028-02-29T00:00:00.000Z'
    );
    expect(() => parseDateOnly('2026-02-29')).toThrow(/valid calendar/);
  });
});
