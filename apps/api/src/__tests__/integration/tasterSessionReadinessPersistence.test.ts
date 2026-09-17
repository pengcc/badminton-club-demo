import { randomUUID } from 'node:crypto';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import mongoose, { Mongoose } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  TASTER_SESSION_COLLECTION,
  TASTER_SESSION_PENDING_EMAIL_INDEX,
  TASTER_SESSION_PENDING_EMAIL_INDEX_KEYS,
  TASTER_SESSION_PENDING_EMAIL_INDEX_OPTIONS,
} from '../../config/tasterSessionPersistence';
import {
  ensureTasterSessionIndexes,
  inspectTasterSessionReleasePrerequisite,
  inspectTasterSessionReadiness,
} from '../../services/tasterSessionReadinessService';
import {
  TasterSessionRequestModel,
  tasterSessionRequestSchema,
} from '../../models/TasterSessionRequest';

let mongoLease: MongoTestDatabaseLease;
let mongoUri = '';

function canonicalRequest(
  email: string,
  status: 'pending' | 'invited' | 'declined'
) {
  return {
    name: 'Visitor',
    email,
    playerLevel: 'beginner',
    status,
    archived: false,
    delivery: { status: 'not_requested' },
    locale: 'en',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function initializeProductionStyleTasterSessionModel(
  uri: string
): Promise<string[]> {
  const runtime = new Mongoose();
  await runtime.connect(uri, { monitorCommands: true });
  const createdIndexNames: string[] = [];
  runtime.connection.getClient().on('commandStarted', (event) => {
    if (event.commandName !== 'createIndexes') return;
    const command = event.command as { indexes?: Array<{ name?: unknown }> };
    for (const index of command.indexes ?? []) {
      if (typeof index.name === 'string') createdIndexNames.push(index.name);
    }
  });
  const runtimeModel = runtime.model(
    `TasterSessionRuntime${randomUUID().replaceAll('-', '')}`,
    tasterSessionRequestSchema.clone(),
    TASTER_SESSION_COLLECTION
  );
  await runtimeModel.init();
  await runtime.disconnect();
  return createdIndexNames;
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('tasterSessionReadiness');
  mongoUri = mongoLease.uri;
  mongoLease.assertOwnedDatabase();
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await mongoose.connection.dropDatabase();
});

afterAll(async () => {
  await mongoLease.release();
});

describe('Taster Session deployment readiness persistence', () => {
  it('treats the exact named pending-email index as a read-only release prerequisite', async () => {
    const database = mongoose.connection.db!;

    await expect(
      inspectTasterSessionReleasePrerequisite(mongoose.connection)
    ).resolves.toMatchObject({
      ready: false,
      index: {
        name: TASTER_SESSION_PENDING_EMAIL_INDEX,
        present: false,
        compatible: false,
        conflictingNamedIndex: false,
      },
    });
    expect(
      await database
        .listCollections(
          { name: TASTER_SESSION_COLLECTION },
          { nameOnly: true }
        )
        .toArray()
    ).toEqual([]);

    const collection = database.collection(TASTER_SESSION_COLLECTION);
    await collection.createIndex(
      TASTER_SESSION_PENDING_EMAIL_INDEX_KEYS,
      TASTER_SESSION_PENDING_EMAIL_INDEX_OPTIONS
    );
    const before = await collection.indexes();
    await expect(
      inspectTasterSessionReleasePrerequisite(mongoose.connection)
    ).resolves.toMatchObject({
      ready: true,
      pendingMissingOrUnnormalizedEmailCount: 0,
      duplicatePendingNormalizedEmailGroups: 0,
      index: { present: true, compatible: true },
    });
    expect(await collection.indexes()).toEqual(before);
  });

  it('blocks a conflicting named pending-email index without creating or replacing it', async () => {
    const collection = mongoose.connection.db!.collection(
      TASTER_SESSION_COLLECTION
    );
    await collection.createIndex(
      { email: 1 },
      { name: TASTER_SESSION_PENDING_EMAIL_INDEX }
    );
    const before = await collection.indexes();

    await expect(
      inspectTasterSessionReleasePrerequisite(mongoose.connection)
    ).resolves.toMatchObject({
      ready: false,
      index: {
        present: true,
        compatible: false,
        conflictingNamedIndex: true,
      },
    });
    await expect(
      ensureTasterSessionIndexes(mongoose.connection)
    ).rejects.toMatchObject({
      report: { index: { conflictingNamedIndex: true } },
    });
    expect(await collection.indexes()).toEqual(before);
  });

  it('blocks missing or non-canonical pending email without changing records or indexes', async () => {
    const collection = mongoose.connection.db!.collection(
      TASTER_SESSION_COLLECTION
    );
    await collection.insertOne(
      canonicalRequest(' Pending@Example.test ', 'pending')
    );
    await collection.createIndex(
      TASTER_SESSION_PENDING_EMAIL_INDEX_KEYS,
      TASTER_SESSION_PENDING_EMAIL_INDEX_OPTIONS
    );
    const indexesBefore = await collection.indexes();

    await expect(
      inspectTasterSessionReleasePrerequisite(mongoose.connection)
    ).resolves.toMatchObject({
      ready: false,
      pendingMissingOrUnnormalizedEmailCount: 1,
      duplicatePendingNormalizedEmailGroups: 0,
      index: { compatible: true },
    });
    await expect(
      ensureTasterSessionIndexes(mongoose.connection)
    ).rejects.toMatchObject({
      report: { pendingMissingOrUnnormalizedEmailCount: 1 },
    });
    expect(await collection.countDocuments()).toBe(1);
    expect(await collection.indexes()).toEqual(indexesBefore);
  });

  it('establishes the pending-email index while preserving diagnostic-only legacy data', async () => {
    const collection = mongoose.connection.db!.collection(
      TASTER_SESSION_COLLECTION
    );
    await collection.insertMany([
      {
        ...canonicalRequest('contacted@example.test', 'pending'),
        status: 'contacted',
        appointmentDate: new Date('2026-07-30T18:00:00.000Z'),
        processedAt: new Date(),
      },
      {
        ...canonicalRequest('capacity@example.test', 'pending'),
        status: 'no_capacity',
      },
      {
        ...canonicalRequest('archived@example.test', 'pending'),
        status: 'archived',
      },
      {
        name: 'Old pending',
        email: 'pending@example.test',
        playerLevel: 'beginner',
        status: 'pending',
        locale: 'en',
      },
    ]);

    const report = await inspectTasterSessionReadiness(mongoose.connection);

    expect(report).toMatchObject({
      documentCount: 4,
      statusCounts: {
        contacted: 1,
        no_capacity: 1,
        archived: 1,
        pending: 1,
      },
      legacyStatusCount: 3,
      missingArchivedCount: 1,
      missingDeliveryCount: 1,
      legacyAppointmentFieldCount: 1,
      readyForDeployment: false,
    });
    expect(report.blockers).toEqual(
      expect.arrayContaining([
        'legacy_business_status_mapping_required',
        'missing_archive_lifecycle_fields',
        'missing_delivery_fields',
        'legacy_appointment_fields_present',
      ])
    );
    await expect(
      ensureTasterSessionIndexes(mongoose.connection)
    ).resolves.toMatchObject({
      ready: true,
      pendingMissingOrUnnormalizedEmailCount: 0,
      duplicatePendingNormalizedEmailGroups: 0,
      index: { compatible: true },
    });
    expect(await collection.countDocuments()).toBe(4);
    expect(
      (await collection.indexes()).some(
        (index) => index.name === TASTER_SESSION_PENDING_EMAIL_INDEX
      )
    ).toBe(true);
    await expect(
      inspectTasterSessionReadiness(mongoose.connection)
    ).resolves.toMatchObject({
      readyForDeployment: false,
      blockers: expect.arrayContaining([
        'legacy_business_status_mapping_required',
        'missing_archive_lifecycle_fields',
        'missing_delivery_fields',
        'legacy_appointment_fields_present',
      ]),
    });
  });

  it('keeps terminal legacy data in the broad audit after the pending persistence prerequisite is satisfied', async () => {
    const collection = mongoose.connection.db!.collection(
      TASTER_SESSION_COLLECTION
    );
    await collection.insertMany([
      {
        ...canonicalRequest('legacy@example.test', 'invited'),
        status: 'archived',
        appointmentDate: new Date('2026-07-30T18:00:00.000Z'),
      },
      canonicalRequest('pending@example.test', 'pending'),
    ]);
    await collection.createIndex(
      TASTER_SESSION_PENDING_EMAIL_INDEX_KEYS,
      TASTER_SESSION_PENDING_EMAIL_INDEX_OPTIONS
    );

    await expect(
      inspectTasterSessionReadiness(mongoose.connection)
    ).resolves.toMatchObject({ readyForDeployment: false });
    await expect(
      inspectTasterSessionReleasePrerequisite(mongoose.connection)
    ).resolves.toMatchObject({
      ready: true,
      pendingMissingOrUnnormalizedEmailCount: 0,
      duplicatePendingNormalizedEmailGroups: 0,
      index: { compatible: true },
    });
  });

  it('blocks duplicate normalized pending emails before any partial index mutation', async () => {
    const collection = mongoose.connection.db!.collection(
      TASTER_SESSION_COLLECTION
    );
    await collection.insertMany([
      canonicalRequest('duplicate@example.test', 'pending'),
      canonicalRequest('duplicate@example.test', 'pending'),
    ]);

    const report = await inspectTasterSessionReadiness(mongoose.connection);
    expect(report).toMatchObject({
      duplicatePendingNormalizedEmailGroups: 1,
      duplicatePendingDocuments: 2,
      missingOrUnnormalizedEmailCount: 0,
      readyForDeployment: false,
    });
    await expect(
      inspectTasterSessionReleasePrerequisite(mongoose.connection)
    ).resolves.toMatchObject({
      ready: false,
      duplicatePendingNormalizedEmailGroups: 1,
      duplicatePendingDocuments: 2,
    });
    await expect(
      ensureTasterSessionIndexes(mongoose.connection)
    ).rejects.toMatchObject({
      report: {
        duplicatePendingNormalizedEmailGroups: 1,
      },
    });
    expect(await collection.countDocuments()).toBe(2);
    expect(
      (await collection.indexes()).some(
        (index) => index.name === TASTER_SESSION_PENDING_EMAIL_INDEX
      )
    ).toBe(false);
  });

  it('creates the partial unique index only after canonical reconciliation', async () => {
    const collection = mongoose.connection.db!.collection(
      TASTER_SESSION_COLLECTION
    );
    await collection.insertMany([
      canonicalRequest('pending@example.test', 'pending'),
      canonicalRequest('terminal@example.test', 'invited'),
      canonicalRequest('terminal@example.test', 'declined'),
    ]);

    const dryRun = await inspectTasterSessionReadiness(mongoose.connection);
    expect(dryRun).toMatchObject({
      blockers: [],
      index: { compatible: false, safeToCreate: true },
      readyForDeployment: false,
    });

    const ensured = await ensureTasterSessionIndexes(mongoose.connection);
    expect(ensured).toMatchObject({
      ready: true,
      pendingMissingOrUnnormalizedEmailCount: 0,
      duplicatePendingNormalizedEmailGroups: 0,
      index: { compatible: true },
    });
    await expect(
      inspectTasterSessionReleasePrerequisite(mongoose.connection)
    ).resolves.toMatchObject({
      ready: true,
      pendingMissingOrUnnormalizedEmailCount: 0,
      duplicatePendingNormalizedEmailGroups: 0,
      index: { compatible: true },
    });
    await expect(
      collection.insertOne(canonicalRequest('pending@example.test', 'pending'))
    ).rejects.toMatchObject({ code: 11000 });
    await expect(
      collection.insertOne(canonicalRequest('terminal@example.test', 'invited'))
    ).resolves.toBeDefined();
  });

  it('keeps runtime model startup read-only until readiness explicitly owns index creation', async () => {
    const collection = mongoose.connection.db!.collection(
      TASTER_SESSION_COLLECTION
    );
    await collection.insertMany([
      canonicalRequest('duplicate@example.test', 'pending'),
      canonicalRequest('duplicate@example.test', 'pending'),
    ]);
    const unsafeStartupIndexes =
      await initializeProductionStyleTasterSessionModel(mongoUri);
    expect(unsafeStartupIndexes).toEqual([]);
    expect(
      (await collection.indexes()).filter((index) => index.name !== '_id_')
    ).toHaveLength(0);

    const blocked = await inspectTasterSessionReadiness(mongoose.connection);
    expect(blocked.blockers).toContain('duplicate_pending_normalized_email');

    await collection.deleteMany({});
    await collection.insertMany([
      canonicalRequest('pending@example.test', 'pending'),
      canonicalRequest('terminal@example.test', 'invited'),
    ]);
    await ensureTasterSessionIndexes(mongoose.connection);
    const indexDiff = await TasterSessionRequestModel.diffIndexes();
    expect(indexDiff).toEqual({ toDrop: [], toCreate: [] });
    expect(
      (await collection.indexes()).filter(
        (index) => index.name === TASTER_SESSION_PENDING_EMAIL_INDEX
      )
    ).toHaveLength(1);

    const safeStartupIndexes =
      await initializeProductionStyleTasterSessionModel(mongoUri);
    expect(safeStartupIndexes).toEqual([]);
    expect(
      (await collection.indexes()).filter(
        (index) => index.name === TASTER_SESSION_PENDING_EMAIL_INDEX
      )
    ).toHaveLength(1);
    await expect(
      collection.insertOne(canonicalRequest('pending@example.test', 'pending'))
    ).rejects.toMatchObject({ code: 11000 });
  });
});
