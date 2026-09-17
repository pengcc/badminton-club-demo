import { describe, expect, it } from 'vitest';
import { createLocationSchema } from '../api/location';

const baseLocation = {
  translations: {
    de: { name: 'Halle', address: 'Adresse' },
    en: { name: 'Hall', address: 'Address' },
    zh: { name: '体育馆', address: '地址' },
  },
  timeSlots: [
    {
      weekday: 'friday',
      startTime: '19:00',
      endTime: '21:30',
      active: true,
      guestPlayEnabled: true,
      note: { de: 'Ligaspieler', en: 'League players', zh: '联赛球员' },
    },
  ],
};

describe('Location contract', () => {
  it('accepts the canonical localized weekly time-slot shape', () => {
    expect(createLocationSchema.parse(baseLocation).timeSlots[0]).toEqual({
      ...baseLocation.timeSlots[0],
      tasterSessionEnabled: true,
      tasterSessionAcceptedLevels: ['beginner', 'experienced'],
    });
  });

  it('defaults Taster Session to both levels and validates explicit restrictions', () => {
    const unrestricted = createLocationSchema.parse(baseLocation);
    expect(unrestricted.timeSlots[0]).toMatchObject({
      tasterSessionEnabled: true,
      tasterSessionAcceptedLevels: ['beginner', 'experienced'],
    });
    expect(
      createLocationSchema.parse({
        ...baseLocation,
        timeSlots: [
          {
            ...baseLocation.timeSlots[0],
            tasterSessionAcceptedLevels: ['experienced'],
          },
        ],
      }).timeSlots[0].tasterSessionAcceptedLevels
    ).toEqual(['experienced']);
    for (const levels of [[], ['beginner', 'beginner'], ['advanced']]) {
      expect(
        createLocationSchema.safeParse({
          ...baseLocation,
          timeSlots: [
            {
              ...baseLocation.timeSlots[0],
              tasterSessionEnabled: true,
              tasterSessionAcceptedLevels: levels,
            },
          ],
        }).success
      ).toBe(false);
    }
    expect(
      createLocationSchema.safeParse({
        ...baseLocation,
        timeSlots: [
          {
            ...baseLocation.timeSlots[0],
            tasterSessionEnabled: false,
            tasterSessionAcceptedLevels: [],
          },
        ],
      }).success
    ).toBe(true);
  });

  it('defaults missing Guest Play availability to unrestricted and preserves explicit restriction', () => {
    const { guestPlayEnabled: _ignored, ...slotWithoutGuestPlaySetting } =
      baseLocation.timeSlots[0];

    const unrestricted = createLocationSchema.parse({
      ...baseLocation,
      timeSlots: [slotWithoutGuestPlaySetting],
    });

    const restricted = createLocationSchema.parse({
      ...baseLocation,
      timeSlots: [
        {
          ...baseLocation.timeSlots[0],
          guestPlayEnabled: false,
        },
      ],
    });

    expect(unrestricted.timeSlots[0].guestPlayEnabled).toBe(true);
    expect(restricted.timeSlots[0].guestPlayEnabled).toBe(false);
  });

  it.each([
    ['invalid weekday', { weekday: 'holiday' }],
    ['invalid start time', { startTime: '7pm' }],
    ['non-increasing range', { startTime: '21:30', endTime: '21:30' }],
  ])('rejects %s', (_label, timeSlotPatch) => {
    const result = createLocationSchema.safeParse({
      ...baseLocation,
      timeSlots: [{ ...baseLocation.timeSlots[0], ...timeSlotPatch }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects duplicate stable identifiers and oversized localized notes', () => {
    const id = '0a0a0a0a-0000-4000-8000-000000000001';
    const duplicateResult = createLocationSchema.safeParse({
      ...baseLocation,
      timeSlots: [
        { ...baseLocation.timeSlots[0], id },
        { ...baseLocation.timeSlots[0], id },
      ],
    });
    const noteResult = createLocationSchema.safeParse({
      ...baseLocation,
      timeSlots: [
        { ...baseLocation.timeSlots[0], note: { en: 'x'.repeat(501) } },
      ],
    });

    expect(duplicateResult.success).toBe(false);
    expect(noteResult.success).toBe(false);
  });
});
