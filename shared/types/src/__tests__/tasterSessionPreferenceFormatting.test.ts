import { describe, expect, it } from 'vitest';
import {
  formatTasterSessionPreferenceDetails,
  formatTasterSessionPreferenceInstant,
  formatStoredTasterSessionPreferenceDetails,
  TASTER_SESSION_TIME_ZONE,
} from '../view/tasterSessionRequest';

describe('Taster Session preference formatting', () => {
  it('always formats the canonical instant in the club time zone', () => {
    expect(TASTER_SESSION_TIME_ZONE).toBe('Europe/Berlin');
    expect(
      formatTasterSessionPreferenceInstant('2030-01-15T17:30:00.000Z', 'en')
    ).toMatchObject({
      date: '15 Jan 2030',
      time: '18:30',
      dateTime: '15 Jan 2030, 18:30',
    });
  });

  it('uses complete copied facts when available and retains the legacy fallback', () => {
    expect(
      formatStoredTasterSessionPreferenceDetails(
        {
          startsAt: '2030-08-02T17:00:00.000Z',
          localDate: '2030-08-02',
          startTime: '19:00',
          endTime: '21:30',
          locationName: 'Main Hall',
          locationAddress: 'Example Street 1',
          participationNote: 'Bring indoor shoes',
        },
        'en'
      )
    ).toBe(
      '2 Aug 2030 · 19:00–21:30 · Main Hall · Example Street 1 · Bring indoor shoes'
    );
    expect(
      formatStoredTasterSessionPreferenceDetails(
        {
          startsAt: '2030-07-15T17:30:00.000Z',
          locationName: 'Legacy Hall',
        },
        'en'
      )
    ).toBe('15 Jul 2030, 19:30 · Legacy Hall');
  });

  it('preserves the Berlin-local DST interpretation of each stored instant', () => {
    const firstOccurrence = formatTasterSessionPreferenceInstant(
      '2030-10-27T00:30:00.000Z',
      'de'
    );
    const secondOccurrence = formatTasterSessionPreferenceInstant(
      '2030-10-27T01:30:00.000Z',
      'de'
    );

    expect(firstOccurrence.time).toBe('02:30');
    expect(secondOccurrence.time).toBe('02:30');
    expect(
      formatTasterSessionPreferenceDetails(
        '2030-07-15T17:30:00.000Z',
        'Main Hall',
        'en'
      )
    ).toBe('15 Jul 2030, 19:30 · Main Hall');
  });
});
