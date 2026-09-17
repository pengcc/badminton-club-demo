import { describe, expect, it, vi } from 'vitest';
import {
  MongoMembershipAuditDataSource,
  type MembershipAuditDatabase,
} from '../../services/membershipAuditMongoDataSource';
import {
  membershipAuditExitCode,
  parseMembershipAuditArguments,
} from '../../scripts/auditMembershipConsistency';
import type { MembershipConsistencyAuditReport } from '../../services/runMembershipConsistencyAudit';

function createDatabase(options?: {
  missing?: string[];
  empty?: boolean;
  interruptedCollection?: string;
}) {
  const documents: Record<string, Record<string, unknown>[]> = {
    users: [
      {
        _id: 'user-1',
        accountKind: 'person',
        isPlayer: false,
        membershipStatus: 'active',
      },
    ],
    players: [
      {
        _id: 'player-1',
        userId: 'user-1',
        type: 'external',
        isActivePlayer: true,
        teamIds: [],
      },
    ],
    teams: [{ _id: 'team-1' }],
    matches: [
      {
        _id: 'match-1',
        startAt: new Date('2099-01-01T00:00:00.000Z'),
        lineup: [
          {
            position: 'men_singles_1',
            playerId: 'player-1',
            playerNameSnapshot: 'Retained Player',
          },
        ],
        availability: [
          {
            playerId: 'player-1',
            participation: 'unavailable',
          },
        ],
      },
    ],
  };
  const writeMethods = {
    insertOne: vi.fn(),
    updateOne: vi.fn(),
    updateMany: vi.fn(),
    deleteOne: vi.fn(),
    deleteMany: vi.fn(),
  };
  const collection = vi.fn((name: string) => ({
    countDocuments: vi.fn(async () =>
      options?.empty ? 0 : (documents[name]?.length ?? 0)
    ),
    find: vi.fn(() => ({
      toArray: async () => {
        if (options?.interruptedCollection === name) {
          throw new Error('interrupted');
        }
        return options?.empty ? [] : (documents[name] ?? []);
      },
    })),
    ...writeMethods,
  }));
  const available = Object.keys(documents).filter(
    (name) => !options?.missing?.includes(name)
  );
  const database = {
    databaseName: 'safe-database-name',
    listCollections: vi.fn(() => ({
      toArray: async () => available.map((name) => ({ name })),
    })),
    collection,
  } as unknown as MembershipAuditDatabase;

  return { database, collection, writeMethods };
}

describe('MongoMembershipAuditDataSource', () => {
  it('uses projected reads and canonical embedded Lineup entries only', async () => {
    const { database, collection, writeMethods } = createDatabase();
    const result = await new MongoMembershipAuditDataSource(database).read();

    expect(result.databaseName).toBe('safe-database-name');
    expect(result.collections).not.toHaveProperty('lineups');
    expect(result.snapshot.matches[0]).toEqual(
      expect.objectContaining({
        lineupPlayerIds: ['player-1'],
        availabilityPlayerIds: ['player-1'],
      })
    );
    expect(result.snapshot.players[0]?.type).toBe('external');
    expect(result.snapshot.users[0]?.accountKind).toBe('person');
    expect(collection).toHaveBeenCalledWith('users');
    for (const writeMethod of Object.values(writeMethods)) {
      expect(writeMethod).not.toHaveBeenCalled();
    }
  });

  it('fails clearly when a required collection is unavailable', async () => {
    const { database } = createDatabase({ missing: ['matches'] });

    await expect(
      new MongoMembershipAuditDataSource(database).read()
    ).rejects.toMatchObject({
      code: 'READ_FAILED',
      message: expect.stringContaining('matches'),
    });
  });

  it('refuses to treat an obviously empty database as zero findings', async () => {
    const { database } = createDatabase({ empty: true });

    await expect(
      new MongoMembershipAuditDataSource(database).read()
    ).rejects.toMatchObject({
      code: 'READ_FAILED',
      message: expect.stringContaining('obviously empty database'),
    });
  });

  it('propagates an interrupted collection read without returning a partial snapshot', async () => {
    const { database } = createDatabase({ interruptedCollection: 'players' });

    await expect(
      new MongoMembershipAuditDataSource(database).read()
    ).rejects.toThrow('interrupted');
  });
});

describe('--fail-on-invariant', () => {
  function reportWithFindings(
    findings: Array<{
      classification:
        | 'deterministic candidate'
        | 'ambiguous review'
        | 'referential-risk case';
      count: number;
    }>
  ): MembershipConsistencyAuditReport {
    return {
      aggregateCounts: {
        findings: findings.reduce((total, finding) => total + finding.count, 0),
      },
      categories: findings.map((finding, index) => ({
        reasonCode: `TEST_REASON_${index}`,
        caseKeys: Array.from(
          { length: finding.count },
          (_, caseIndex) => `case-${index}-${caseIndex}`
        ),
        ...finding,
      })),
    } as unknown as MembershipConsistencyAuditReport;
  }

  it('returns zero for an ambiguous-only report', () => {
    const report = reportWithFindings([
      { classification: 'ambiguous review', count: 2 },
    ]);

    expect(membershipAuditExitCode(report, true)).toBe(0);
  });

  it('returns two for a deterministic finding', () => {
    const report = reportWithFindings([
      { classification: 'deterministic candidate', count: 1 },
    ]);

    expect(membershipAuditExitCode(report, true)).toBe(2);
  });

  it('returns two for a referential-risk finding', () => {
    const report = reportWithFindings([
      { classification: 'referential-risk case', count: 1 },
    ]);

    expect(membershipAuditExitCode(report, true)).toBe(2);
  });

  it('returns two for mixed findings', () => {
    const report = reportWithFindings([
      { classification: 'ambiguous review', count: 3 },
      { classification: 'referential-risk case', count: 1 },
    ]);

    expect(membershipAuditExitCode(report, true)).toBe(2);
  });

  it('returns zero with the flag disabled and does not mutate the report', () => {
    const report = reportWithFindings([
      { classification: 'deterministic candidate', count: 1 },
      { classification: 'ambiguous review', count: 1 },
    ]);
    const before = structuredClone(report);

    expect(membershipAuditExitCode(report, false)).toBe(0);
    expect(report).toEqual(before);
    expect(membershipAuditExitCode(report, true)).toBe(2);
    expect(report).toEqual(before);
  });

  it('accepts the pnpm argument separator', () => {
    expect(
      parseMembershipAuditArguments(['--', '--fail-on-invariant'])
    ).toEqual({
      failOnInvariant: true,
    });
  });
});
