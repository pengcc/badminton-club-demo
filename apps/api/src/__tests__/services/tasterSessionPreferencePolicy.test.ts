import { Temporal } from '@js-temporal/polyfill';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Location } from '../../models/Location';
import { TasterSessionPreferencePolicy } from '../../services/tasterSessionPreferencePolicy';

const translations = {
  de: { name: 'Haupthalle', address: 'Beispielstraße 1' },
  en: { name: 'Main Hall', address: 'Example Street 1' },
  zh: { name: '主体育馆', address: '示例街1号' },
};

function mockLocations(
  timeSlots: Array<Record<string, unknown>>,
  active = true
) {
  vi.spyOn(Location, 'find').mockReturnValue({
    lean: vi.fn().mockResolvedValue([
      {
        _id: '507f1f77bcf86cd799439012',
        translations,
        isActive: active,
        timeSlots,
      },
    ]),
  } as never);
}

const fridaySlots = [
  {
    id: 'beginner-friday',
    weekday: 'friday',
    startTime: '19:00',
    endTime: '21:00',
    active: true,
    guestPlayEnabled: false,
    tasterSessionEnabled: true,
    tasterSessionAcceptedLevels: ['beginner'],
    note: { en: 'Bring indoor shoes', de: 'Hallenschuhe mitbringen' },
  },
  {
    id: 'experienced-friday',
    weekday: 'friday',
    startTime: '20:00',
    endTime: '22:00',
    active: true,
    guestPlayEnabled: true,
    tasterSessionEnabled: true,
    tasterSessionAcceptedLevels: ['experienced'],
  },
];

afterEach(() => vi.restoreAllMocks());

describe('Taster Session preference policy', () => {
  it('filters shared slots by visitor category independently of Guest Play and never projects capacity', async () => {
    mockLocations(fridaySlots);
    const now = Temporal.Instant.from('2030-08-01T10:00:00Z');

    const beginner = await TasterSessionPreferencePolicy.listOptions(
      'beginner',
      'en',
      now
    );
    const experienced = await TasterSessionPreferencePolicy.listOptions(
      'experienced',
      'en',
      now
    );

    expect(beginner).toHaveLength(3);
    expect(experienced).toHaveLength(3);
    expect(beginner[0]).toMatchObject({
      startsAt: '2030-08-02T17:00:00Z',
      startTime: '19:00',
      endTime: '21:00',
      timeSlotId: 'beginner-friday',
      location: { name: 'Main Hall', address: 'Example Street 1' },
      note: 'Bring indoor shoes',
    });
    expect(JSON.stringify([...beginner, ...experienced])).not.toContain(
      'capacity'
    );
  });

  it('uses default-open Taster policy and locale-independent identity with localized facts', async () => {
    mockLocations([
      {
        id: 'default-friday',
        weekday: 'friday',
        startTime: '19:00',
        endTime: '21:00',
        active: true,
      },
    ]);
    const now = Temporal.Instant.from('2030-08-01T10:00:00Z');
    const english = await TasterSessionPreferencePolicy.listOptions(
      'beginner',
      'en',
      now
    );
    const german = await TasterSessionPreferencePolicy.listOptions(
      'experienced',
      'de',
      now
    );
    const chinese = await TasterSessionPreferencePolicy.listOptions(
      'beginner',
      'zh',
      now
    );

    expect(english[0]?.id).toBe(german[0]?.id);
    expect(english[0]?.id).toBe(chinese[0]?.id);
    expect(english[0]?.location.name).toBe('Main Hall');
    expect(german[0]?.location.name).toBe('Haupthalle');
    expect(chinese[0]?.location).toMatchObject({
      name: '主体育馆',
      address: '示例街1号',
    });
  });

  it('requires and re-resolves a matching server-derived choice', async () => {
    mockLocations(fridaySlots);
    const options = await TasterSessionPreferencePolicy.listOptions(
      'beginner',
      'en'
    );
    await expect(
      TasterSessionPreferencePolicy.validateSelection('beginner', 'en')
    ).rejects.toThrow('Select one non-binding');
    await expect(
      TasterSessionPreferencePolicy.validateSelection('beginner', 'en', {
        optionId: 'forged',
        startsAt: options[0]!.startsAt,
      })
    ).rejects.toThrow('no longer available');
    await expect(
      TasterSessionPreferencePolicy.validateSelection('beginner', 'en', {
        optionId: options[0]!.id,
        startsAt: options[0]!.startsAt,
      })
    ).resolves.toMatchObject({
      timeSlotId: 'beginner-friday',
      locationName: 'Main Hall',
      locationAddress: 'Example Street 1',
      startTime: '19:00',
      endTime: '21:00',
      participationNote: 'Bring indoor shoes',
    });
  });

  it('allows omission when no matching active option exists', async () => {
    mockLocations([{ ...fridaySlots[0], tasterSessionEnabled: false }]);
    await expect(
      TasterSessionPreferencePolicy.validateSelection('beginner', 'en')
    ).resolves.toBeUndefined();
  });

  it('excludes inactive and elapsed slots', async () => {
    mockLocations([
      fridaySlots[0]!,
      { ...fridaySlots[0]!, id: 'inactive', active: false },
    ]);
    const options = await TasterSessionPreferencePolicy.listOptions(
      'beginner',
      'en',
      Temporal.Instant.from('2030-08-02T17:30:00Z')
    );
    expect(options).toHaveLength(2);
  });

  it.each([
    ['nonexistent', '2030-03-30T10:00:00Z'],
    ['ambiguous', '2030-10-26T10:00:00Z'],
  ])('rejects %s Europe/Berlin wall time', async (_case, now) => {
    mockLocations([
      {
        id: 'dst-sunday',
        weekday: 'sunday',
        startTime: '02:30',
        endTime: '03:30',
        active: true,
        tasterSessionAcceptedLevels: ['beginner'],
      },
    ]);
    await expect(
      TasterSessionPreferencePolicy.listOptions(
        'beginner',
        'en',
        Temporal.Instant.from(now)
      )
    ).rejects.toThrow('valid, unambiguous Europe/Berlin times');
  });
});
