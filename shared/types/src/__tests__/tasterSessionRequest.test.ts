import { describe, expect, it } from 'vitest';
import {
  createTasterSessionRequestSchema,
  tasterSessionDispositionSchema,
  tasterSessionListQuerySchema,
  tasterSessionPreferenceOptionSchema,
  tasterSessionPreferenceOptionsQuerySchema,
  tasterSessionRequestResponseSchema,
} from '../api/tasterSessionRequest';

describe('Taster Session request contracts', () => {
  it('accepts only the visitor request boundary and rejects booking-shaped fields', () => {
    expect(
      createTasterSessionRequestSchema.parse({
        name: 'Visitor',
        email: 'visitor@example.test',
        playerLevel: 'beginner',
        locale: 'en',
        preference: {
          optionId: 'server-derived-option',
          startsAt: '2030-08-02T17:00:00.000Z',
        },
      })
    ).toMatchObject({ playerLevel: 'beginner' });

    expect(() =>
      createTasterSessionRequestSchema.parse({
        name: 'Visitor',
        email: 'visitor@example.test',
        playerLevel: 'experienced',
        appointmentDate: '2030-08-02T17:00:00.000Z',
        capacity: 2,
      })
    ).toThrow();
  });

  it('models terminal outcomes explicitly and keeps archive outside disposition', () => {
    expect(
      tasterSessionDispositionSchema.parse({
        expectedVersion: 2,
        disposition: 'declined',
        declineReason: 'no_capacity',
        sendEmail: false,
      })
    ).toMatchObject({
      disposition: 'declined',
      declineReason: 'no_capacity',
    });
    for (const forbidden of ['pending', 'archived', 'contacted', 'closed']) {
      expect(() =>
        tasterSessionDispositionSchema.parse({
          expectedVersion: 2,
          disposition: forbidden,
        })
      ).toThrow();
    }
    expect(() =>
      tasterSessionDispositionSchema.parse({
        expectedVersion: 2,
        disposition: 'invited',
        declineReasonDetails: 'Not applicable',
        sendEmail: false,
      })
    ).toThrow('Decline reasons apply only');
  });

  it('normalizes administrator list query defaults', () => {
    expect(tasterSessionListQuerySchema.parse({})).toEqual({
      status: 'all',
      playerLevel: 'all',
      archived: 'exclude',
      limit: 50,
      offset: 0,
    });
  });

  it('requires locale for localized preference discovery', () => {
    expect(
      tasterSessionPreferenceOptionsQuerySchema.parse({
        playerLevel: 'beginner',
        locale: 'zh',
      })
    ).toEqual({ playerLevel: 'beginner', locale: 'zh' });
    expect(() =>
      tasterSessionPreferenceOptionsQuerySchema.parse({
        playerLevel: 'beginner',
      })
    ).toThrow();
  });

  it('keeps response projections strict and capacity-free', () => {
    expect(() =>
      tasterSessionPreferenceOptionSchema.parse({
        id: 'option',
        timeSlotId: 'slot',
        localDate: '2030-08-02',
        startTime: '19:00',
        endTime: '21:00',
        startsAt: '2030-08-02T17:00:00.000Z',
        endsAt: '2030-08-02T19:00:00.000Z',
        location: {
          id: 'hall',
          name: 'Main Hall',
          address: 'Example Street',
        },
        capacity: 10,
      })
    ).toThrow();

    const baseResponse = {
      id: 'request',
      name: 'Visitor',
      email: 'visitor@example.test',
      playerLevel: 'beginner',
      status: 'pending',
      archived: false,
      delivery: {
        status: 'not_requested',
        retryAvailable: false,
      },
      locale: 'en',
      version: 0,
      createdAt: '2030-08-01T10:00:00.000Z',
      updatedAt: '2030-08-01T10:00:00.000Z',
    };
    expect(tasterSessionRequestResponseSchema.parse(baseResponse)).toEqual(
      baseResponse
    );
    expect(() =>
      tasterSessionRequestResponseSchema.parse({
        ...baseResponse,
        status: 'closed',
      })
    ).toThrow();
  });
});
