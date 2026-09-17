import { describe, expect, it } from 'vitest';
import {
  eligibleMembershipTerminationDates,
  isEligibleMembershipTerminationDate,
} from '../../lib/membershipTerminationDates';

describe('membership termination date choices', () => {
  it('keeps a quarter end through its final Berlin notice date', () => {
    expect(
      eligibleMembershipTerminationDates({
        requestedAt: new Date('2026-05-31T21:59:59.000Z'),
        evaluatedAt: new Date('2026-05-31T21:59:59.000Z'),
      })[0]
    ).toBe('2026-06-30');
    expect(
      eligibleMembershipTerminationDates({
        requestedAt: new Date('2026-05-31T22:00:00.000Z'),
        evaluatedAt: new Date('2026-05-31T22:00:00.000Z'),
      })[0]
    ).toBe('2026-09-30');
  });

  it('supports later chunks without creating a fixed maximum', () => {
    const first = eligibleMembershipTerminationDates({
      requestedAt: new Date('2026-01-01T12:00:00.000Z'),
      evaluatedAt: new Date('2026-01-01T12:00:00.000Z'),
      limit: 8,
    });
    const later = eligibleMembershipTerminationDates({
      requestedAt: new Date('2026-01-01T12:00:00.000Z'),
      evaluatedAt: new Date('2026-01-01T12:00:00.000Z'),
      limit: 16,
    });
    expect(first).toHaveLength(8);
    expect(later).toHaveLength(16);
    expect(later.slice(0, 8)).toEqual(first);
  });

  it('uses the offline received time for notice and current time for future validity', () => {
    const input = {
      requestedAt: new Date('2026-05-31T12:00:00.000Z'),
      evaluatedAt: new Date('2026-06-01T12:00:00.000Z'),
    };
    expect(isEligibleMembershipTerminationDate('2026-06-30', input)).toBe(true);
    expect(
      isEligibleMembershipTerminationDate('2026-06-30', {
        ...input,
        evaluatedAt: new Date('2026-06-30T00:00:00.000Z'),
      })
    ).toBe(false);
  });
});
