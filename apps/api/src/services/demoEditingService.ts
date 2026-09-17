import { randomBytes } from 'node:crypto';
import { Types, type ClientSession } from 'mongoose';
import {
  DEMO_EDITING_DURATION_MINUTES,
  DEMO_EDITING_MUTATION_LIMIT,
  type DemoEditingStatus,
} from '@club/shared-types/api/demoEditing';
import { Announcement } from '../models/Announcement';
import {
  DEMO_EDITING_SINGLETON_KEY,
  DemoEditingSession,
  type DemoEditingSessionDocument,
} from '../models/DemoEditingSession';
import { Match } from '../models/Match';
import { AppError } from '../utils/errors';

const DURATION_MS = DEMO_EDITING_DURATION_MINUTES * 60 * 1000;

function objectId(value: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(value)) {
    throw AppError.unauthorized('Demo editing session is unavailable');
  }
  return new Types.ObjectId(value);
}

function owns(
  row: Pick<DemoEditingSessionDocument, 'authSessionId'>,
  authSessionId: string
): boolean {
  return row.authSessionId?.toString() === authSessionId;
}

function publicStatus(
  row: DemoEditingSessionDocument | null,
  authSessionId: string,
  now: Date
): DemoEditingStatus {
  if (!row || row.state === 'idle') {
    return {
      enabled: true,
      mode: 'read-only',
      remainingMutations: DEMO_EDITING_MUTATION_LIMIT,
    };
  }
  if (row.state === 'cleanup-blocked') {
    return { enabled: true, mode: 'cleanup-blocked', remainingMutations: 0 };
  }
  if (!row.expiresAt || row.expiresAt.getTime() <= now.getTime()) {
    return {
      enabled: true,
      mode: 'read-only',
      remainingMutations: DEMO_EDITING_MUTATION_LIMIT,
    };
  }
  if (!owns(row, authSessionId)) {
    return { enabled: true, mode: 'in-use', remainingMutations: 0 };
  }
  return {
    enabled: true,
    mode: 'active',
    expiresAt: row.expiresAt.toISOString(),
    remainingMutations: Math.max(
      0,
      DEMO_EDITING_MUTATION_LIMIT - row.mutationCount
    ),
  };
}

export class DemoEditingService {
  private static async ensureSingleton(): Promise<void> {
    // The demo boundary depends on these unique indexes for its single-writer
    // guarantees, so a first start waits for their persistence contracts.
    await Promise.all([
      DemoEditingSession.init(),
      Announcement.init(),
      Match.init(),
    ]);
    try {
      await DemoEditingSession.updateOne(
        { singletonKey: DEMO_EDITING_SINGLETON_KEY },
        {
          $setOnInsert: {
            singletonKey: DEMO_EDITING_SINGLETON_KEY,
            state: 'idle',
            mutationCount: 0,
          },
        },
        { upsert: true }
      );
    } catch (error) {
      // Concurrent first starts may race the singleton upsert; the unique index
      // makes the winner authoritative and the loser can continue safely.
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  }

  private static async cleanupExactLease(leaseId: string): Promise<void> {
    const [announcementCount, matchCount] = await Promise.all([
      Announcement.countDocuments({ demoScratchLeaseId: leaseId }),
      Match.countDocuments({ demoScratchLeaseId: leaseId }),
    ]);
    if (announcementCount > 1 || matchCount > 1) {
      throw AppError.conflict('Demo scratch ownership is ambiguous');
    }
    await Promise.all([
      Announcement.deleteMany({ demoScratchLeaseId: leaseId }),
      Match.deleteMany({ demoScratchLeaseId: leaseId }),
    ]);
  }

  private static async convergePredecessor(now: Date): Promise<boolean> {
    const row = await DemoEditingSession.findOne({
      singletonKey: DEMO_EDITING_SINGLETON_KEY,
    });
    if (!row || row.state === 'idle') return true;
    if (
      row.state === 'active' &&
      row.expiresAt &&
      row.expiresAt.getTime() > now.getTime()
    ) {
      return false;
    }
    if (!row.leaseId) {
      await DemoEditingSession.updateOne(
        { _id: row._id, state: row.state },
        { $set: { state: 'cleanup-blocked' }, $unset: { authSessionId: 1 } }
      );
      throw AppError.conflict('Demo scratch ownership cannot be established');
    }

    await DemoEditingSession.updateOne(
      { _id: row._id, leaseId: row.leaseId, state: row.state },
      { $set: { state: 'cleanup-blocked' }, $unset: { authSessionId: 1 } }
    );
    try {
      await this.cleanupExactLease(row.leaseId);
    } catch (error) {
      throw error instanceof AppError
        ? error
        : AppError.internal('Demo scratch cleanup is unavailable');
    }
    await DemoEditingSession.updateOne(
      { _id: row._id, leaseId: row.leaseId, state: 'cleanup-blocked' },
      {
        $set: { state: 'idle', mutationCount: 0 },
        $unset: {
          leaseId: 1,
          authSessionId: 1,
          startedAt: 1,
          expiresAt: 1,
        },
      }
    );
    return true;
  }

  static async status(
    authSessionId: string,
    now = new Date()
  ): Promise<DemoEditingStatus> {
    const row = await DemoEditingSession.findOne({
      singletonKey: DEMO_EDITING_SINGLETON_KEY,
    }).lean();
    return publicStatus(row, authSessionId, now);
  }

  static async start(
    authSessionId: string,
    now = new Date()
  ): Promise<DemoEditingStatus> {
    await this.ensureSingleton();
    const current = await DemoEditingSession.findOne({
      singletonKey: DEMO_EDITING_SINGLETON_KEY,
    });
    if (
      current?.state === 'active' &&
      current.expiresAt &&
      current.expiresAt.getTime() > now.getTime()
    ) {
      return publicStatus(current, authSessionId, now);
    }

    try {
      if (!(await this.convergePredecessor(now))) {
        const occupied = await DemoEditingSession.findOne({
          singletonKey: DEMO_EDITING_SINGLETON_KEY,
        });
        return publicStatus(occupied, authSessionId, now);
      }
    } catch {
      return { enabled: true, mode: 'cleanup-blocked', remainingMutations: 0 };
    }

    const leaseId = randomBytes(32).toString('base64url');
    const expiresAt = new Date(now.getTime() + DURATION_MS);
    const claimed = await DemoEditingSession.findOneAndUpdate(
      { singletonKey: DEMO_EDITING_SINGLETON_KEY, state: 'idle' },
      {
        $set: {
          state: 'active',
          leaseId,
          authSessionId: objectId(authSessionId),
          startedAt: now,
          expiresAt,
          mutationCount: 0,
        },
      },
      { new: true }
    );
    if (claimed) return publicStatus(claimed, authSessionId, now);
    return this.status(authSessionId, now);
  }

  static async finish(
    authSessionId: string,
    now = new Date()
  ): Promise<DemoEditingStatus> {
    const row = await DemoEditingSession.findOneAndUpdate(
      {
        singletonKey: DEMO_EDITING_SINGLETON_KEY,
        state: 'active',
        authSessionId: objectId(authSessionId),
        expiresAt: { $gt: now },
      },
      { $set: { state: 'cleanup-blocked' }, $unset: { authSessionId: 1 } },
      { new: true }
    );
    if (!row?.leaseId) return this.status(authSessionId, now);
    try {
      await this.cleanupExactLease(row.leaseId);
      await DemoEditingSession.updateOne(
        { _id: row._id, leaseId: row.leaseId, state: 'cleanup-blocked' },
        {
          $set: { state: 'idle', mutationCount: 0 },
          $unset: {
            leaseId: 1,
            authSessionId: 1,
            startedAt: 1,
            expiresAt: 1,
          },
        }
      );
      return {
        enabled: true,
        mode: 'read-only',
        remainingMutations: DEMO_EDITING_MUTATION_LIMIT,
      };
    } catch {
      return { enabled: true, mode: 'cleanup-blocked', remainingMutations: 0 };
    }
  }

  static async reserveMutation(
    authSessionId: string,
    now = new Date(),
    session?: ClientSession
  ): Promise<string> {
    const row = await DemoEditingSession.findOneAndUpdate(
      {
        singletonKey: DEMO_EDITING_SINGLETON_KEY,
        state: 'active',
        authSessionId: objectId(authSessionId),
        expiresAt: { $gt: now },
        mutationCount: { $lt: DEMO_EDITING_MUTATION_LIMIT },
      },
      { $inc: { mutationCount: 1 } },
      { new: true, session }
    ).select('+leaseId');
    if (!row?.leaseId) {
      throw new AppError(
        'Start demo editing before changing temporary demo data',
        409,
        'DEMO_EDITING_INACTIVE'
      );
    }
    return row.leaseId;
  }

  static async activeLeaseForOwner(
    authSessionId: string,
    now = new Date()
  ): Promise<string | undefined> {
    const row = await DemoEditingSession.findOne({
      singletonKey: DEMO_EDITING_SINGLETON_KEY,
      state: 'active',
      authSessionId: objectId(authSessionId),
      expiresAt: { $gt: now },
    })
      .select('+leaseId')
      .lean();
    return row?.leaseId;
  }
}
