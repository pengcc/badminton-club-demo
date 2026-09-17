import { randomUUID } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import {
  createAuthSessionCookie,
  FIRST_PARTY_ORIGIN,
} from '../helpers/authSession';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import {
  Gender,
  LineupPosition,
  LineupViolationCode,
  MatchAvailabilityParticipation,
  MatchDirection,
  MembershipStatus,
  PlayerType,
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
import { errorHandler } from '../../middleware/errorHandler';
import { AuditLog } from '../../models/AuditLog';
import { AuthSession } from '../../models/AuthSession';
import { Match } from '../../models/Match';
import { Player } from '../../models/Player';
import { Team } from '../../models/Team';
import { User } from '../../models/User';
import matchRoutes from '../../routes/matches';
import { MatchAvailabilityService } from '../../services/matchAvailabilityService';
import { MatchLineupService } from '../../services/matchLineupService';
import { MatchService } from '../../services/matchService';
import { withMatchScheduleDuplicateKey } from '../../services/matchScheduleDuplicateKey';
import * as membershipEligibilityService from '../../services/membershipEligibilityService';

let mongoLease: MongoTestDatabaseLease;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/matches', matchRoutes);
  app.use(errorHandler);
  return app;
}

async function createUser(input: {
  administratorDesignation?: boolean;
  status?: MembershipStatus;
  gender?: Gender;
  isPlayer?: boolean;
  firstName?: string;
  lastName?: string;
}) {
  return User.create({
    email: `${randomUUID()}@example.test`,
    firstName: input.firstName ?? 'Lineup',
    lastName: input.lastName ?? 'Player',
    password: 'ValidPassword1',
    gender: input.gender ?? Gender.MALE,
    dateOfBirth: '1990-01-01',
    accountKind: AccountKind.PERSON,
    administratorDesignation: input.administratorDesignation ?? false,
    membershipStatus: input.status ?? MembershipStatus.ACTIVE,
    isPlayer: input.isPlayer ?? true,
  });
}

async function createPlayer(
  userId: mongoose.Types.ObjectId,
  teamIds: mongoose.Types.ObjectId[],
  rankings = { singlesRanking: 1, doublesRanking: 1 }
) {
  return Player.create({
    userId,
    type: PlayerType.MEMBER,
    ...rankings,
    preferredPositions: [],
    isActivePlayer: true,
    teamIds,
  });
}

async function createEligiblePlayer(
  teamId: mongoose.Types.ObjectId,
  gender: Gender,
  name: string,
  ranking: number
) {
  const user = await createUser({
    gender,
    firstName: name,
    lastName: 'Tester',
  });
  const player = await createPlayer(user._id, [teamId], {
    singlesRanking: ranking,
    doublesRanking: ranking + 100,
  });
  return { player, user };
}

async function createContext() {
  const admin = await createUser({
    administratorDesignation: true,
    status: MembershipStatus.ACTIVE,
    isPlayer: false,
    firstName: 'Lineup',
    lastName: 'Administrator',
  });
  const team = await Team.create({
    teamId: randomUUID().slice(0, 8),
    shortName: 'C4 Team',
    leagueTeamName: 'C4 League Team',
    matchLevel: TeamLevel.D,
    createdById: admin._id,
  });
  const match = await Match.create(
    withMatchScheduleDuplicateKey({
      teamId: team._id,
      opponentName: 'Visitors',
      direction: MatchDirection.HOME,
      startAt: new Date('2099-08-01T10:00:00.000Z'),
      location: 'C4 Hall',
      lineup: [],
      availability: [],
      createdById: admin._id,
    })
  );
  return { admin, match, team };
}

function tokenFor(userId: mongoose.Types.ObjectId): Promise<string> {
  return createAuthSessionCookie(userId.toString());
}

function canonicalLineup(
  document: {
    lineup: Array<{
      position: LineupPosition;
      playerId: mongoose.Types.ObjectId;
      playerNameSnapshot: string;
    }>;
  } | null
): Array<{
  position: LineupPosition;
  playerId: string;
  playerNameSnapshot: string;
}> {
  return (
    document?.lineup.map((entry) => ({
      position: entry.position,
      playerId: entry.playerId.toString(),
      playerNameSnapshot: entry.playerNameSnapshot,
    })) ?? []
  );
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function pauseNextLineupPlayerClaim() {
  const claimReached = deferred();
  const releaseClaim = deferred();
  const realClaim = membershipEligibilityService.claimPlayerEligibleForMatch;
  vi.spyOn(
    membershipEligibilityService,
    'claimPlayerEligibleForMatch'
  ).mockImplementationOnce(async (...args) => {
    await realClaim(...args);
    claimReached.resolve();
    await releaseClaim.promise;
  });
  return {
    claimReached: claimReached.promise,
    releaseClaim: releaseClaim.resolve,
  };
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('matchLineup');
  mongoLease.assertOwnedDatabase();
  await Promise.all([
    User.syncIndexes(),
    Player.syncIndexes(),
    Team.syncIndexes(),
    Match.syncIndexes(),
    AuditLog.syncIndexes(),
    AuthSession.syncIndexes(),
  ]);
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await Promise.all([
    User.deleteMany({}),
    Player.deleteMany({}),
    Team.deleteMany({}),
    Match.deleteMany({}),
    AuditLog.deleteMany({}),
    AuthSession.deleteMany({}),
  ]);
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await mongoLease.release();
});

describe('C4 canonical Match Lineup persistence', () => {
  it('saves empty, partial, and complete canonical lineups with captured snapshots', async () => {
    const { match, team } = await createContext();
    const genders = [
      Gender.MALE,
      Gender.MALE,
      Gender.NON_BINARY,
      Gender.FEMALE,
      Gender.MALE,
      Gender.MALE,
      Gender.NON_BINARY,
      Gender.MALE,
      Gender.FEMALE,
      Gender.FEMALE,
      Gender.MALE,
      Gender.FEMALE,
    ];
    const players = await Promise.all(
      genders.map((gender, index) =>
        createEligiblePlayer(team._id, gender, `Player${index}`, index + 1)
      )
    );
    const complete = [
      [LineupPosition.MEN_SINGLES_1, 0],
      [LineupPosition.MEN_SINGLES_2, 1],
      [LineupPosition.OPEN_SINGLES, 2],
      [LineupPosition.WOMEN_SINGLES, 3],
      [LineupPosition.MENS_DOUBLES, 4],
      [LineupPosition.MENS_DOUBLES, 5],
      [LineupPosition.OPEN_DOUBLES, 6],
      [LineupPosition.OPEN_DOUBLES, 7],
      [LineupPosition.WOMEN_DOUBLES, 8],
      [LineupPosition.WOMEN_DOUBLES, 9],
      [LineupPosition.MIXED_DOUBLES, 10],
      [LineupPosition.MIXED_DOUBLES, 11],
    ].map(([position, index]) => ({
      position: position as LineupPosition,
      playerId: players[index as number].player._id.toString(),
    }));

    const empty = await MatchLineupService.setLineup(match._id.toString(), {
      expectedVersion: 0,
      lineup: [],
    });
    expect(empty.match.version).toBe(0);

    const partial = await MatchLineupService.setLineup(match._id.toString(), {
      expectedVersion: 0,
      lineup: [complete[0]],
    });
    expect(partial.match.version).toBe(1);
    expect(partial.match.lineup[0]).toMatchObject({
      position: LineupPosition.MEN_SINGLES_1,
      playerNameSnapshot: 'Player0 Tester',
    });

    const result = await MatchLineupService.setLineup(match._id.toString(), {
      expectedVersion: 1,
      lineup: complete.reverse(),
    });
    expect(result.match.version).toBe(2);
    expect(result.match.lineup).toHaveLength(12);
    expect(
      canonicalLineup(await Match.findById(match._id)).map(
        (entry) => entry.position
      )
    ).toEqual([
      LineupPosition.MEN_SINGLES_1,
      LineupPosition.MEN_SINGLES_2,
      LineupPosition.OPEN_SINGLES,
      LineupPosition.WOMEN_SINGLES,
      LineupPosition.MENS_DOUBLES,
      LineupPosition.MENS_DOUBLES,
      LineupPosition.OPEN_DOUBLES,
      LineupPosition.OPEN_DOUBLES,
      LineupPosition.WOMEN_DOUBLES,
      LineupPosition.WOMEN_DOUBLES,
      LineupPosition.MIXED_DOUBLES,
      LineupPosition.MIXED_DOUBLES,
    ]);
  }, 10_000);

  it('uses C3 effective Availability and validates every new or moved assignment', async () => {
    const { match, team } = await createContext();
    const female = await createEligiblePlayer(
      team._id,
      Gender.FEMALE,
      'Female',
      1
    );
    const male = await createEligiblePlayer(team._id, Gender.MALE, 'Male', 2);

    const missingAvailability = await MatchLineupService.setLineup(
      match._id.toString(),
      {
        expectedVersion: 0,
        lineup: [
          {
            position: LineupPosition.OPEN_SINGLES,
            playerId: female.player._id.toString(),
          },
        ],
      }
    );
    expect(missingAvailability.match.lineup).toHaveLength(1);

    await Match.updateOne(
      { _id: match._id },
      {
        $set: {
          availability: [
            {
              playerId: male.player._id,
              participation: MatchAvailabilityParticipation.UNAVAILABLE,
            },
          ],
        },
      },
      { timestamps: false }
    );
    await expect(
      MatchLineupService.setLineup(match._id.toString(), {
        expectedVersion: 1,
        lineup: [
          ...missingAvailability.match.lineup.map(({ position, playerId }) => ({
            position,
            playerId,
          })),
          {
            position: LineupPosition.MENS_DOUBLES,
            playerId: male.player._id.toString(),
          },
        ],
      })
    ).rejects.toMatchObject({
      code: 'LINEUP_VALIDATION_FAILED',
      details: {
        violations: [
          expect.objectContaining({
            code: LineupViolationCode.PLAYER_UNAVAILABLE,
          }),
        ],
      },
    });

    await expect(
      MatchLineupService.setLineup(match._id.toString(), {
        expectedVersion: 1,
        lineup: [
          {
            position: LineupPosition.MEN_SINGLES_1,
            playerId: female.player._id.toString(),
          },
        ],
      })
    ).rejects.toMatchObject({ code: 'LINEUP_VALIDATION_FAILED' });

    const stored = missingAvailability.match.lineup.map(
      ({ position, playerId }) => ({ position, playerId })
    );
    await expect(
      MatchLineupService.setLineup(match._id.toString(), {
        expectedVersion: 1,
        lineup: [...stored, stored[0]],
      })
    ).rejects.toMatchObject({
      details: {
        violations: [
          expect.objectContaining({
            code: LineupViolationCode.DUPLICATE_POSITION_ASSIGNMENT,
          }),
        ],
      },
    });
  });

  it('preserves retained snapshots and warnings while allowing removal and unrelated valid edits', async () => {
    const { match, team } = await createContext();
    const retained = await createEligiblePlayer(
      team._id,
      Gender.FEMALE,
      'Original',
      1
    );
    const replacement = await createEligiblePlayer(
      team._id,
      Gender.MALE,
      'Replacement',
      2
    );
    await MatchLineupService.setLineup(match._id.toString(), {
      expectedVersion: 0,
      lineup: [
        {
          position: LineupPosition.WOMEN_SINGLES,
          playerId: retained.player._id.toString(),
        },
      ],
    });

    await User.updateOne(
      { _id: retained.user._id },
      { $set: { firstName: 'Renamed' } }
    );
    await Player.updateOne(
      { _id: retained.player._id },
      { $set: { isActivePlayer: false, teamIds: [] } }
    );
    await Match.updateOne(
      { _id: match._id },
      {
        $set: {
          availability: [
            {
              playerId: retained.player._id,
              participation: MatchAvailabilityParticipation.UNAVAILABLE,
            },
          ],
        },
      },
      { timestamps: false }
    );

    const context = await MatchLineupService.getContext(match._id.toString());
    expect(context.lineup[0].playerNameSnapshot).toBe('Original Tester');
    expect(context.lineupWarnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        LineupViolationCode.PLAYER_NOT_CURRENTLY_ELIGIBLE,
        LineupViolationCode.PLAYER_NOT_ON_MATCH_TEAM,
        LineupViolationCode.PLAYER_UNAVAILABLE,
      ])
    );
    const retainedVersion = (await Player.findById(retained.player._id))!.__v;

    const corrected = await MatchLineupService.setLineup(match._id.toString(), {
      expectedVersion: 1,
      lineup: [
        {
          position: LineupPosition.WOMEN_SINGLES,
          playerId: retained.player._id.toString(),
        },
        {
          position: LineupPosition.MENS_DOUBLES,
          playerId: replacement.player._id.toString(),
        },
      ],
    });
    expect(corrected.match.lineup[0].playerNameSnapshot).toBe(
      'Original Tester'
    );
    expect((await Player.findById(retained.player._id))!.__v).toBe(
      retainedVersion
    );

    const removed = await MatchLineupService.setLineup(match._id.toString(), {
      expectedVersion: 2,
      lineup: [
        {
          position: LineupPosition.MENS_DOUBLES,
          playerId: replacement.player._id.toString(),
        },
      ],
    });
    expect(removed.match.lineup).toHaveLength(1);
    expect(removed.warnings).toEqual([]);
  });

  it('shares Match version concurrency, claims each distinct new Player once, writes no audit, and rolls back failed claims', async () => {
    const { match, team } = await createContext();
    const first = await createEligiblePlayer(team._id, Gender.MALE, 'First', 1);
    const second = await createEligiblePlayer(
      team._id,
      Gender.MALE,
      'Second',
      2
    );
    const firstVersion = first.player.__v;
    const twoEvents = [
      {
        position: LineupPosition.MEN_SINGLES_1,
        playerId: first.player._id.toString(),
      },
      {
        position: LineupPosition.MENS_DOUBLES,
        playerId: first.player._id.toString(),
      },
    ];
    const changed = await MatchLineupService.setLineup(match._id.toString(), {
      expectedVersion: 0,
      lineup: twoEvents,
    });
    expect(changed.match.version).toBe(1);
    expect((await Player.findById(first.player._id))!.__v).toBe(
      firstVersion + 1
    );

    const matchBeforeNoOp = await Match.findById(match._id);
    const noOp = await MatchLineupService.setLineup(match._id.toString(), {
      expectedVersion: 1,
      lineup: [...twoEvents].reverse(),
    });
    expect(noOp.match.version).toBe(1);
    expect((await Match.findById(match._id))!.updatedAt).toEqual(
      matchBeforeNoOp!.updatedAt
    );
    await expect(
      MatchLineupService.setLineup(match._id.toString(), {
        expectedVersion: 0,
        lineup: twoEvents,
      })
    ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
    expect(await AuditLog.countDocuments({ entityId: match._id })).toBe(0);

    const secondVersion = second.player.__v;
    vi.spyOn(Match, 'updateOne').mockResolvedValueOnce({
      acknowledged: true,
      matchedCount: 0,
      modifiedCount: 0,
      upsertedCount: 0,
      upsertedId: null,
    } as never);
    await expect(
      MatchLineupService.setLineup(match._id.toString(), {
        expectedVersion: 1,
        lineup: [
          ...twoEvents,
          {
            position: LineupPosition.OPEN_DOUBLES,
            playerId: second.player._id.toString(),
          },
        ],
      })
    ).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
    expect((await Player.findById(second.player._id))!.__v).toBe(secondVersion);
    expect((await Match.findById(match._id))!.__v).toBe(1);
  });

  it('rolls back a Lineup Player claim when a same-version C3 Availability write wins', async () => {
    const { match, team } = await createContext();
    const candidate = await createEligiblePlayer(
      team._id,
      Gender.MALE,
      'AvailabilityRace',
      1
    );
    // Correct an existing dependency: a new Availability entry would also
    // claim this Player and wait on the deliberately paused Lineup transaction.
    await Match.updateOne(
      { _id: match._id },
      {
        $set: {
          availability: [
            {
              playerId: candidate.player._id,
              participation: MatchAvailabilityParticipation.AVAILABLE,
            },
          ],
        },
      }
    );
    const playerVersion = candidate.player.__v;
    const pause = pauseNextLineupPlayerClaim();
    const lineupAttempt = MatchLineupService.setLineup(match._id.toString(), {
      expectedVersion: 0,
      lineup: [
        {
          position: LineupPosition.MEN_SINGLES_1,
          playerId: candidate.player._id.toString(),
        },
      ],
    });
    const rejectedLineup = expect(lineupAttempt).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });

    await pause.claimReached;
    try {
      const availability = await MatchAvailabilityService.setPlayerAvailability(
        match._id.toString(),
        candidate.player._id.toString(),
        {
          expectedVersion: 0,
          participation: MatchAvailabilityParticipation.UNAVAILABLE,
        }
      );
      expect(availability.version).toBe(1);
    } finally {
      pause.releaseClaim();
    }
    await rejectedLineup;

    const storedMatch = await Match.findById(match._id);
    expect(storedMatch?.__v).toBe(1);
    expect(storedMatch?.lineup).toEqual([]);
    expect(storedMatch?.availability).toEqual([
      expect.objectContaining({
        playerId: candidate.player._id,
        participation: MatchAvailabilityParticipation.UNAVAILABLE,
      }),
    ]);
    expect((await Player.findById(candidate.player._id))?.__v).toBe(
      playerVersion
    );
  });

  it('rolls back a Lineup Player claim when a same-version C1 base command wins', async () => {
    const { admin, match, team } = await createContext();
    const candidate = await createEligiblePlayer(
      team._id,
      Gender.MALE,
      'BaseRace',
      1
    );
    const playerVersion = candidate.player.__v;
    const pause = pauseNextLineupPlayerClaim();
    const lineupAttempt = MatchLineupService.setLineup(match._id.toString(), {
      expectedVersion: 0,
      lineup: [
        {
          position: LineupPosition.MEN_SINGLES_1,
          playerId: candidate.player._id.toString(),
        },
      ],
    });
    const rejectedLineup = expect(lineupAttempt).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });

    await pause.claimReached;
    try {
      const updated = await MatchService.updateMatch(
        match._id.toString(),
        {
          expectedVersion: 0,
          teamId: team._id.toString(),
          opponentName: 'Updated Visitors',
          direction: MatchDirection.HOME,
          localDate: '2099-08-01',
          localTime: '12:00',
          location: 'Updated C4 Hall',
        },
        {
          id: admin._id.toString(),
          email: admin.email,
          accountKind: admin.accountKind,
          displayName: 'Lineup, Administrator',
          capabilities: [Capability.ADMINISTRATION],
        }
      );
      expect(updated.version).toBe(1);
    } finally {
      pause.releaseClaim();
    }
    await rejectedLineup;

    const storedMatch = await Match.findById(match._id);
    expect(storedMatch?.__v).toBe(1);
    expect(storedMatch?.opponentName).toBe('Updated Visitors');
    expect(storedMatch?.lineup).toEqual([]);
    expect((await Player.findById(candidate.player._id))?.__v).toBe(
      playerVersion
    );
    expect(await AuditLog.countDocuments({ entityId: match._id })).toBe(1);
  });

  it('keeps context/write administrator-only while current-Team Players can read detail warnings', async () => {
    const { admin, match, team } = await createContext();
    const member = await createUser({
      gender: Gender.MALE,
      firstName: 'Current',
      lastName: 'Player',
    });
    await createPlayer(member._id, [team._id]);
    const retainedId = new mongoose.Types.ObjectId();
    await Match.updateOne(
      { _id: match._id },
      {
        $set: {
          lineup: [
            {
              position: LineupPosition.OPEN_SINGLES,
              playerId: retainedId,
              playerNameSnapshot: 'Deleted Player',
            },
          ],
        },
      },
      { timestamps: false }
    );

    const playerDetail = await request(createApp())
      .get(`/api/matches/${match._id}`)
      .set('Cookie', await tokenFor(member._id));
    expect(playerDetail.status).toBe(200);
    expect(playerDetail.body.data.lineup[0].playerNameSnapshot).toBe(
      'Deleted Player'
    );
    expect(playerDetail.body.data.lineupWarnings).toEqual([
      expect.objectContaining({
        code: LineupViolationCode.PLAYER_REFERENCE_UNAVAILABLE,
      }),
    ]);

    const playerContext = await request(createApp())
      .get(`/api/matches/${match._id}/lineup-context`)
      .set('Cookie', await tokenFor(member._id));
    expect(playerContext.status).toBe(403);
    const playerWrite = await request(createApp())
      .put(`/api/matches/${match._id}/lineup`)
      .set('Cookie', await tokenFor(member._id))
      .set('Origin', FIRST_PARTY_ORIGIN)
      .send({ expectedVersion: 0, lineup: [] });
    expect(playerWrite.status).toBe(403);

    const adminContext = await request(createApp())
      .get(`/api/matches/${match._id}/lineup-context`)
      .set('Cookie', await tokenFor(admin._id));
    expect(adminContext.status).toBe(200);

    const invalidWrite = await request(createApp())
      .put(`/api/matches/${match._id}/lineup`)
      .set('Cookie', await tokenFor(admin._id))
      .set('Origin', FIRST_PARTY_ORIGIN)
      .send({
        expectedVersion: 0,
        lineup: [
          {
            position: LineupPosition.OPEN_SINGLES,
            playerId: retainedId.toString(),
          },
          {
            position: LineupPosition.OPEN_SINGLES,
            playerId: retainedId.toString(),
          },
        ],
      });
    expect(invalidWrite.status).toBe(400);
    expect(invalidWrite.body).toMatchObject({
      code: 'LINEUP_VALIDATION_FAILED',
      details: {
        violations: [
          {
            code: LineupViolationCode.DUPLICATE_POSITION_ASSIGNMENT,
            position: LineupPosition.OPEN_SINGLES,
            playerId: retainedId.toString(),
          },
        ],
      },
    });
  });
});
