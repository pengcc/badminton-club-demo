import { describe, expect, it } from 'vitest';
import { getMatchCommandErrorMessageKey } from '../../lib/matchCommandErrors';

describe('Match command error mapping', () => {
  it('distinguishes equal schedule facts from stale version conflicts', () => {
    expect(
      getMatchCommandErrorMessageKey({
        response: {
          status: 409,
          data: { code: 'MATCH_SCHEDULE_DUPLICATE' },
        },
      })
    ).toBe('errors.duplicateSchedule');
    expect(
      getMatchCommandErrorMessageKey({
        response: { status: 409, data: { code: 'CONFLICT' } },
      })
    ).toBe('errors.conflict');
  });

  it('keeps invalid starts and unexpected failures distinct', () => {
    expect(getMatchCommandErrorMessageKey({ response: { status: 400 } })).toBe(
      'errors.invalidStart'
    );
    expect(
      getMatchCommandErrorMessageKey({ response: { status: 500 } })
    ).toBeNull();
  });
});
