import { describe, expect, it } from 'vitest';
import {
  approveMembershipTerminationSchema,
  batchRecordMembershipTerminationSchema,
  recordMembershipTerminationSchema,
  rejectMembershipTerminationSchema,
  requestMembershipTerminationSchema,
} from '../schemas/membershipTermination';

describe('membership termination timing contracts', () => {
  it('keeps member self-service limited to a scheduled effective date', () => {
    expect(
      requestMembershipTerminationSchema.safeParse({
        effectiveDate: '2026-09-30',
      }).success
    ).toBe(true);
    expect(
      requestMembershipTerminationSchema.safeParse({
        effectiveTiming: 'today',
        note: 'Administrative exception',
      }).success
    ).toBe(false);
    expect(
      requestMembershipTerminationSchema.safeParse({
        effectiveDate: '2026-09-30',
        continueAsExternalPlayer: true,
      }).success
    ).toBe(false);
  });

  it.each([
    approveMembershipTerminationSchema,
    recordMembershipTerminationSchema,
    batchRecordMembershipTerminationSchema,
  ])('requires a bounded reason and no client date for Today', (schema) => {
    const base =
      schema === recordMembershipTerminationSchema
        ? {
            userId: 'user-1',
            source: 'email',
            requestReceivedAt: '2026-08-01T10:00:00.000Z',
          }
        : schema === batchRecordMembershipTerminationSchema
          ? { userIds: ['user-1'] }
          : {};
    expect(
      schema.safeParse({
        ...base,
        effectiveTiming: 'today',
        note: 'Exceptional immediate exit',
      }).success
    ).toBe(true);
    expect(
      schema.safeParse({ ...base, effectiveTiming: 'today', note: '   ' })
        .success
    ).toBe(false);
    expect(
      schema.safeParse({
        ...base,
        effectiveTiming: 'today',
        effectiveDate: '2026-09-30',
        note: 'Exceptional immediate exit',
      }).success
    ).toBe(false);
  });

  it('forbids a replacement date for scheduled online approval', () => {
    expect(
      approveMembershipTerminationSchema.safeParse({
        effectiveTiming: 'scheduled',
        effectiveDate: '2026-09-30',
      }).success
    ).toBe(false);
    expect(
      approveMembershipTerminationSchema.safeParse({
        effectiveTiming: 'scheduled',
      }).success
    ).toBe(true);
  });

  it('requires a bounded trimmed rejection reason', () => {
    expect(
      rejectMembershipTerminationSchema.safeParse({ reason: 'Not approved' })
        .success
    ).toBe(true);
    expect(
      rejectMembershipTerminationSchema.safeParse({ reason: '   ' }).success
    ).toBe(false);
    expect(
      rejectMembershipTerminationSchema.safeParse({ reason: 'x'.repeat(1001) })
        .success
    ).toBe(false);
  });
});
