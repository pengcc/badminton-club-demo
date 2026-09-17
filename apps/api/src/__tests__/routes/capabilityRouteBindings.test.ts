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
  MembershipStatus,
  PlayerType,
  AccountKind,
  Capability,
} from '@club/shared-types/core/enums';

const handlers = vi.hoisted(() => {
  const ok = vi.fn((_req, res) => res.status(204).end());
  return { ok };
});

vi.mock('../../controllers/matchController', () => ({
  MatchController: {
    getMatches: handlers.ok,
    getMatchById: handlers.ok,
    createMatch: handlers.ok,
    updateMatch: handlers.ok,
    deleteMatch: handlers.ok,
    setResult: handlers.ok,
    getLineupContext: handlers.ok,
    updateLineup: handlers.ok,
    setOwnAvailability: handlers.ok,
    setPlayerAvailability: handlers.ok,
    importFromCSV: handlers.ok,
  },
}));
vi.mock('../../controllers/teamController', () => ({
  TeamController: {
    getPublicTeams: handlers.ok,
    getAllTeams: handlers.ok,
    getTeamById: handlers.ok,
    getTeamStats: handlers.ok,
    createTeam: handlers.ok,
    updateTeam: handlers.ok,
    deleteTeam: handlers.ok,
    getTeamPlayers: handlers.ok,
  },
}));
vi.mock('../../controllers/playerController', () => ({
  PlayerController: {
    getAllPlayers: handlers.ok,
    getActivePlayers: handlers.ok,
    getLifecycleCandidates: handlers.ok,
    batchLifecycle: handlers.ok,
    convertFormerMemberToExternal: handlers.ok,
    getPlayerByUserId: handlers.ok,
    getPlayerById: handlers.ok,
    updatePlayer: handlers.ok,
    updatePlayerStatus: handlers.ok,
    cleanupPlayer: handlers.ok,
    batchUpdatePlayers: handlers.ok,
    addPlayerToTeam: handlers.ok,
    removePlayerFromTeam: handlers.ok,
    deletePlayer: handlers.ok,
  },
}));
vi.mock('../../controllers/guestPlayController', () => ({
  GuestPlayController: {
    opportunities: handlers.ok,
    createRequest: handlers.ok,
    getMyRequests: handlers.ok,
    cancelOwnRequest: handlers.ok,
    getStats: handlers.ok,
    getRequestById: handlers.ok,
    decide: handlers.ok,
    correctDecision: handlers.ok,
    archive: handlers.ok,
    restore: handlers.ok,
    retryNotification: handlers.ok,
    getAllRequests: handlers.ok,
  },
}));

import guestPlayRoutes from '../../routes/guestPlay';
import matchRoutes from '../../routes/matches';
import playerRoutes from '../../routes/players';
import teamRoutes from '../../routes/teams';
import { errorHandler } from '../../middleware/errorHandler';
import { Player } from '../../models/Player';
import { User } from '../../models/User';

const userId = '507f1f77bcf86cd799439011';
let state: {
  accountKind: AccountKind;
  administratorDesignation: boolean;
  displayName?: string;
  capabilities?: Capability[];
  membershipStatus: MembershipStatus;
  player?: { type: PlayerType; isActivePlayer: boolean };
};

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/matches', matchRoutes);
  app.use('/api/teams', teamRoutes);
  app.use('/api/players', playerRoutes);
  app.use('/api/guest-play', guestPlayRoutes);
  app.use(errorHandler);
  return app;
}

function authToken() {
  return mockAuthSessionCookie(userId);
}

async function get(path: string) {
  return request(createApp())
    .get(path)
    .set('Cookie', authToken())
    .set('Origin', FIRST_PARTY_ORIGIN);
}

async function post(path: string) {
  return request(createApp())
    .post(path)
    .set('Cookie', authToken())
    .set('Origin', FIRST_PARTY_ORIGIN);
}

async function remove(path: string) {
  return request(createApp())
    .delete(path)
    .set('Cookie', authToken())
    .set('Origin', FIRST_PARTY_ORIGIN);
}

async function put(path: string, body: Record<string, unknown>) {
  return request(createApp())
    .put(path)
    .set('Cookie', authToken())
    .set('Origin', FIRST_PARTY_ORIGIN)
    .send(body);
}

async function patch(path: string, body: Record<string, unknown>) {
  return request(createApp())
    .patch(path)
    .set('Cookie', authToken())
    .set('Origin', FIRST_PARTY_ORIGIN)
    .send(body);
}

describe('WP6 representative route capability bindings', () => {
  beforeEach(() => {
    state = {
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipStatus: MembershipStatus.ACTIVE,
    };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(User, 'findById').mockReturnValue({
      select: vi.fn().mockImplementation(async () =>
        canonicalAuthUserDocument({
          _id: userId,
          id: userId,
          email: 'route@example.test',
          firstName: 'Route',
          lastName: 'Tester',
          accountKind: state.accountKind,
          administratorDesignation: state.administratorDesignation,
          membershipStatus: state.membershipStatus,
          accountOnboardingStatus: AccountOnboardingStatus.READY,
        })
      ),
    } as never);
    vi.spyOn(Player, 'findOne').mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi
          .fn()
          .mockImplementation(async () =>
            state.player ? { _id: userId, ...state.player } : null
          ),
      }),
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows active external Players into sporting routes but not member self-service', async () => {
    state = {
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipStatus: MembershipStatus.INACTIVE,
      player: { type: PlayerType.EXTERNAL, isActivePlayer: true },
    };

    expect((await get('/api/matches')).status).toBe(204);
    expect((await get('/api/teams')).status).toBe(204);
    expect((await get('/api/players')).status).toBe(204);
    expect((await get('/api/guest-play/my-requests')).status).toBe(403);
  });

  it('allows current members into member and Match routes', async () => {
    expect((await get('/api/matches')).status).toBe(204);
    expect((await get('/api/guest-play/my-requests')).status).toBe(204);
  });

  it('keeps the Team demographic summary administrator-only', async () => {
    const path = '/api/teams/507f1f77bcf86cd799439013/stats';

    expect((await get(path)).status).toBe(403);

    state = {
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      membershipStatus: MembershipStatus.INACTIVE,
      player: { type: PlayerType.EXTERNAL, isActivePlayer: true },
    };
    expect((await get(path)).status).toBe(403);

    state = {
      accountKind: AccountKind.PERSON,
      administratorDesignation: true,
      membershipStatus: MembershipStatus.ACTIVE,
    };
    expect((await get(path)).status).toBe(204);
  });

  it('allows a designated current member into administrative Guest Play routes', async () => {
    state = {
      accountKind: AccountKind.PERSON,
      administratorDesignation: true,
      membershipStatus: MembershipStatus.ACTIVE,
    };

    expect((await get('/api/guest-play')).status).toBe(204);
  });

  it('keeps canonical Player Team mutations administrator-only', async () => {
    const playerId = '507f1f77bcf86cd799439012';
    const teamId = '507f1f77bcf86cd799439013';
    const path = `/api/players/${playerId}/teams/${teamId}`;

    expect((await post(path)).status).toBe(403);
    expect((await remove(path)).status).toBe(403);

    state = {
      accountKind: AccountKind.PERSON,
      administratorDesignation: true,
      membershipStatus: MembershipStatus.ACTIVE,
    };
    expect((await post(path)).status).toBe(204);
    expect((await remove(path)).status).toBe(204);
  });

  it('does not bind deprecated Team-centric mutation routes', async () => {
    state = {
      accountKind: AccountKind.PERSON,
      administratorDesignation: true,
      membershipStatus: MembershipStatus.ACTIVE,
    };
    const path =
      '/api/teams/507f1f77bcf86cd799439013/players/507f1f77bcf86cd799439012';

    expect((await post(path)).status).toBe(404);
    expect((await remove(path)).status).toBe(404);
  });

  it('keeps the dedicated Match result task administrator-only', async () => {
    const path = '/api/matches/507f1f77bcf86cd799439013/result';
    const result = {
      expectedVersion: 0,
      homeScore: 3,
      awayScore: 3,
    };

    expect((await put(path, result)).status).toBe(403);
    state = {
      accountKind: AccountKind.PERSON,
      administratorDesignation: true,
      membershipStatus: MembershipStatus.ACTIVE,
    };
    expect((await put(path, result)).status).toBe(204);
  });

  it('keeps Lineup context and mutation administrator-only', async () => {
    const matchId = '507f1f77bcf86cd799439013';
    const contextPath = `/api/matches/${matchId}/lineup-context`;
    const lineupPath = `/api/matches/${matchId}/lineup`;
    const command = { expectedVersion: 0, lineup: [] };

    state.player = { type: PlayerType.MEMBER, isActivePlayer: true };
    expect((await get(contextPath)).status).toBe(403);
    expect((await put(lineupPath, command)).status).toBe(403);

    state = {
      accountKind: AccountKind.PERSON,
      administratorDesignation: true,
      membershipStatus: MembershipStatus.ACTIVE,
    };
    expect((await get(contextPath)).status).toBe(204);
    expect((await put(lineupPath, command)).status).toBe(204);
  });

  it('separates Player-self and administrator Availability commands', async () => {
    const matchId = '507f1f77bcf86cd799439013';
    const playerId = '507f1f77bcf86cd799439012';
    const selfPath = `/api/matches/${matchId}/availability/self`;
    const adminPath = `/api/matches/${matchId}/availability/${playerId}`;

    state.player = { type: PlayerType.MEMBER, isActivePlayer: true };
    expect(
      (
        await put(selfPath, {
          expectedVersion: 0,
          participation: 'available',
        })
      ).status
    ).toBe(204);
    expect(
      (
        await put(adminPath, {
          expectedVersion: 0,
          participation: 'available',
        })
      ).status
    ).toBe(403);

    state = {
      accountKind: AccountKind.PERSON,
      administratorDesignation: true,
      membershipStatus: MembershipStatus.ACTIVE,
    };
    expect(
      (
        await put(adminPath, {
          expectedVersion: 0,
          participation: 'unavailable',
        })
      ).status
    ).toBe(204);
    expect(
      (
        await put(selfPath, {
          expectedVersion: 0,
          participation: 'available',
        })
      ).status
    ).toBe(403);
    expect(
      (
        await patch(adminPath, {
          isAvailable: true,
        })
      ).status
    ).toBe(404);
  });
});
