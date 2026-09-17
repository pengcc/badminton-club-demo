import express from 'express';
import request from 'supertest';
import {
  canonicalAuthUserDocument,
  FIRST_PARTY_ORIGIN,
  mockAuthSessionCookie,
} from '../helpers/authSession';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  AccountOnboardingStatus,
  MatchDirection,
  MembershipStatus,
  AccountKind,
  Capability,
} from '@club/shared-types/core/enums';
import matchRoutes from '../../routes/matches';
import { errorHandler } from '../../middleware/errorHandler';
import { User } from '../../models/User';
import { Player } from '../../models/Player';
import { MatchCsvImportService } from '../../services/matchCsvImportService';
import { MATCH_CSV_MAX_FILE_BYTES } from '../../middleware/matchCsvUpload';

const userId = '507f1f77bcf86cd799439011';
const teamId = '507f1f77bcf86cd799439012';
let administratorDesignation = true;
let membershipStatus = MembershipStatus.ACTIVE;

function app() {
  const value = express();
  value.use(express.json());
  value.use('/api/matches', matchRoutes);
  value.use(errorHandler);
  return value;
}

function token(): string {
  return mockAuthSessionCookie(userId);
}

describe('POST /api/matches/import-csv', () => {
  beforeEach(() => {
    administratorDesignation = true;
    membershipStatus = MembershipStatus.ACTIVE;
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(User, 'findById').mockReturnValue({
      select: vi.fn().mockImplementation(async () =>
        canonicalAuthUserDocument({
          _id: userId,
          id: userId,
          email: 'admin@example.test',
          firstName: 'CSV',
          lastName: 'Administrator',
          accountKind: AccountKind.PERSON,
          administratorDesignation,
          membershipStatus,
          accountOnboardingStatus: AccountOnboardingStatus.READY,
        })
      ),
    } as never);
    vi.spyOn(Player, 'findOne').mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(null),
      }),
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects unauthenticated and non-administrator requests before upload handling', async () => {
    expect(
      (
        await request(app())
          .post('/api/matches/import-csv')
          .attach('file', Buffer.from('unauthorized bytes'), 'x.csv')
          .field('teamId', teamId)
      ).status
    ).toBe(403);

    administratorDesignation = false;
    membershipStatus = MembershipStatus.ACTIVE;
    expect(
      (
        await request(app())
          .post('/api/matches/import-csv')
          .set('Cookie', token())
          .set('Origin', FIRST_PARTY_ORIGIN)
          .attach('file', Buffer.from('forbidden bytes'), 'x.csv')
          .field('teamId', teamId)
      ).status
    ).toBe(403);
  });

  it('passes the uploaded bytes, Team, and actor to the import owner', async () => {
    const bytes = Buffer.from('canonical bytes');
    const importCsv = vi
      .spyOn(MatchCsvImportService, 'import')
      .mockResolvedValue({
        summary: { input: 1, created: 1, duplicate: 0, failed: 0 },
        outcomes: [
          {
            rowNumber: 2,
            outcome: 'created',
            code: 'MATCH_CREATED',
            matchId: 'match-1',
            localDate: '2026-08-15',
            localTime: '19:30',
            opponentName: 'Visitors',
            direction: MatchDirection.HOME,
            location: 'Hall\nAddress',
          },
        ],
      });
    const response = await request(app())
      .post('/api/matches/import-csv')
      .set('Cookie', token())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .field('teamId', teamId)
      .attach('file', bytes, {
        filename: 'schedule.csv',
        contentType: 'text/csv',
      });

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.summary).toEqual({
      input: 1,
      created: 1,
      duplicate: 0,
      failed: 0,
    });
    expect(importCsv).toHaveBeenCalledOnce();
    expect(importCsv.mock.calls[0][1]).toBe(teamId);
    expect(importCsv.mock.calls[0][2]).toEqual(
      expect.objectContaining({
        id: userId,
        email: 'admin@example.test',
        accountKind: AccountKind.PERSON,
        displayName: 'Administrator, CSV',
        capabilities: expect.arrayContaining([Capability.ADMINISTRATION]),
      })
    );
    expect(Buffer.compare(importCsv.mock.calls[0][0], bytes)).toBe(0);
  });

  it('rejects missing, extra, and oversized files with stable safe errors', async () => {
    const missing = await request(app())
      .post('/api/matches/import-csv')
      .set('Cookie', token())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .field('teamId', teamId);
    expect(missing.status).toBe(400);
    expect(missing.body.code).toBe('MATCH_CSV_FILE_REQUIRED');

    const extra = await request(app())
      .post('/api/matches/import-csv')
      .set('Cookie', token())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .field('teamId', teamId)
      .attach('file', Buffer.from('one'), 'one.csv')
      .attach('file', Buffer.from('two'), 'two.csv');
    expect(extra.status).toBe(400);
    expect(extra.body.code).toBe('MATCH_CSV_INVALID_STRUCTURE');

    const oversized = await request(app())
      .post('/api/matches/import-csv')
      .set('Cookie', token())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .field('teamId', teamId)
      .attach('file', Buffer.alloc(MATCH_CSV_MAX_FILE_BYTES + 1), 'large.csv');
    expect(oversized.status).toBe(413);
    expect(oversized.body.code).toBe('MATCH_CSV_FILE_TOO_LARGE');
  });

  it('rejects invalid multipart fields before invoking the import owner', async () => {
    const importCsv = vi
      .spyOn(MatchCsvImportService, 'import')
      .mockRejectedValue(new Error('import owner must not be called'));
    const bytes = Buffer.from('canonical bytes');

    const missingTeam = await request(app())
      .post('/api/matches/import-csv')
      .set('Cookie', token())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .attach('file', bytes, 'schedule.csv');
    expect(missingTeam.status).toBe(400);
    expect(missingTeam.body.code).toBe('MATCH_CSV_INVALID_FIELDS');

    const malformedTeam = await request(app())
      .post('/api/matches/import-csv')
      .set('Cookie', token())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .field('teamId', 'not-an-object-id')
      .attach('file', bytes, 'schedule.csv');
    expect(malformedTeam.status).toBe(400);
    expect(malformedTeam.body.code).toBe('MATCH_CSV_INVALID_FIELDS');

    const unexpectedField = await request(app())
      .post('/api/matches/import-csv')
      .set('Cookie', token())
      .set('Origin', FIRST_PARTY_ORIGIN)
      .field('teamId', teamId)
      .field('columnMapping', 'unsupported')
      .attach('file', bytes, 'schedule.csv');
    expect(unexpectedField.status).toBe(400);
    expect(unexpectedField.body.code).toBe('MATCH_CSV_INVALID_FIELDS');

    expect(importCsv).not.toHaveBeenCalled();
  });
});
