import { randomUUID } from 'node:crypto';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { MONGO_TEST_CONTEXT_KEY } from '../infrastructure/mongoTestConfig';
import {
  assertConnectedMongoTarget,
  assertDisposableMongoTarget,
} from '../../scripts/destructiveResetSafety';
import { seedData } from '../../scripts/seedData';
import { User } from '../../models/User';

let operatorUri = '';
const originalMongoUri = process.env.MONGODB_URI;
const originalNodeEnvironment = process.env.NODE_ENV;
const mongoTestContext = inject(MONGO_TEST_CONTEXT_KEY);
const describeTestcontainersOnly =
  mongoTestContext.serverMode === 'testcontainers' ? describe : describe.skip;

async function createTemporaryOperatorUploadRoots() {
  const expectedDatabaseName = `operator_reset_test_${randomUUID().replaceAll('-', '')}`;
  const activityUploadsRoot = await mkdtemp(
    path.join(tmpdir(), `club-${expectedDatabaseName}-activity-`)
  );
  const contactUploadsRoot = await mkdtemp(
    path.join(tmpdir(), `club-${expectedDatabaseName}-contact-`)
  );
  const publicDocumentUploadsRoot = await mkdtemp(
    path.join(tmpdir(), `club-${expectedDatabaseName}-public-documents-`)
  );
  const activitySentinel = path.join(
    activityUploadsRoot,
    'activities',
    'stale',
    'sentinel.jpg'
  );
  const contactSentinel = path.join(
    contactUploadsRoot,
    'contact-qr',
    'stale',
    'sentinel.png'
  );
  const publicDocumentSentinel = path.join(
    publicDocumentUploadsRoot,
    'public-documents',
    'stale',
    'sentinel.pdf'
  );
  await Promise.all([
    mkdir(path.dirname(activitySentinel), { recursive: true }),
    mkdir(path.dirname(contactSentinel), { recursive: true }),
    mkdir(path.dirname(publicDocumentSentinel), { recursive: true }),
  ]);
  await Promise.all([
    writeFile(activitySentinel, 'stale activity upload'),
    writeFile(contactSentinel, 'stale contact upload'),
    writeFile(publicDocumentSentinel, 'stale Public Document upload'),
  ]);

  return {
    activitySentinel,
    activityUploadsRoot,
    contactSentinel,
    contactUploadsRoot,
    publicDocumentSentinel,
    publicDocumentUploadsRoot,
    testFileTarget: { kind: 'test' as const, expectedDatabaseName },
  };
}

beforeAll(async () => {
  if (mongoTestContext.serverMode !== 'testcontainers') return;
  const uri = new URL(mongoTestContext.serverUri);
  uri.pathname = '/badminton-club-demo-dev';
  operatorUri = uri.toString();
  await mongoose.connect(operatorUri);
}, 120_000);

afterAll(async () => {
  if (mongoTestContext.serverMode !== 'testcontainers') return;
  try {
    if (mongoose.connection.readyState) {
      if (mongoose.connection.name !== 'badminton-club-demo-dev') {
        throw new Error(
          'Refusing to clean an unexpected operator-reset database'
        );
      }
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  } finally {
    if (originalMongoUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalMongoUri;
    if (originalNodeEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnvironment;
  }
});

describeTestcontainersOnly(
  'destructive reset replica-set evidence (requires Testcontainers server mode)',
  () => {
    it('accepts the actual one-member Testcontainers replica-set evidence', async () => {
      const admin = mongoose.connection.db?.admin();
      if (!admin) throw new Error('MongoDB connection was not established');

      const approvedTarget = assertDisposableMongoTarget(
        'mongodb://127.0.0.1:27017/badminton-club-demo-dev?replicaSet=rs0&directConnection=true',
        { kind: 'operator' },
        'development',
        undefined
      );
      const hello = await admin.command({ hello: 1 });
      const replicaSetConfiguration = await admin.command({
        replSetGetConfig: 1,
      });

      expect(() =>
        assertConnectedMongoTarget({
          connectedDatabaseName: mongoose.connection.name,
          approvedTarget,
          hello,
          replicaSetConfiguration,
        })
      ).not.toThrow();
    });

    it('runs the full operator reset path on a disposable replica set and reset-owned upload roots', async () => {
      const previousMongoUri = process.env.MONGODB_URI;
      const previousNodeEnvironment = process.env.NODE_ENV;
      const uploadRoots = await createTemporaryOperatorUploadRoots();
      process.env.MONGODB_URI = operatorUri;
      process.env.NODE_ENV = 'development';

      try {
        await User.collection.insertOne({
          email: 'operator-full-reset-sentinel@club.test',
        });
        await seedData('all', {
          target: { kind: 'operator' },
          testFileTarget: uploadRoots.testFileTarget,
          activityUploadsRoot: uploadRoots.activityUploadsRoot,
          contactUploadsRoot: uploadRoots.contactUploadsRoot,
          publicDocumentUploadsRoot: uploadRoots.publicDocumentUploadsRoot,
        });

        expect(mongoose.connection.name).toBe('badminton-club-demo-dev');
        expect(
          await User.collection.countDocuments({
            email: 'operator-full-reset-sentinel@club.test',
          })
        ).toBe(0);
        expect(await User.countDocuments()).toBeGreaterThan(0);
        await expect(
          access(uploadRoots.activitySentinel)
        ).rejects.toMatchObject({
          code: 'ENOENT',
        });
        await expect(access(uploadRoots.contactSentinel)).rejects.toMatchObject(
          {
            code: 'ENOENT',
          }
        );
        await expect(
          access(uploadRoots.publicDocumentSentinel)
        ).rejects.toMatchObject({ code: 'ENOENT' });
      } finally {
        if (previousMongoUri === undefined) delete process.env.MONGODB_URI;
        else process.env.MONGODB_URI = previousMongoUri;
        if (previousNodeEnvironment === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousNodeEnvironment;
        await Promise.all([
          rm(uploadRoots.activityUploadsRoot, { recursive: true, force: true }),
          rm(uploadRoots.contactUploadsRoot, { recursive: true, force: true }),
          rm(uploadRoots.publicDocumentUploadsRoot, {
            recursive: true,
            force: true,
          }),
        ]);
      }
    }, 120_000);

    it('refuses replica-set evidence classified as standalone before operator mutation', async () => {
      const previousMongoUri = process.env.MONGODB_URI;
      const previousNodeEnvironment = process.env.NODE_ENV;
      const standaloneUri = new URL(operatorUri);
      const uploadRoots = await createTemporaryOperatorUploadRoots();
      standaloneUri.searchParams.delete('replicaSet');
      process.env.MONGODB_URI = standaloneUri.toString();
      process.env.NODE_ENV = 'development';

      try {
        await mongoose.disconnect();
        await mongoose.connect(standaloneUri.toString());
        await User.collection.insertOne({
          email: 'operator-topology-sentinel@club.test',
        });

        await expect(
          seedData('all', {
            target: { kind: 'operator' },
            testFileTarget: uploadRoots.testFileTarget,
            activityUploadsRoot: uploadRoots.activityUploadsRoot,
            contactUploadsRoot: uploadRoots.contactUploadsRoot,
            publicDocumentUploadsRoot: uploadRoots.publicDocumentUploadsRoot,
          })
        ).rejects.toThrow('standalone target has replica-set evidence');
        expect(
          await User.collection.countDocuments({
            email: 'operator-topology-sentinel@club.test',
          })
        ).toBe(1);
        await expect(
          access(uploadRoots.activitySentinel)
        ).resolves.toBeUndefined();
        await expect(
          access(uploadRoots.contactSentinel)
        ).resolves.toBeUndefined();
        await expect(
          access(uploadRoots.publicDocumentSentinel)
        ).resolves.toBeUndefined();
      } finally {
        if (previousMongoUri === undefined) delete process.env.MONGODB_URI;
        else process.env.MONGODB_URI = previousMongoUri;
        if (previousNodeEnvironment === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previousNodeEnvironment;
        await Promise.all([
          rm(uploadRoots.activityUploadsRoot, { recursive: true, force: true }),
          rm(uploadRoots.contactUploadsRoot, { recursive: true, force: true }),
          rm(uploadRoots.publicDocumentUploadsRoot, {
            recursive: true,
            force: true,
          }),
        ]);
      }
    }, 120_000);
  }
);
