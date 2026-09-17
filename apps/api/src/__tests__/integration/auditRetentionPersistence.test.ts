import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  AuditEventType,
  EntityType,
  AccountKind,
} from '@club/shared-types/core/enums';
import { AuditLog } from '../../models/AuditLog';
import { AuditService } from '../../services/auditService';

let databaseName: string;
let mongoLease: MongoTestDatabaseLease;

const actor = new Types.ObjectId();
const now = new Date('2026-08-31T12:00:00.000Z');

async function createAudit(createdAt: Date) {
  return AuditLog.create({
    eventType: AuditEventType.USER_UPDATED,
    entityType: EntityType.USER,
    entityId: new Types.ObjectId(),
    actorId: actor,
    actorAccountKind: AccountKind.PERSON,
    source: 'human',
    createdAt,
  });
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('auditRetention');
  databaseName = mongoLease.databaseName;
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  if (mongoose.connection.name !== databaseName) {
    throw new Error('Refusing to clear an unverified audit-retention database');
  }
  await mongoose.connection.db?.collection('auditlogs').deleteMany({});
  await mongoose.connection.db?.collection('auditlogs_archive').deleteMany({});
});

afterAll(async () => {
  await mongoLease.release();
}, 120_000);

describe('Audit retention maintenance', () => {
  it('uses calendar months and keeps dry-run read-only', async () => {
    expect(AuditService.retentionCutoff(now)).toEqual(
      new Date('2024-08-31T12:00:00.000Z')
    );
    await createAudit(new Date('2024-08-30T12:00:00.000Z'));

    const report = await AuditService.maintainRetention({ now });

    expect(report).toMatchObject({
      mode: 'dry-run',
      eligibleCount: 1,
      deletedCount: 0,
    });
    expect(await AuditLog.countDocuments()).toBe(1);
  });

  it('deletes only records strictly older than the cutoff and is idempotent', async () => {
    await createAudit(new Date('2024-08-31T11:59:59.999Z'));
    await createAudit(new Date('2024-08-31T12:00:00.000Z'));
    await createAudit(new Date('2024-09-01T12:00:00.000Z'));
    await mongoose.connection.db?.collection('auditlogs_archive').insertOne({
      sentinel: true,
    });

    const first = await AuditService.maintainRetention({ apply: true, now });
    const second = await AuditService.maintainRetention({ apply: true, now });

    expect(first).toMatchObject({ eligibleCount: 1, deletedCount: 1 });
    expect(second).toMatchObject({ eligibleCount: 0, deletedCount: 0 });
    expect(await AuditLog.countDocuments()).toBe(2);
    expect(
      await mongoose.connection.db
        ?.collection('auditlogs_archive')
        .countDocuments()
    ).toBe(1);
  });
});
