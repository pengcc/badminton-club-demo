import { describe, expect, it } from 'vitest';
import { MATCH_ARRIVAL_GUIDANCE_MAX_LENGTH, type Api } from '../api/match';
import { MatchDirection } from '../core/enums';
import { createMatchSchema, updateMatchSchema } from '../schemas/match';
import type { MatchView } from '../view/match';
import { MatchViewTransformers } from '../view/transformers/match';

const formData: MatchView.MatchFormData = {
  teamId: '507f1f77bcf86cd799439011',
  opponentName: 'Visitors',
  direction: MatchDirection.HOME,
  localDate: '2026-08-15',
  localTime: '19:30',
  location: 'C1 Hall',
  arrivalGuidance: '',
};

describe('Match arrival guidance contract', () => {
  it('trims guidance, maps blank input to absence, and enforces the limit', () => {
    expect(
      createMatchSchema.parse({
        ...formData,
        arrivalGuidance: '  Side entrance\nRing the bell.  ',
      }).arrivalGuidance
    ).toBe('Side entrance\nRing the bell.');
    expect(
      createMatchSchema.parse({
        ...formData,
        arrivalGuidance: '   ',
      }).arrivalGuidance
    ).toBeUndefined();
    expect(() =>
      updateMatchSchema.parse({
        expectedVersion: 0,
        ...formData,
        arrivalGuidance: 'x'.repeat(MATCH_ARRIVAL_GUIDANCE_MAX_LENGTH + 1),
      })
    ).toThrow();
  });

  it('normalizes form requests and preserves response guidance in view projections', () => {
    expect(
      MatchViewTransformers.toCreateRequest({
        ...formData,
        arrivalGuidance: '  Use the rear entrance.  ',
      })
    ).toMatchObject({ arrivalGuidance: 'Use the rear entrance.' });
    expect(
      MatchViewTransformers.toUpdateRequest(formData, 2)
    ).not.toHaveProperty('arrivalGuidance');

    const response = {
      id: 'match-1',
      version: 0,
      teamId: formData.teamId,
      opponentName: formData.opponentName,
      direction: formData.direction,
      startAt: '2026-08-15T17:30:00.000Z',
      localStart: {
        date: formData.localDate,
        time: formData.localTime,
        timeZone: 'Europe/Berlin',
      },
      location: formData.location,
      arrivalGuidance: 'Use the rear entrance.',
      lineup: [],
      availability: [],
      lineupWarnings: [],
      createdById: '507f1f77bcf86cd799439012',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    } satisfies Api.MatchDetailResponse;

    expect(MatchViewTransformers.toMatchDetails(response).arrivalGuidance).toBe(
      'Use the rear entrance.'
    );
  });
});
