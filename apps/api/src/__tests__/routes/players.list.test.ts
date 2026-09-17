import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AccountKind,
  AccountOnboardingStatus,
  MembershipStatus,
  PlayerType,
} from '@club/shared-types/core/enums';
import type { Api } from '@club/shared-types/api/player';
import { errorHandler } from '../../middleware/errorHandler';
import { Player } from '../../models/Player';
import { User } from '../../models/User';
import playerRoutes from '../../routes/players';
import { PlayerService } from '../../services/playerService';
import { config } from '../../config';
import {
  canonicalAuthUserDocument,
  mockAuthSessionCookie,
} from '../helpers/authSession';

const administratorId = '507f1f77bcf86cd799439011';

const player: Api.PlayerResponse = {
  id: 'player-1',
  userId: 'user-1',
  type: PlayerType.EXTERNAL,
  userName: 'Player, External',
  userEmail: 'external@example.test',
  singlesRanking: 100,
  doublesRanking: 100,
  rankingDisplay: '100/100',
  isActivePlayer: true,
  teamIds: [],
  matchCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/players', playerRoutes);
  app.use(errorHandler);
  return app;
}

const originalDemoRuntime = { ...config.demoRuntime };

function mockAdministrator(email = 'admin@example.test') {
  vi.spyOn(User, 'findById').mockReturnValue({
    select: vi.fn().mockResolvedValue(
      canonicalAuthUserDocument({
        _id: administratorId,
        id: administratorId,
        email,
        firstName: 'Test',
        lastName: 'Admin',
        accountKind: AccountKind.PERSON,
        administratorDesignation: true,
        membershipStatus: MembershipStatus.ACTIVE,
        accountOnboardingStatus: AccountOnboardingStatus.READY,
      })
    ),
  } as never);
  vi.spyOn(Player, 'findOne').mockReturnValue({
    select: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    }),
  } as never);
}

describe('GET /api/players', () => {
  afterEach(() => {
    config.demoRuntime.enabled = originalDemoRuntime.enabled;
    config.demoRuntime.adminEmail = originalDemoRuntime.adminEmail;
    vi.restoreAllMocks();
  });

  it('returns the complete Player list in the shared success envelope', async () => {
    mockAdministrator();
    vi.spyOn(PlayerService, 'getAllPlayersWithUserInfo').mockResolvedValue([
      player,
    ]);

    const response = await request(createApp())
      .get('/api/players')
      .set('Cookie', mockAuthSessionCookie(administratorId));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: [player] });
    expect(response.body).not.toHaveProperty('items');
    expect(response.body).not.toHaveProperty('pagination');
    expect(PlayerService.getAllPlayersWithUserInfo).toHaveBeenCalledWith(true);
  });

  it('denies the Demo Admin before account-security Player projections are read', async () => {
    config.demoRuntime.enabled = true;
    config.demoRuntime.adminEmail = 'demo.admin@club.invalid';
    mockAdministrator(config.demoRuntime.adminEmail);
    const listPlayers = vi
      .spyOn(PlayerService, 'getAllPlayersWithUserInfo')
      .mockResolvedValue([player]);

    const response = await request(createApp())
      .get('/api/players')
      .set('Cookie', mockAuthSessionCookie(administratorId));

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      code: 'DEMO_SCOPE_DENIED',
    });
    expect(listPlayers).not.toHaveBeenCalled();
  });
});
