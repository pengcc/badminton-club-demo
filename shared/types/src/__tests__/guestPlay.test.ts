import { describe, expect, it } from 'vitest';
import {
  createGuestPlaySchema,
  guestPlayCorrectionSchema,
  guestPlayDecisionSchema,
} from '../api/guestPlay';

const validRequest = {
  locationId: '507f1f77bcf86cd799439011',
  timeSlotId: 'slot-id',
  localDate: '2026-08-10',
  guestCount: 1,
  locale: 'en',
};

describe('Guest Play contracts', () => {
  it('accepts one to five guests and rejects boundary violations', () => {
    expect(createGuestPlaySchema.safeParse(validRequest).success).toBe(true);
    expect(
      createGuestPlaySchema.safeParse({ ...validRequest, guestCount: 5 })
        .success
    ).toBe(true);
    expect(
      createGuestPlaySchema.safeParse({ ...validRequest, guestCount: 0 })
        .success
    ).toBe(false);
    expect(
      createGuestPlaySchema.safeParse({ ...validRequest, guestCount: 6 })
        .success
    ).toBe(false);
  });

  it('rejects client-authored opportunity facts and unsupported lifecycle fields', () => {
    expect(
      createGuestPlaySchema.safeParse({
        ...validRequest,
        locationName: 'Client supplied',
      }).success
    ).toBe(false);
    expect(
      guestPlayDecisionSchema.safeParse({
        expectedVersion: 0,
        decision: 'cancelled',
      }).success
    ).toBe(false);
  });

  it('requires a non-blank reason for an explicit decision correction', () => {
    expect(
      guestPlayCorrectionSchema.safeParse({
        expectedVersion: 1,
        decision: 'declined',
        reason: 'Schedule changed',
      }).success
    ).toBe(true);
    expect(
      guestPlayCorrectionSchema.safeParse({
        expectedVersion: 1,
        decision: 'declined',
        reason: ' ',
      }).success
    ).toBe(false);
  });
});
