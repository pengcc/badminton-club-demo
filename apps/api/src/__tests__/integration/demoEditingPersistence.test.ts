import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import { Types } from 'mongoose';
import mongoose from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MatchDirection } from '@club/shared-types/core/enums';
import { Announcement } from '../../models/Announcement';
import { DemoEditingSession } from '../../models/DemoEditingSession';
import { Match } from '../../models/Match';
import { DemoEditingService } from '../../services/demoEditingService';

let mongoLease: MongoTestDatabaseLease;

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('demoEditing');
  mongoLease.assertOwnedDatabase();
  await DemoEditingSession.syncIndexes();
  await Announcement.syncIndexes();
  await Match.syncIndexes();
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await DemoEditingSession.deleteMany({});
  await Announcement.deleteMany({});
  await Match.deleteMany({});
});

afterAll(async () => {
  await mongoLease.release();
});

describe('Demo Editing lease persistence', () => {
  it('reuses the singleton row but never its immutable lease generation', async () => {
    const authSessionId = new Types.ObjectId().toString();
    const firstStart = new Date('2026-09-14T10:00:00.000Z');
    await DemoEditingService.start(authSessionId, firstStart);
    const first = await DemoEditingSession.findOne().lean();

    await DemoEditingService.finish(
      authSessionId,
      new Date('2026-09-14T10:01:00.000Z')
    );
    await DemoEditingService.start(
      authSessionId,
      new Date('2026-09-14T10:02:00.000Z')
    );
    const second = await DemoEditingSession.findOne().lean();

    expect(second?._id).toEqual(first?._id);
    expect(second?.leaseId).toBeTruthy();
    expect(second?.leaseId).not.toBe(first?.leaseId);
  });

  it('derives expiry from persisted time without a background processor', async () => {
    const authSessionId = new Types.ObjectId().toString();
    await DemoEditingService.start(
      authSessionId,
      new Date('2026-09-14T10:00:00.000Z')
    );

    await expect(
      DemoEditingService.status(
        authSessionId,
        new Date('2026-09-14T10:31:00.000Z')
      )
    ).resolves.toEqual({
      enabled: true,
      mode: 'read-only',
      remainingMutations: 20,
    });
    await expect(
      DemoEditingService.activeLeaseForOwner(
        authSessionId,
        new Date('2026-09-14T10:31:00.000Z')
      )
    ).resolves.toBeUndefined();
  });

  it('atomically grants one global lease and enforces the mutation budget', async () => {
    const firstSession = new Types.ObjectId().toString();
    const secondSession = new Types.ObjectId().toString();

    const results = await Promise.all([
      DemoEditingService.start(firstSession),
      DemoEditingService.start(secondSession),
    ]);
    expect(results.map((result) => result.mode).sort()).toEqual([
      'active',
      'in-use',
    ]);

    const owner = results[0].mode === 'active' ? firstSession : secondSession;
    const leaseIds = await Promise.all(
      Array.from({ length: 20 }, () =>
        DemoEditingService.reserveMutation(owner)
      )
    );
    expect(new Set(leaseIds).size).toBe(1);
    await expect(
      DemoEditingService.reserveMutation(owner)
    ).rejects.toMatchObject({ statusCode: 409, code: 'DEMO_EDITING_INACTIVE' });
  });

  it('deletes only exact-lease scratch records and retains canonical data', async () => {
    const authSessionId = new Types.ObjectId().toString();
    const actor = new Types.ObjectId();
    const teamId = new Types.ObjectId();
    const active = await DemoEditingService.start(authSessionId);
    expect(active.mode).toBe('active');
    const leaseId = await DemoEditingService.reserveMutation(authSessionId);

    await Announcement.create([
      {
        translations: {
          de: { title: 'Canonical', content: 'Retained' },
          en: { title: '', content: '' },
          zh: { title: '', content: '' },
        },
        type: 'info',
        displayDate: '2026.09.14',
        externalLink: '',
        isActive: true,
        order: 0,
        createdBy: actor,
        updatedBy: actor,
      },
      {
        translations: {
          de: { title: 'Scratch', content: 'Disposable' },
          en: { title: '', content: '' },
          zh: { title: '', content: '' },
        },
        type: 'info',
        displayDate: '2026.09.14',
        externalLink: '',
        isActive: false,
        order: 0,
        demoScratchLeaseId: leaseId,
        createdBy: actor,
        updatedBy: actor,
      },
    ]);
    await Match.create([
      {
        scheduleDuplicateKey: 'canonical-match',
        teamId,
        opponentName: 'Canonical Opponent',
        direction: MatchDirection.HOME,
        startAt: new Date('2026-10-01T18:00:00.000Z'),
        location: 'Canonical Hall',
        lineup: [],
        availability: [],
        createdById: actor,
      },
      {
        scheduleDuplicateKey: 'scratch-match',
        teamId,
        opponentName: 'Scratch Opponent',
        direction: MatchDirection.AWAY,
        startAt: new Date('2026-10-02T18:00:00.000Z'),
        location: 'Scratch Hall',
        lineup: [],
        availability: [],
        createdById: actor,
        demoScratchLeaseId: leaseId,
      },
    ]);

    await expect(
      DemoEditingService.finish(authSessionId)
    ).resolves.toMatchObject({ mode: 'read-only' });
    expect(await Announcement.countDocuments({})).toBe(1);
    expect(await Match.countDocuments({})).toBe(1);
    expect(
      await Announcement.countDocuments({ demoScratchLeaseId: leaseId })
    ).toBe(0);
    expect(await Match.countDocuments({ demoScratchLeaseId: leaseId })).toBe(0);
  });

  it('cannot leave a scratch write behind when Finish races an in-flight command', async () => {
    const authSessionId = new Types.ObjectId().toString();
    const actor = new Types.ObjectId();
    await DemoEditingService.start(authSessionId);
    let releaseCommand: (() => void) | undefined;
    let markReserved: (() => void) | undefined;
    const reserved = new Promise<void>((resolve) => {
      markReserved = resolve;
    });
    const commandMayContinue = new Promise<void>((resolve) => {
      releaseCommand = resolve;
    });

    const commandSession = await mongoose.startSession();
    const command = commandSession
      .withTransaction(async () => {
        const leaseId = await DemoEditingService.reserveMutation(
          authSessionId,
          new Date(),
          commandSession
        );
        markReserved?.();
        await commandMayContinue;
        await Announcement.create(
          [
            {
              translations: {
                de: { title: 'Racing scratch', content: 'Disposable' },
                en: { title: '', content: '' },
                zh: { title: '', content: '' },
              },
              type: 'info',
              displayDate: '2026.09.14',
              externalLink: '',
              isActive: false,
              order: 0,
              demoScratchLeaseId: leaseId,
              createdBy: actor,
              updatedBy: actor,
            },
          ],
          { session: commandSession }
        );
      })
      .finally(() => commandSession.endSession());

    await reserved;
    const finish = DemoEditingService.finish(authSessionId);
    releaseCommand?.();
    await command;
    await expect(finish).resolves.toMatchObject({ mode: 'read-only' });
    expect(await Announcement.countDocuments({})).toBe(0);
  });

  it('enforces one scratch record of each supported type per lease', async () => {
    const leaseId = 'immutable-test-lease';
    const actor = new Types.ObjectId();
    const baseAnnouncement = {
      translations: {
        de: { title: 'Scratch', content: 'Disposable' },
        en: { title: '', content: '' },
        zh: { title: '', content: '' },
      },
      type: 'info',
      displayDate: '2026.09.14',
      externalLink: '',
      isActive: false,
      order: 0,
      demoScratchLeaseId: leaseId,
      createdBy: actor,
      updatedBy: actor,
    };

    await Announcement.create(baseAnnouncement);
    await expect(Announcement.create(baseAnnouncement)).rejects.toMatchObject({
      code: 11000,
    });
  });
});
