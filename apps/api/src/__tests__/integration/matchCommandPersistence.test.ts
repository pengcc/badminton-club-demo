import { randomUUID } from 'node:crypto';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import {
  AuditEventType,
  EntityType,
  Gender,
  MatchAvailabilityParticipation,
  MatchDirection,
  MatchOutcome,
  MembershipStatus,
  LineupPosition,
  AccountKind,
  Capability,
  TeamLevel,
} from '@club/shared-types/core/enums';
import mongoose from 'mongoose';
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
import { AuditLog } from '../../models/AuditLog';
import { Match } from '../../models/Match';
import { Team } from '../../models/Team';
import { User } from '../../models/User';
import {
  MatchService,
  type MatchCommandActor,
} from '../../services/matchService';
import { MatchApiTransformer } from '../../transformers/match';
import {
  buildMatchScheduleDuplicateKey,
  withMatchScheduleDuplicateKey,
} from '../../services/matchScheduleDuplicateKey';
import { MatchCsvImportService } from '../../services/matchCsvImportService';
import { MATCH_CSV_HEADER } from '../../lib/matchScheduleCsv';
import { RequiredAuditPersistenceError } from '../../utils/errors';

let mongoLease: MongoTestDatabaseLease;

async function createContext() {
  const admin = await User.create({
    email: `${randomUUID()}@example.test`,
    firstName: 'Match',
    lastName: 'Administrator',
    password: 'ValidPassword1',
    gender: Gender.FEMALE,
    dateOfBirth: '1990-01-01',
    accountKind: AccountKind.PERSON,
    administratorDesignation: true,
    displayName: 'Administrator',
    capabilities: [Capability.ADMINISTRATION],
    membershipStatus: MembershipStatus.INACTIVE,
    isPlayer: false,
  });
  const team = await Team.create({
    teamId: randomUUID().slice(0, 8),
    shortName: 'C1 Team',
    leagueTeamName: 'C1 League Team',
    matchLevel: TeamLevel.A,
    createdById: admin._id,
  });
  const actor: MatchCommandActor = {
    id: admin._id.toString(),
    email: admin.email,
    accountKind: AccountKind.PERSON,
    displayName: 'Administrator',
    capabilities: [Capability.ADMINISTRATION],
    ipAddress: '127.0.0.1',
    userAgent: 'C1 persistence test',
  };
  return { admin, team, actor };
}

function requestFor(teamId: string, overrides: Record<string, unknown> = {}) {
  return {
    teamId,
    opponentName: 'Visitors',
    direction: MatchDirection.HOME,
    localDate: '2026-08-15',
    localTime: '19:30',
    location: 'C1 Hall',
    ...overrides,
  };
}

function scheduleCsv(...rows: string[]): Buffer {
  return Buffer.from([MATCH_CSV_HEADER.join(','), ...rows].join('\n'));
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('matchCommand');
  mongoLease.assertOwnedDatabase();
  await Promise.all([
    User.syncIndexes(),
    Team.syncIndexes(),
    Match.syncIndexes(),
    AuditLog.syncIndexes(),
  ]);
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await Promise.all([
    User.deleteMany({}),
    Team.deleteMany({}),
    Match.deleteMany({}),
    AuditLog.deleteMany({}),
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await mongoLease.release();
});

describe('C1 Match command persistence', () => {
  it('creates version zero and its required audit atomically', async () => {
    const { team, actor } = await createContext();
    const created = await MatchService.createMatch(
      requestFor(team._id.toString()),
      actor
    );

    expect(created).toMatchObject({
      version: 0,
      teamId: team._id.toString(),
      opponentName: 'Visitors',
      direction: MatchDirection.HOME,
    });
    expect(created.startAt.toISOString()).toBe('2026-08-15T17:30:00.000Z');
    expect(MatchApiTransformer.toApi(created)).not.toHaveProperty(
      'scheduleDuplicateKey'
    );
    const audits = await AuditLog.find({ entityId: created.id }).lean();
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      eventType: AuditEventType.MATCH_CREATED,
      actorId: new mongoose.Types.ObjectId(actor.id),
      source: 'human',
      changes: expect.arrayContaining([
        { field: 'teamId', newValue: team._id.toString() },
      ]),
    });
    expect(JSON.stringify(audits[0]?.changes)).not.toContain('version');
  });

  it('round-trips, versions, clears, and audit-redacts arrival guidance without changing schedule identity', async () => {
    const { team, actor } = await createContext();
    const firstGuidance = 'Use the rear entrance.\nParking is behind the hall.';
    const secondGuidance = 'Ring the side-door bell.';
    const created = await MatchService.createMatch(
      requestFor(team._id.toString(), { arrivalGuidance: firstGuidance }),
      actor
    );
    const persistedCreated = await Match.findById(created.id).lean();
    const scheduleDuplicateKey = persistedCreated?.scheduleDuplicateKey;

    expect(created.arrivalGuidance).toBe(firstGuidance);
    expect(MatchApiTransformer.toApi(created).arrivalGuidance).toBe(
      firstGuidance
    );
    const createAudit = await AuditLog.findOne({
      entityId: created.id,
      eventType: AuditEventType.MATCH_CREATED,
    }).lean();
    expect(createAudit?.changes).toEqual(
      expect.arrayContaining([{ field: 'arrivalGuidance' }])
    );
    expect(JSON.stringify(createAudit?.changes)).not.toContain(firstGuidance);

    const updated = await MatchService.updateMatch(
      created.id,
      {
        expectedVersion: 0,
        ...requestFor(team._id.toString(), {
          arrivalGuidance: secondGuidance,
        }),
      },
      actor
    );
    expect(updated).toMatchObject({
      version: 1,
      arrivalGuidance: secondGuidance,
    });
    expect((await Match.findById(created.id))?.scheduleDuplicateKey).toBe(
      scheduleDuplicateKey
    );
    const updateAudit = await AuditLog.findOne({
      entityId: created.id,
      eventType: AuditEventType.MATCH_UPDATED,
    }).lean();
    expect(updateAudit?.changes).toEqual([{ field: 'arrivalGuidance' }]);
    expect(JSON.stringify(updateAudit?.changes)).not.toContain(firstGuidance);
    expect(JSON.stringify(updateAudit?.changes)).not.toContain(secondGuidance);

    const unchanged = await MatchService.updateMatch(
      created.id,
      {
        expectedVersion: 1,
        ...requestFor(team._id.toString(), {
          arrivalGuidance: secondGuidance,
        }),
      },
      actor
    );
    expect(unchanged.version).toBe(1);
    expect(
      await AuditLog.countDocuments({
        entityId: created.id,
        eventType: AuditEventType.MATCH_UPDATED,
      })
    ).toBe(1);

    const cleared = await MatchService.updateMatch(
      created.id,
      {
        expectedVersion: 1,
        ...requestFor(team._id.toString()),
      },
      actor
    );
    expect(cleared.version).toBe(2);
    expect(cleared.arrivalGuidance).toBeUndefined();
    expect((await Match.findById(created.id))?.arrivalGuidance).toBeUndefined();

    const restored = await MatchService.updateMatch(
      created.id,
      {
        expectedVersion: 2,
        ...requestFor(team._id.toString(), {
          arrivalGuidance: firstGuidance,
        }),
      },
      actor
    );
    await MatchService.deleteMatch(
      created.id,
      { expectedVersion: restored.version },
      actor
    );
    const deleteAudit = await AuditLog.findOne({
      entityId: created.id,
      eventType: AuditEventType.MATCH_DELETED,
    }).lean();
    expect(deleteAudit?.changes).toEqual(
      expect.arrayContaining([{ field: 'arrivalGuidance' }])
    );
    expect(JSON.stringify(deleteAudit?.changes)).not.toContain(firstGuidance);
  });

  it('retries the Match transaction when required Audit fails transiently', async () => {
    const { team, actor } = await createContext();
    const transientFailure = new mongoose.mongo.MongoError(
      'sensitive transient database detail'
    );
    transientFailure.addErrorLabel('TransientTransactionError');
    const originalAuditCreate = AuditLog.create.bind(AuditLog);
    const auditCreate = vi
      .spyOn(AuditLog, 'create')
      .mockRejectedValueOnce(transientFailure)
      .mockImplementation(originalAuditCreate as never);

    const created = await MatchService.createMatch(
      requestFor(team._id.toString()),
      actor
    );

    expect(created.opponentName).toBe('Visitors');
    expect(auditCreate).toHaveBeenCalledTimes(2);
    expect(await Match.countDocuments({ _id: created.id })).toBe(1);
    expect(await AuditLog.countDocuments({ entityId: created.id })).toBe(1);
  });

  it.each([
    'homeScore',
    'awayScore',
  ] as const)('rejects a fractional persisted result %s', async (scoreField) => {
    const { admin, team } = await createContext();
    const result = { homeScore: 3, awayScore: 2 };
    result[scoreField] = 1.5;

    await expect(
      Match.create(
        withMatchScheduleDuplicateKey({
          teamId: team._id,
          opponentName: 'Fractional Visitors',
          direction: MatchDirection.HOME,
          startAt: new Date('2026-08-15T17:30:00.000Z'),
          location: 'C1 Hall',
          result,
          createdById: admin._id,
        })
      )
    ).rejects.toMatchObject({ name: 'ValidationError' });

    expect(await Match.countDocuments({})).toBe(0);
  });

  it('rejects a missing Team without creating Match or audit state', async () => {
    const { actor } = await createContext();

    await expect(
      MatchService.createMatch(
        requestFor(new mongoose.Types.ObjectId().toString()),
        actor
      )
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(await Match.countDocuments({})).toBe(0);
    expect(await AuditLog.countDocuments({ entityType: 'Match' })).toBe(0);
  });

  it('preserves embedded references and result while incrementing once', async () => {
    const { team, actor } = await createContext();
    const created = await MatchService.createMatch(
      requestFor(team._id.toString()),
      actor
    );
    const retainedId = new mongoose.Types.ObjectId();
    await Match.updateOne(
      { _id: created.id },
      {
        $set: {
          result: { homeScore: 5, awayScore: 3, note: 'retained' },
          lineup: [
            {
              position: LineupPosition.MEN_SINGLES_1,
              playerId: retainedId,
              playerNameSnapshot: 'Retained Player',
            },
          ],
          availability: [
            {
              playerId: retainedId,
              participation: MatchAvailabilityParticipation.UNAVAILABLE,
            },
          ],
        },
      },
      { timestamps: false }
    );

    const updated = await MatchService.updateMatch(
      created.id,
      {
        expectedVersion: 0,
        ...requestFor(team._id.toString(), {
          opponentName: 'Corrected Visitors',
          direction: MatchDirection.AWAY,
          location: 'Corrected Hall',
        }),
      },
      actor,
      new Date('2026-09-01T00:00:00.000Z')
    );

    expect(updated.version).toBe(1);
    expect(updated.result).toEqual({
      homeScore: 5,
      awayScore: 3,
      note: 'retained',
    });
    expect(updated.availability).toEqual([
      {
        playerId: retainedId.toString(),
        participation: MatchAvailabilityParticipation.UNAVAILABLE,
      },
    ]);
    const persisted = await Match.findById(created.id).lean();
    expect(persisted?.scheduleDuplicateKey).toBe(
      buildMatchScheduleDuplicateKey({
        teamId: team._id,
        opponentName: 'Corrected Visitors',
        direction: MatchDirection.AWAY,
        startAt: new Date('2026-08-15T17:30:00.000Z'),
        location: 'Corrected Hall',
      })
    );
    expect(
      persisted?.lineup.map((entry) => ({
        position: entry.position,
        playerId: entry.playerId.toString(),
        playerNameSnapshot: entry.playerNameSnapshot,
      }))
    ).toEqual([
      {
        position: LineupPosition.MEN_SINGLES_1,
        playerId: retainedId.toString(),
        playerNameSnapshot: 'Retained Player',
      },
    ]);
    const updateAudit = await AuditLog.findOne({
      entityId: created.id,
      eventType: AuditEventType.MATCH_UPDATED,
    }).lean();
    expect(updateAudit?.changes).toEqual([
      {
        field: 'opponentName',
        oldValue: 'Visitors',
        newValue: 'Corrected Visitors',
      },
      {
        field: 'direction',
        oldValue: MatchDirection.HOME,
        newValue: MatchDirection.AWAY,
      },
      {
        field: 'location',
        oldValue: 'C1 Hall',
        newValue: 'Corrected Hall',
      },
    ]);
  });

  it('keeps version, updatedAt, and audit unchanged for a semantic no-op', async () => {
    const { team, actor } = await createContext();
    const created = await MatchService.createMatch(
      requestFor(team._id.toString()),
      actor
    );
    const before = await Match.findById(created.id).lean();

    const unchanged = await MatchService.updateMatch(
      created.id,
      {
        expectedVersion: created.version,
        ...requestFor(team._id.toString()),
      },
      actor
    );

    expect(unchanged.version).toBe(0);
    expect(unchanged.updatedAt.toISOString()).toBe(
      before?.updatedAt.toISOString()
    );
    expect(await AuditLog.countDocuments({ entityId: created.id })).toBe(1);
  });

  it('rejects stale update and delete before Match or audit mutation', async () => {
    const { team, actor } = await createContext();
    const created = await MatchService.createMatch(
      requestFor(team._id.toString()),
      actor
    );

    await expect(
      MatchService.updateMatch(
        created.id,
        {
          expectedVersion: 99,
          ...requestFor(team._id.toString(), {
            opponentName: 'Stale change',
          }),
        },
        actor
      )
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      MatchService.deleteMatch(created.id, { expectedVersion: 99 }, actor)
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(await Match.findById(created.id)).not.toBeNull();
    expect(await AuditLog.countDocuments({ entityId: created.id })).toBe(1);
  });

  it('rejects moving a result-bearing Match into the future', async () => {
    const { team, actor } = await createContext();
    const created = await MatchService.createMatch(
      requestFor(team._id.toString(), { localDate: '2026-01-15' }),
      actor
    );
    await Match.updateOne(
      { _id: created.id },
      { $set: { result: { homeScore: 1, awayScore: 1 } } },
      { timestamps: false }
    );

    await expect(
      MatchService.updateMatch(
        created.id,
        {
          expectedVersion: 0,
          ...requestFor(team._id.toString(), { localDate: '2026-12-15' }),
        },
        actor,
        new Date('2026-07-28T00:00:00.000Z')
      )
    ).rejects.toMatchObject({ statusCode: 409 });
    expect((await Match.findById(created.id))?.__v).toBe(0);
    expect(await AuditLog.countDocuments({ entityId: created.id })).toBe(1);
  });

  it('deletes only the claimed version and commits its snapshot audit', async () => {
    const { team, actor } = await createContext();
    const created = await MatchService.createMatch(
      requestFor(team._id.toString()),
      actor
    );
    await MatchService.deleteMatch(
      created.id,
      { expectedVersion: created.version },
      actor
    );

    expect(await Match.findById(created.id)).toBeNull();
    expect(
      await AuditLog.findOne({
        entityId: created.id,
        eventType: AuditEventType.MATCH_DELETED,
      }).lean()
    ).toMatchObject({
      changes: expect.arrayContaining([
        { field: 'opponentName', oldValue: 'Visitors' },
      ]),
    });
  });

  it.each([
    'create',
    'update',
    'delete',
  ] as const)('rolls back %s when required audit fails', async (operation) => {
    const { team, actor } = await createContext();
    const created =
      operation === 'create'
        ? undefined
        : await MatchService.createMatch(
            requestFor(team._id.toString()),
            actor
          );
    const before = created
      ? await Match.findById(created.id).lean()
      : undefined;
    vi.spyOn(AuditLog, 'create').mockRejectedValueOnce(
      new Error('Injected audit failure')
    );

    const command =
      operation === 'create'
        ? MatchService.createMatch(requestFor(team._id.toString()), actor)
        : operation === 'update'
          ? MatchService.updateMatch(
              created!.id,
              {
                expectedVersion: created!.version,
                ...requestFor(team._id.toString(), {
                  opponentName: 'Must roll back',
                }),
              },
              actor
            )
          : MatchService.deleteMatch(
              created!.id,
              { expectedVersion: created!.version },
              actor
            );
    await expect(command).rejects.toBeInstanceOf(RequiredAuditPersistenceError);

    if (operation === 'create') {
      expect(await Match.countDocuments({})).toBe(0);
    } else {
      const after = await Match.findById(created!.id).lean();
      expect(after).not.toBeNull();
      expect(after?.__v).toBe(before?.__v);
      expect(after?.opponentName).toBe(before?.opponentName);
    }
  });

  it('allows exactly one same-version concurrent correction to win', async () => {
    const { team, actor } = await createContext();
    const created = await MatchService.createMatch(
      requestFor(team._id.toString()),
      actor
    );
    const results = await Promise.allSettled(
      ['Winner A', 'Winner B'].map((opponentName) =>
        MatchService.updateMatch(
          created.id,
          {
            expectedVersion: 0,
            ...requestFor(team._id.toString(), { opponentName }),
          },
          actor
        )
      )
    );

    expect(
      results.filter((result) => result.status === 'fulfilled')
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected')
    ).toHaveLength(1);
    expect((await Match.findById(created.id))?.__v).toBe(1);
    expect(
      await AuditLog.countDocuments({
        entityId: created.id,
        eventType: AuditEventType.MATCH_UPDATED,
      })
    ).toBe(1);
  });

  it('enforces the exact start boundary and records the first result', async () => {
    const { team, actor } = await createContext();
    const created = await MatchService.createMatch(
      requestFor(team._id.toString()),
      actor
    );
    await expect(
      MatchService.setResult(
        created.id,
        { expectedVersion: 0, homeScore: 0, awayScore: 0 },
        actor,
        new Date('2026-08-15T17:29:59.999Z')
      )
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await AuditLog.countDocuments({ entityId: created.id })).toBe(1);

    const recorded = await MatchService.setResult(
      created.id,
      { expectedVersion: 0, homeScore: 0, awayScore: 0 },
      actor,
      new Date('2026-08-15T17:30:00.000Z')
    );
    expect(recorded).toMatchObject({
      version: 1,
      result: { homeScore: 0, awayScore: 0 },
    });
    expect(MatchApiTransformer.toApi(recorded).result?.outcome).toBe(
      MatchOutcome.DRAW
    );
    const recordedAudit = await AuditLog.findOne({
      entityId: created.id,
      eventType: AuditEventType.MATCH_RESULT_RECORDED,
    }).lean();
    expect(recordedAudit?.changes).toEqual([
      {
        field: 'result',
        newValue: { homeScore: 0, awayScore: 0 },
      },
    ]);
  });

  it('corrects score or note, but an unchanged result is a no-op', async () => {
    const { team, actor } = await createContext();
    const created = await MatchService.createMatch(
      requestFor(team._id.toString(), {
        direction: MatchDirection.AWAY,
      }),
      actor
    );
    const recorded = await MatchService.setResult(
      created.id,
      { expectedVersion: 0, homeScore: 2, awayScore: 4 },
      actor,
      new Date('2026-08-16T00:00:00.000Z')
    );
    expect(MatchApiTransformer.toApi(recorded).result?.outcome).toBe(
      MatchOutcome.WIN
    );
    const corrected = await MatchService.setResult(
      created.id,
      {
        expectedVersion: 1,
        homeScore: 2,
        awayScore: 4,
        note: '  corrected note  ',
      },
      actor,
      new Date('2026-08-16T00:00:00.000Z')
    );
    expect(corrected).toMatchObject({
      version: 2,
      result: { homeScore: 2, awayScore: 4, note: 'corrected note' },
    });
    const beforeNoOp = await Match.findById(created.id).lean();
    const unchanged = await MatchService.setResult(
      created.id,
      {
        expectedVersion: 2,
        homeScore: 2,
        awayScore: 4,
        note: 'corrected note',
      },
      actor,
      new Date('2026-08-16T00:00:00.000Z')
    );
    expect(unchanged.version).toBe(2);
    expect(unchanged.updatedAt.toISOString()).toBe(
      beforeNoOp?.updatedAt.toISOString()
    );
    const correctionAudit = await AuditLog.findOne({
      entityId: created.id,
      eventType: AuditEventType.MATCH_RESULT_CORRECTED,
    }).lean();
    expect(correctionAudit?.changes).toEqual([
      {
        field: 'result',
        oldValue: { homeScore: 2, awayScore: 4 },
        newValue: {
          homeScore: 2,
          awayScore: 4,
          note: 'corrected note',
        },
      },
    ]);
    await expect(
      MatchService.setResult(
        created.id,
        { expectedVersion: 1, homeScore: 1, awayScore: 1 },
        actor,
        new Date('2026-08-16T00:00:00.000Z')
      )
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it.each([
    [MatchDirection.HOME, 4, 2, MatchOutcome.WIN],
    [MatchDirection.HOME, 2, 4, MatchOutcome.LOSS],
    [MatchDirection.AWAY, 4, 2, MatchOutcome.LOSS],
    [MatchDirection.AWAY, 2, 4, MatchOutcome.WIN],
    [MatchDirection.AWAY, 3, 3, MatchOutcome.DRAW],
  ])('derives %s %s-%s as the club %s outcome', async (direction, homeScore, awayScore, outcome) => {
    const { team, actor } = await createContext();
    const created = await MatchService.createMatch(
      requestFor(team._id.toString(), { direction }),
      actor
    );

    const recorded = await MatchService.setResult(
      created.id,
      { expectedVersion: 0, homeScore, awayScore },
      actor,
      new Date('2026-08-16T00:00:00.000Z')
    );

    expect(MatchApiTransformer.toApi(recorded).result?.outcome).toBe(outcome);
  });

  it('rolls back a result when its required audit fails', async () => {
    const { team, actor } = await createContext();
    const created = await MatchService.createMatch(
      requestFor(team._id.toString()),
      actor
    );
    vi.spyOn(AuditLog, 'create').mockRejectedValueOnce(
      new Error('Injected result audit failure')
    );

    await expect(
      MatchService.setResult(
        created.id,
        { expectedVersion: 0, homeScore: 5, awayScore: 3 },
        actor,
        new Date('2026-08-16T00:00:00.000Z')
      )
    ).rejects.toBeInstanceOf(RequiredAuditPersistenceError);
    expect(await Match.findById(created.id)).toMatchObject({
      __v: 0,
      result: undefined,
    });
  });

  it('allows exactly one same-version concurrent result correction', async () => {
    const { team, actor } = await createContext();
    const created = await MatchService.createMatch(
      requestFor(team._id.toString()),
      actor
    );
    await MatchService.setResult(
      created.id,
      { expectedVersion: 0, homeScore: 1, awayScore: 0 },
      actor,
      new Date('2026-08-16T00:00:00.000Z')
    );

    const outcomes = await Promise.allSettled(
      [2, 3].map((homeScore) =>
        MatchService.setResult(
          created.id,
          { expectedVersion: 1, homeScore, awayScore: 0 },
          actor,
          new Date('2026-08-16T00:00:00.000Z')
        )
      )
    );
    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled')
    ).toHaveLength(1);
    expect(
      outcomes.filter((outcome) => outcome.status === 'rejected')
    ).toHaveLength(1);
    expect((await Match.findById(created.id))?.__v).toBe(2);
    expect(
      await AuditLog.countDocuments({
        entityId: created.id,
        eventType: AuditEventType.MATCH_RESULT_CORRECTED,
      })
    ).toBe(1);
  });

  it('enforces normalized schedule uniqueness for manual create and atomic base update', async () => {
    const { team, actor } = await createContext();
    const first = await MatchService.createMatch(
      requestFor(team._id.toString()),
      actor
    );
    await expect(
      MatchService.createMatch(
        requestFor(team._id.toString(), {
          opponentName: '  visitors ',
          location: ' c1   hall ',
        }),
        actor
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'MATCH_SCHEDULE_DUPLICATE',
    });

    const second = await MatchService.createMatch(
      requestFor(team._id.toString(), {
        opponentName: 'Other Visitors',
        localDate: '2026-08-16',
        location: 'Other Hall',
      }),
      actor
    );
    const before = await Match.findById(second.id).lean();
    await expect(
      MatchService.updateMatch(
        second.id,
        {
          expectedVersion: second.version,
          ...requestFor(team._id.toString()),
        },
        actor
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'MATCH_SCHEDULE_DUPLICATE',
    });
    const after = await Match.findById(second.id).lean();
    expect(after).toMatchObject({
      __v: 0,
      opponentName: 'Other Visitors',
      location: 'Other Hall',
    });
    expect(after?.updatedAt.toISOString()).toBe(
      before?.updatedAt.toISOString()
    );
    expect(await AuditLog.countDocuments({ entityId: second.id })).toBe(1);
    expect(await Match.countDocuments({ _id: first.id })).toBe(1);
  });

  it('converges same-file, persisted, sequential, and concurrent CSV replay with one audit per creation', async () => {
    const { team, actor } = await createContext();
    const row = '15.08.2026,19:30,C1 Hall,C1 Address,C1 League Team,Visitors';
    const normalizedDuplicate =
      '15.08.2026,19:30, c1   hall , c1 address , c1 league team , visitors ';
    const first = await MatchCsvImportService.import(
      scheduleCsv(
        row,
        normalizedDuplicate,
        '31.02.2026,19:30,C1 Hall,C1 Address,C1 League Team,Visitors'
      ),
      team._id.toString(),
      actor
    );
    expect(first.summary).toEqual({
      input: 3,
      created: 1,
      duplicate: 1,
      failed: 1,
    });
    expect(first.outcomes.map((item) => item.code)).toEqual([
      'MATCH_CREATED',
      'DUPLICATE_IN_FILE',
      'INVALID_DATE',
    ]);
    const createdId = first.outcomes.find(
      (item) => item.outcome === 'created'
    )?.matchId;
    const beforeReplay = await Match.findById(createdId).lean();

    const replay = await MatchCsvImportService.import(
      scheduleCsv(row, normalizedDuplicate),
      team._id.toString(),
      actor
    );
    expect(replay.summary).toEqual({
      input: 2,
      created: 0,
      duplicate: 2,
      failed: 0,
    });
    expect(replay.outcomes.map((item) => item.code)).toEqual([
      'MATCH_ALREADY_EXISTS',
      'DUPLICATE_IN_FILE',
    ]);
    const afterReplay = await Match.findById(createdId).lean();
    expect(afterReplay).toMatchObject({ __v: 0 });
    expect(afterReplay?.arrivalGuidance).toBeUndefined();
    expect(afterReplay?.updatedAt.toISOString()).toBe(
      beforeReplay?.updatedAt.toISOString()
    );
    expect(await AuditLog.countDocuments({ entityId: createdId })).toBe(1);

    await Match.deleteMany({});
    await AuditLog.deleteMany({});
    const concurrent = await Promise.all([
      MatchCsvImportService.import(
        scheduleCsv(row),
        team._id.toString(),
        actor
      ),
      MatchCsvImportService.import(
        scheduleCsv(row),
        team._id.toString(),
        actor
      ),
    ]);
    expect(
      concurrent
        .flatMap((result) => result.outcomes)
        .map((item) => item.outcome)
    ).toEqual(expect.arrayContaining(['created', 'duplicate']));
    expect(await Match.countDocuments({})).toBe(1);
    expect(
      await AuditLog.countDocuments({
        eventType: AuditEventType.MATCH_CREATED,
      })
    ).toBe(1);
  });

  it('leaves all Match-owned state and existing audit history untouched when an equal Match is replayed', async () => {
    const { admin, team, actor } = await createContext();
    const retainedPlayerId = new mongoose.Types.ObjectId();
    const existing = await Match.create(
      withMatchScheduleDuplicateKey({
        teamId: team._id,
        opponentName: 'Visitors',
        direction: MatchDirection.HOME,
        startAt: new Date('2026-08-15T17:30:00.000Z'),
        location: 'C1 Hall\nC1 Address',
        result: {
          homeScore: 5,
          awayScore: 3,
          note: 'Retained result note',
        },
        availability: [
          {
            playerId: retainedPlayerId,
            participation: MatchAvailabilityParticipation.UNAVAILABLE,
          },
        ],
        lineup: [
          {
            position: LineupPosition.WOMEN_SINGLES,
            playerId: retainedPlayerId,
            playerNameSnapshot: 'Retained Player',
          },
        ],
        createdById: admin._id,
        __v: 7,
      })
    );
    await AuditLog.create([
      {
        eventType: AuditEventType.MATCH_CREATED,
        entityType: EntityType.MATCH,
        entityId: existing._id,
        actorId: admin._id,
        actorAccountKind: actor.accountKind,
        source: 'human',
        changes: [{ field: 'retained', newValue: 'create audit' }],
      },
      {
        eventType: AuditEventType.MATCH_RESULT_RECORDED,
        entityType: EntityType.MATCH,
        entityId: existing._id,
        actorId: admin._id,
        actorAccountKind: actor.accountKind,
        source: 'human',
        changes: [{ field: 'retained', newValue: 'result audit' }],
      },
    ]);

    const matchProjection = async () => {
      const stored = await Match.findById(existing._id).lean();
      if (!stored) throw new Error('Expected retained Match fixture');
      return {
        teamId: stored.teamId.toString(),
        opponentName: stored.opponentName,
        direction: stored.direction,
        startAt: stored.startAt.toISOString(),
        location: stored.location,
        result: stored.result,
        availability: stored.availability.map((entry) => ({
          playerId: entry.playerId.toString(),
          participation: entry.participation,
        })),
        lineup: stored.lineup.map((entry) => ({
          position: entry.position,
          playerId: entry.playerId.toString(),
          playerNameSnapshot: entry.playerNameSnapshot,
        })),
        createdById: stored.createdById.toString(),
        createdAt: stored.createdAt.toISOString(),
        updatedAt: stored.updatedAt.toISOString(),
        version: stored.__v,
      };
    };
    const auditProjection = async () =>
      (
        await AuditLog.find({ entityId: existing._id })
          .sort({ createdAt: 1, _id: 1 })
          .lean()
      ).map((audit) => ({
        id: audit._id.toString(),
        eventType: audit.eventType,
        source: audit.source,
        changes: audit.changes,
        createdAt: audit.createdAt.toISOString(),
      }));
    const beforeMatch = await matchProjection();
    const beforeAudits = await auditProjection();

    const replay = await MatchCsvImportService.import(
      scheduleCsv(
        '15.08.2026,19:30,C1 Hall,C1 Address,C1 League Team,Visitors'
      ),
      team._id.toString(),
      actor
    );

    expect(replay.summary).toEqual({
      input: 1,
      created: 0,
      duplicate: 1,
      failed: 0,
    });
    expect(replay.outcomes).toEqual([
      expect.objectContaining({
        rowNumber: 2,
        outcome: 'duplicate',
        code: 'MATCH_ALREADY_EXISTS',
        matchId: existing.id,
      }),
    ]);
    expect(await matchProjection()).toEqual(beforeMatch);
    expect(await auditProjection()).toEqual(beforeAudits);
  });

  it('aborts an import after an unexpected audit failure while preserving earlier row commits for replay', async () => {
    const { team, actor } = await createContext();
    const originalAuditCreate = AuditLog.create.bind(AuditLog);
    vi.spyOn(AuditLog, 'create')
      .mockImplementationOnce(originalAuditCreate as never)
      .mockRejectedValueOnce(new Error('Injected second-row audit failure'));
    const rows = scheduleCsv(
      '15.08.2026,19:30,C1 Hall,C1 Address,C1 League Team,Visitors A',
      '16.08.2026,19:30,C1 Hall,C1 Address,C1 League Team,Visitors B'
    );

    await expect(
      MatchCsvImportService.import(rows, team._id.toString(), actor)
    ).rejects.toBeInstanceOf(RequiredAuditPersistenceError);
    expect(await Match.countDocuments({})).toBe(1);
    expect(await AuditLog.countDocuments({})).toBe(1);

    vi.restoreAllMocks();
    const replay = await MatchCsvImportService.import(
      rows,
      team._id.toString(),
      actor
    );
    expect(replay.summary).toEqual({
      input: 2,
      created: 1,
      duplicate: 1,
      failed: 0,
    });
    expect(await Match.countDocuments({})).toBe(2);
    expect(await AuditLog.countDocuments({})).toBe(2);
  });
});
