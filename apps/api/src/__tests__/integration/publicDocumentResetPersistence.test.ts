import { randomUUID } from 'node:crypto';
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PublicDocument } from '../../models/PublicDocument';
import { seedData } from '../../scripts/seedData';
import { PublicDocumentOwnedFileStore } from '../../services/publicDocumentOwnedFileStore';
import { PublicDocumentService } from '../../services/publicDocumentService';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';

let mongoLease: MongoTestDatabaseLease;
let uploadsRoot = '';
const originalMongoUri = process.env.MONGODB_URI;
const originalNodeEnvironment = process.env.NODE_ENV;
const actorId = new Types.ObjectId().toString();
const pdf = Buffer.from('%PDF-1.7\nreset-test');
const upload = { buffer: pdf, mimetype: 'application/pdf', size: pdf.length };
const values = {
  displayName: { de: 'Satzung', en: 'Statutes', zh: '章程' },
  documentDate: '2012-06-09',
  isVisible: true,
};

function legacyCollection() {
  const database = mongoose.connection.db;
  if (!database) throw new Error('MongoDB connection was not established');
  return database.collection('publicdocuments');
}

async function resetUploadRoot() {
  if (uploadsRoot) await rm(uploadsRoot, { recursive: true, force: true });
  uploadsRoot = await mkdtemp(
    path.join(tmpdir(), `club-${mongoLease.databaseName}-public-documents-`)
  );
}

async function runReset(mode: 'all' | 'content') {
  await seedData(mode, {
    target: { kind: 'test', expectedDatabaseName: mongoLease.databaseName },
    activityUploadsRoot: uploadsRoot,
    contactUploadsRoot: uploadsRoot,
    publicDocumentUploadsRoot: uploadsRoot,
  });
}

async function createLegacyCollection() {
  const database = mongoose.connection.db;
  if (!database) throw new Error('MongoDB connection was not established');
  await database.createCollection('publicdocuments', {
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['slot'],
        properties: {
          slot: { enum: ['fee-regulation', 'statutes'] },
        },
      },
    },
  });
  await legacyCollection().createIndex(
    { slot: 1 },
    { unique: true, name: 'legacy_public_document_slot' }
  );
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('publicDocumentReset');
  process.env.MONGODB_URI = mongoLease.uri;
  process.env.NODE_ENV = 'test';
  await resetUploadRoot();
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await mongoose.connection.dropDatabase();
  await resetUploadRoot();
});

afterAll(async () => {
  try {
    await mongoLease.release();
  } finally {
    if (originalMongoUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalMongoUri;
    if (originalNodeEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnvironment;
    await rm(uploadsRoot, { recursive: true, force: true });
  }
});

describe('Public Documents destructive reset persistence', () => {
  it.each([
    'all',
    'content',
  ] as const)('converges %s reset to empty dynamic state and removes legacy residue safely', async (mode) => {
    const currentId = new Types.ObjectId();
    const legacyOwnedId = new Types.ObjectId();
    const legacyStaticId = new Types.ObjectId();
    const currentFile = path.join(
      uploadsRoot,
      'public-documents',
      currentId.toString(),
      `${randomUUID()}.pdf`
    );
    const legacyOwnedFile = path.join(
      uploadsRoot,
      'public-documents',
      legacyOwnedId.toString(),
      `${randomUUID()}.pdf`
    );
    const orphanFile = path.join(
      uploadsRoot,
      'public-documents',
      new Types.ObjectId().toString(),
      `${randomUUID()}.pdf`
    );
    const stagedFile = path.join(
      uploadsRoot,
      '.staging',
      'public-documents',
      `${currentId}-interrupted`,
      randomUUID()
    );
    const unrelatedFile = path.join(uploadsRoot, 'unrelated', 'sentinel.txt');
    const staticEquivalentFile = path.join(
      uploadsRoot,
      'documents',
      'Satzung.pdf'
    );

    await Promise.all(
      [
        currentFile,
        legacyOwnedFile,
        orphanFile,
        stagedFile,
        unrelatedFile,
        staticEquivalentFile,
      ].map((file) => mkdir(path.dirname(file), { recursive: true }))
    );
    await Promise.all([
      writeFile(currentFile, pdf),
      writeFile(legacyOwnedFile, pdf),
      writeFile(orphanFile, pdf),
      writeFile(stagedFile, pdf),
      writeFile(unrelatedFile, 'keep'),
      writeFile(staticEquivalentFile, pdf),
    ]);

    await PublicDocument.collection.insertOne({
      _id: currentId,
      ...values,
      fileUrl: `/uploads/public-documents/${currentId}/${path.basename(currentFile)}`,
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await createLegacyCollection();
    await legacyCollection().insertMany([
      {
        _id: legacyOwnedId,
        slot: 'fee-regulation',
        fileUrl: `/uploads/public-documents/${legacyOwnedId}/${path.basename(legacyOwnedFile)}`,
      },
      {
        _id: legacyStaticId,
        slot: 'statutes',
        fileUrl: '/documents/Satzung.pdf',
      },
    ]);

    await runReset(mode);

    expect(await PublicDocument.countDocuments()).toBe(0);
    expect(
      await mongoose.connection.db
        ?.listCollections({ name: 'publicdocuments' })
        .hasNext()
    ).toBe(false);
    for (const removed of [
      currentFile,
      legacyOwnedFile,
      orphanFile,
      stagedFile,
    ]) {
      await expect(access(removed)).rejects.toMatchObject({ code: 'ENOENT' });
    }
    expect(await readFile(unrelatedFile, 'utf8')).toBe('keep');
    expect(await readFile(staticEquivalentFile)).toEqual(pdf);

    await runReset(mode);
    expect(await PublicDocument.countDocuments()).toBe(0);
    expect(
      await mongoose.connection.db
        ?.listCollections({ name: 'publicdocuments' })
        .hasNext()
    ).toBe(false);

    const service = new PublicDocumentService(
      new PublicDocumentOwnedFileStore(uploadsRoot)
    );
    await service.create(values, upload, actorId);
    expect(await PublicDocument.countDocuments()).toBe(1);
    expect(PublicDocument.collection.collectionName).toBe(
      'publicdocumentitems'
    );
    expect(
      await mongoose.connection.db
        ?.listCollections({ name: 'publicdocuments' })
        .hasNext()
    ).toBe(false);
  }, 120_000);

  it('fails before database or file mutation for a forged legacy owner reference', async () => {
    const legacyId = new Types.ObjectId();
    const differentOwnerId = new Types.ObjectId();
    const canonicalId = new Types.ObjectId();
    const sentinelFile = path.join(
      uploadsRoot,
      'public-documents',
      differentOwnerId.toString(),
      `${randomUUID()}.pdf`
    );
    await mkdir(path.dirname(sentinelFile), { recursive: true });
    await writeFile(sentinelFile, pdf);
    await PublicDocument.collection.insertOne({
      _id: canonicalId,
      ...values,
      fileUrl: '/documents/Satzung.pdf',
      order: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await createLegacyCollection();
    await legacyCollection().insertOne({
      _id: legacyId,
      slot: 'statutes',
      fileUrl: `/uploads/public-documents/${differentOwnerId}/${path.basename(sentinelFile)}`,
    });

    await expect(runReset('content')).rejects.toMatchObject({
      code: 'PUBLIC_DOCUMENT_OWNERSHIP_UNVERIFIED',
    });

    expect(await PublicDocument.findById(canonicalId)).not.toBeNull();
    expect(await legacyCollection().countDocuments()).toBe(1);
    expect(await readFile(sentinelFile)).toEqual(pdf);
  });
});
