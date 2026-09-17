import { afterEach, describe, expect, it } from 'vitest';
import { formatTasterSessionPreferenceInstant } from '@club/shared-types/view/tasterSessionRequest';

const originalTimeZone = process.env.TZ;

afterEach(() => {
  process.env.TZ = originalTimeZone;
});

describe('Taster Session preference formatting runtime independence', () => {
  it('uses Europe/Berlin when the process time zone is elsewhere', () => {
    process.env.TZ = 'America/Los_Angeles';

    expect(
      formatTasterSessionPreferenceInstant('2030-08-02T17:00:00.000Z', 'en')
    ).toMatchObject({
      date: '2 Aug 2030',
      time: '19:00',
      dateTime: '2 Aug 2030, 19:00',
    });
  });
});
