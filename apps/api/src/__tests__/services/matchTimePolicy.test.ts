import { describe, expect, it } from 'vitest';
import {
  berlinLocalStartToDate,
  dateToBerlinLocalStart,
} from '../../services/matchTimePolicy';

describe('Match Europe/Berlin time policy', () => {
  it.each([
    ['2026-03-29', '01:59', '2026-03-29T00:59:00.000Z'],
    ['2026-03-29', '03:00', '2026-03-29T01:00:00.000Z'],
    ['2026-10-25', '01:59', '2026-10-24T23:59:00.000Z'],
    ['2026-10-25', '03:00', '2026-10-25T02:00:00.000Z'],
    ['2026-01-15', '19:30', '2026-01-15T18:30:00.000Z'],
    ['2026-07-15', '19:30', '2026-07-15T17:30:00.000Z'],
    ['2028-02-29', '12:00', '2028-02-29T11:00:00.000Z'],
  ])('maps %s %s to the canonical instant', (localDate, localTime, expected) => {
    const startAt = berlinLocalStartToDate(localDate, localTime);
    expect(startAt.toISOString()).toBe(expected);
    expect(dateToBerlinLocalStart(startAt)).toEqual({
      date: localDate,
      time: localTime,
      timeZone: 'Europe/Berlin',
    });
  });

  it.each([
    ['2026-03-29', '02:00'],
    ['2026-03-29', '02:30'],
    ['2026-10-25', '02:00'],
    ['2026-10-25', '02:30'],
    ['2027-02-29', '12:00'],
  ])('rejects invalid or ambiguous %s %s', (localDate, localTime) => {
    expect(() => berlinLocalStartToDate(localDate, localTime)).toThrow(
      'valid, unambiguous Europe/Berlin local time'
    );
  });
});
