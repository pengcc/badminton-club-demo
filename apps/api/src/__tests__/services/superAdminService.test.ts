import mongoose from 'mongoose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AccountKind,
  AccountOnboardingStatus,
} from '@club/shared-types/core/enums';

const mocks = vi.hoisted(() => ({
  createIndex: vi.fn(),
  findOne: vi.fn(),
  exists: vi.fn(),
  create: vi.fn(),
  findOneAndUpdate: vi.fn(),
  issue: vi.fn(),
  deliver: vi.fn(),
}));

vi.mock('../../models/User', () => ({
  User: {
    collection: { createIndex: mocks.createIndex },
    findOne: mocks.findOne,
    exists: mocks.exists,
    create: mocks.create,
    findOneAndUpdate: mocks.findOneAndUpdate,
  },
}));
vi.mock('../../services/passwordSetupService', () => ({
  PasswordSetupService: { issue: mocks.issue },
}));
vi.mock('../../services/passwordSetupDeliveryService', () => ({
  PasswordSetupDeliveryService: { deliver: mocks.deliver },
}));

import { SuperAdminService } from '../../services/superAdminService';

const id = '507f1f77bcf86cd799439012';

function principal(overrides: Record<string, unknown> = {}) {
  return {
    _id: { toString: () => id },
    email: 'operator@example.test',
    accountKind: AccountKind.SUPER_ADMIN,
    accountOnboardingStatus: AccountOnboardingStatus.PASSWORD_SETUP_PENDING,
    passwordSetupGeneration: 0,
    authSessionGeneration: 3,
    ...overrides,
  };
}

function selectable(value: unknown) {
  return { select: vi.fn().mockResolvedValue(value) };
}

describe('SuperAdminService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createIndex.mockResolvedValue('one_super_admin');
    mocks.issue.mockResolvedValue({ token: '3.secret', generation: 4 });
    mocks.deliver.mockResolvedValue('sent');
    vi.spyOn(mongoose, 'startSession').mockResolvedValue({
      withTransaction: async (operation: () => Promise<void>) => operation(),
      endSession: vi.fn(),
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enforces the singleton index and bootstraps through password setup without returning a token', async () => {
    mocks.findOne.mockResolvedValue(null);
    mocks.exists.mockResolvedValue(null);
    mocks.create.mockResolvedValue([principal()]);

    const result = await SuperAdminService.bootstrap(' Operator@Example.Test ');

    expect(mocks.createIndex).toHaveBeenCalledWith(
      { accountKind: 1 },
      expect.objectContaining({
        unique: true,
        partialFilterExpression: { accountKind: AccountKind.SUPER_ADMIN },
      })
    );
    expect(mocks.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          email: 'operator@example.test',
          accountKind: AccountKind.SUPER_ADMIN,
          administratorDesignation: false,
          isPlayer: false,
        }),
      ],
      expect.anything()
    );
    expect(result).toEqual({
      userId: id,
      created: true,
      setupGeneration: 4,
      deliveryStatus: 'sent',
    });
    expect(JSON.stringify(result)).not.toContain('3.secret');
  });

  it('rejects a second canonical email and preserves the existing principal', async () => {
    mocks.findOne.mockResolvedValue(
      principal({
        email: 'existing@example.test',
        accountOnboardingStatus: AccountOnboardingStatus.READY,
      })
    );

    await expect(
      SuperAdminService.bootstrap('different@example.test')
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it('recovers the same principal, invalidates sessions and old setup state, then issues a replacement', async () => {
    const existing = principal();
    const updated = principal({ authSessionGeneration: 4 });
    mocks.findOne.mockReturnValue(selectable(existing));
    mocks.findOneAndUpdate.mockResolvedValue(updated);

    const result = await SuperAdminService.recover('operator@example.test');

    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: existing._id,
        authSessionGeneration: 3,
      }),
      expect.objectContaining({
        $inc: expect.objectContaining({ authSessionGeneration: 1 }),
        $unset: expect.objectContaining({
          password: 1,
          passwordSetupTokenDigest: 1,
          passwordSetupExpiresAt: 1,
        }),
      }),
      expect.objectContaining({ new: true })
    );
    expect(mocks.issue).toHaveBeenCalledWith(id, undefined, { locale: 'de' });
    expect(result.userId).toBe(id);
    expect(JSON.stringify(result)).not.toContain('3.secret');
  });
});
