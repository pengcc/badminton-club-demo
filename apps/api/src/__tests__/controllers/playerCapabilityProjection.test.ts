import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AccountOnboardingStatus,
  Capability,
  PlayerType,
  AccountKind,
} from '@club/shared-types/core/enums';

const mocks = vi.hoisted(() => ({
  getAllPlayers: vi.fn(),
}));

vi.mock('../../services/playerService', () => ({
  MAX_PLAYER_BATCH_SIZE: 50,
  PlayerService: {
    getAllPlayersWithUserInfo: mocks.getAllPlayers,
  },
}));

import { PlayerController } from '../../controllers/playerController';

const player = {
  id: 'player-1',
  userId: 'user-1',
  type: PlayerType.EXTERNAL,
  userName: 'Player, External',
  userEmail: 'private@example.test',
  singlesRanking: 100,
  doublesRanking: 100,
  rankingDisplay: '100/100',
  isActivePlayer: true,
  teamIds: [],
  matchCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  accountSetup: {
    userId: 'user-1',
    accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
    deliveryStatus: 'failed',
    reissueAvailable: true,
  },
};

function response() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

function request(capabilities: Capability[]) {
  return {
    user: {
      id: 'viewer-1',
      accountKind: AccountKind.PERSON,
      administratorDesignation: false,
      displayName: 'External Player',
      email: 'viewer@example.test',
      firstName: 'External',
      lastName: 'Viewer',
      capabilities,
    },
  };
}

describe('WP6 restricted external Player projection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllPlayers.mockResolvedValue([player]);
  });

  it('redacts member email from the external sporting projection', async () => {
    const res = response();
    await PlayerController.getAllPlayers(
      request([
        Capability.AUTHENTICATED_ACCOUNT,
        Capability.ACTIVE_PLAYER,
        Capability.EXTERNAL_PLAYER,
      ]) as never,
      res as never,
      vi.fn()
    );

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [expect.objectContaining({ userEmail: '' })],
    });
    expect(mocks.getAllPlayers).toHaveBeenCalledWith(false);
    expect(res.json.mock.calls[0]?.[0].data[0]).not.toHaveProperty(
      'accountSetup'
    );
  });

  it('keeps member details for current-member workflows', async () => {
    const res = response();
    await PlayerController.getAllPlayers(
      request([Capability.CURRENT_MEMBER]) as never,
      res as never,
      vi.fn()
    );

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [expect.objectContaining({ userEmail: player.userEmail })],
    });
    expect(mocks.getAllPlayers).toHaveBeenCalledWith(false);
    expect(res.json.mock.calls[0]?.[0].data[0]).not.toHaveProperty(
      'accountSetup'
    );
  });

  it('includes the setup summary only for administrators', async () => {
    const res = response();
    await PlayerController.getAllPlayers(
      request([Capability.ADMINISTRATION]) as never,
      res as never,
      vi.fn()
    );

    expect(mocks.getAllPlayers).toHaveBeenCalledWith(true);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [expect.objectContaining({ accountSetup: player.accountSetup })],
    });
  });
});
