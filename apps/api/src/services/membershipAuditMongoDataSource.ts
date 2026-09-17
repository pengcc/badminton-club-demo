import type {
  AuditMatchRecord,
  AuditPlayerRecord,
  AuditTeamRecord,
  AuditUserRecord,
} from './membershipConsistencyAudit';
import {
  MembershipAuditError,
  type AuditCollectionAvailability,
  type AuditReadResult,
  type MembershipAuditDataSource,
} from './runMembershipConsistencyAudit';

interface MongoCursorLike {
  toArray(): Promise<Record<string, unknown>[]>;
}

interface MongoCollectionLike {
  countDocuments(): Promise<number>;
  find(
    filter: Record<string, never>,
    options: { projection: Record<string, number> }
  ): MongoCursorLike;
}

export interface MembershipAuditDatabase {
  databaseName: string;
  listCollections(
    filter: Record<string, never>,
    options: { nameOnly: true }
  ): { toArray(): Promise<Array<{ name: string }>> };
  collection(name: string): MongoCollectionLike;
}

const requiredCollections = ['users', 'players', 'teams', 'matches'] as const;

function normalizeId(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value);
  return normalized && normalized !== '[object Object]'
    ? normalized
    : undefined;
}

function normalizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const normalized = normalizeId(item);
    return normalized ? [normalized] : [];
  });
}

function normalizeLineupIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const normalized = normalizeId((entry as Record<string, unknown>).playerId);
    return normalized ? [normalized] : [];
  });
}

function normalizeAvailabilityIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const normalized = normalizeId((entry as Record<string, unknown>).playerId);
    return normalized ? [normalized] : [];
  });
}

function requireId(
  document: Record<string, unknown>,
  collection: string
): string {
  const id = normalizeId(document._id);
  if (!id) {
    throw new MembershipAuditError(
      'READ_FAILED',
      `The ${collection} collection contains a record without a readable identifier; no report was produced.`
    );
  }
  return id;
}

function toUser(document: Record<string, unknown>): AuditUserRecord {
  return {
    id: requireId(document, 'users'),
    accountKind:
      typeof document.accountKind === 'string'
        ? document.accountKind
        : undefined,
    isPlayer: document.isPlayer === true,
    membershipStatus:
      typeof document.membershipStatus === 'string'
        ? document.membershipStatus
        : undefined,
  };
}

function toPlayer(document: Record<string, unknown>): AuditPlayerRecord {
  return {
    id: requireId(document, 'players'),
    userId: normalizeId(document.userId),
    type: typeof document.type === 'string' ? document.type : undefined,
    isActivePlayer: document.isActivePlayer === true,
    teamIds: normalizeIds(document.teamIds),
  };
}

function toTeam(document: Record<string, unknown>): AuditTeamRecord {
  return {
    id: requireId(document, 'teams'),
    legacyPlayerIds: normalizeIds(document.playerIds),
  };
}

function toMatch(document: Record<string, unknown>): AuditMatchRecord {
  const startAt =
    document.startAt instanceof Date
      ? document.startAt.toISOString()
      : typeof document.startAt === 'string'
        ? document.startAt
        : undefined;
  return {
    id: requireId(document, 'matches'),
    startAt,
    lineupPlayerIds: normalizeLineupIds(document.lineup),
    availabilityPlayerIds: normalizeAvailabilityIds(document.availability),
  };
}

export class MongoMembershipAuditDataSource
  implements MembershipAuditDataSource
{
  constructor(private readonly database: MembershipAuditDatabase) {}

  async read(): Promise<AuditReadResult> {
    const collectionList = await this.database
      .listCollections({}, { nameOnly: true })
      .toArray();
    const availableNames = new Set(
      collectionList.map((collection) => collection.name)
    );
    const missingRequired = requiredCollections.filter(
      (name) => !availableNames.has(name)
    );

    if (missingRequired.length > 0) {
      throw new MembershipAuditError(
        'READ_FAILED',
        `Required audit collections are unavailable: ${missingRequired.join(', ')}; no report was produced.`
      );
    }

    const collectionNames = [...requiredCollections];
    const collectionCounts = await Promise.all(
      collectionNames.map(
        async (name) =>
          [
            name,
            availableNames.has(name)
              ? await this.database.collection(name).countDocuments()
              : null,
          ] as const
      )
    );
    const counts = Object.fromEntries(collectionCounts) as Record<
      string,
      number | null
    >;

    if (requiredCollections.every((name) => counts[name] === 0)) {
      throw new MembershipAuditError(
        'READ_FAILED',
        'All required audit collections are empty; refusing to report an obviously empty database as healthy.'
      );
    }

    const collections = Object.fromEntries(
      collectionNames.map((name) => [
        name,
        {
          required: requiredCollections.includes(
            name as (typeof requiredCollections)[number]
          ),
          available: availableNames.has(name),
          count: counts[name] ?? null,
          source: 'collection',
        } satisfies AuditCollectionAvailability,
      ])
    );

    const [users, players, teams, matches] = await Promise.all([
      this.database
        .collection('users')
        .find(
          {},
          {
            projection: {
              _id: 1,
              accountKind: 1,
              isPlayer: 1,
              membershipStatus: 1,
            },
          }
        )
        .toArray(),
      this.database
        .collection('players')
        .find(
          {},
          {
            projection: {
              _id: 1,
              userId: 1,
              type: 1,
              isActivePlayer: 1,
              teamIds: 1,
            },
          }
        )
        .toArray(),
      this.database
        .collection('teams')
        .find(
          {},
          {
            projection: { _id: 1, playerIds: 1 },
          }
        )
        .toArray(),
      this.database
        .collection('matches')
        .find(
          {},
          {
            projection: {
              _id: 1,
              startAt: 1,
              lineup: 1,
              availability: 1,
            },
          }
        )
        .toArray(),
    ]);

    return {
      databaseName: this.database.databaseName,
      collections,
      snapshot: {
        users: users.map(toUser),
        players: players.map(toPlayer),
        teams: teams.map(toTeam),
        matches: matches.map(toMatch),
      },
    };
  }
}
