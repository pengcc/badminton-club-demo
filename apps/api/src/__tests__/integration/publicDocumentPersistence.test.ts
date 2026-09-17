import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import mongoose, { Types } from 'mongoose';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { PublicDocument } from '../../models/PublicDocument';
import { PublicDocumentService } from '../../services/publicDocumentService';
import { PublicDocumentOwnedFileStore } from '../../services/publicDocumentOwnedFileStore';

let mongoLease: MongoTestDatabaseLease;
let uploadsRoot = '';
let files: PublicDocumentOwnedFileStore;
let service: PublicDocumentService;
const originalUri = process.env.MONGODB_URI;
const actorId = new Types.ObjectId().toString();
const pdf = Buffer.from('%PDF-1.7\nmock');
const upload = { buffer: pdf, mimetype: 'application/pdf', size: pdf.length };
const values = {
  displayName: { de: 'Satzung', en: 'Statutes', zh: '章程' },
  documentDate: '2012-06-09',
  isVisible: true,
};

async function stored(overrides: Record<string, unknown> = {}) {
  return PublicDocument.create({
    ...values,
    fileUrl: '/documents/Satzung.pdf',
    order: 0,
    createdBy: actorId,
    updatedBy: actorId,
    ...overrides,
  });
}

function legacyCollection() {
  return mongoose.connection.collection('publicdocuments');
}

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('publicDocument');
  process.env.MONGODB_URI = mongoLease.uri;
  uploadsRoot = await mkdtemp(
    path.join(tmpdir(), 'club-public-document-uploads-')
  );
  files = new PublicDocumentOwnedFileStore(uploadsRoot);
  service = new PublicDocumentService(files);
  mongoLease.assertOwnedDatabase();
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await PublicDocument.collection.deleteMany({});
  await legacyCollection()
    .drop()
    .catch(() => undefined);
  await rm(uploadsRoot, { recursive: true, force: true });
  uploadsRoot = await mkdtemp(
    path.join(tmpdir(), 'club-public-document-uploads-')
  );
  files = new PublicDocumentOwnedFileStore(uploadsRoot);
  service = new PublicDocumentService(files);
});

afterAll(async () => {
  try {
    await mongoLease.release();
  } finally {
    if (originalUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalUri;
    await rm(uploadsRoot, { recursive: true, force: true });
  }
});

describe('Public Document collection persistence', () => {
  it('keeps an empty collection valid and never recreates fixed records', async () => {
    expect(PublicDocument.collection.collectionName).toBe(
      'publicdocumentitems'
    );
    await expect(service.listAdministration()).resolves.toEqual([]);
    await expect(service.listPublic()).resolves.toEqual([]);
    expect(await PublicDocument.countDocuments()).toBe(0);
  });

  it('uses the new collection without reading or changing legacy fixed-slot state', async () => {
    const oldCollection = legacyCollection();
    await oldCollection.createIndex(
      { slot: 1 },
      { unique: true, name: 'legacy_public_document_slot' }
    );
    const legacyDocuments = [
      {
        _id: new Types.ObjectId(),
        slot: 'fee-regulation',
        displayName: { de: 'Beitragsordnung', en: '', zh: '' },
        documentDate: '2024-12-04',
        fileUrl: '/documents/Beitragsordnung.pdf',
        isVisible: true,
      },
      {
        _id: new Types.ObjectId(),
        slot: 'statutes',
        displayName: values.displayName,
        documentDate: values.documentDate,
        fileUrl: '/documents/Satzung.pdf',
        isVisible: true,
      },
    ];
    await oldCollection.insertMany(legacyDocuments);

    await expect(service.listAdministration()).resolves.toEqual([]);
    await service.create(values, upload, actorId);
    await service.create(
      {
        ...values,
        displayName: { ...values.displayName, de: 'Aufnahmeordnung' },
      },
      upload,
      actorId
    );

    expect(await PublicDocument.countDocuments()).toBe(2);
    expect(await oldCollection.find({}).sort({ slot: 1 }).toArray()).toEqual(
      [...legacyDocuments].sort((left, right) =>
        left.slot.localeCompare(right.slot)
      )
    );
    expect(await oldCollection.indexExists('legacy_public_document_slot')).toBe(
      true
    );
  });

  it('creates multiple slotless documents with new owned PDFs and append order', async () => {
    const first = await service.create(values, upload, actorId);
    const second = await service.create(
      {
        ...values,
        displayName: { ...values.displayName, de: 'Beitragsordnung' },
      },
      upload,
      actorId
    );
    expect([first.document.order, second.document.order]).toEqual([0, 1]);
    expect(first.document.toObject()).not.toHaveProperty('slot');
    expect(second.document.fileUrl).toContain(
      `/public-documents/${second.document.id}/`
    );
    expect(
      await readFile(
        path.join(uploadsRoot, second.document.fileUrl.replace('/uploads/', ''))
      )
    ).toEqual(pdf);
  });

  it('requires a new PDF and compensates promoted bytes when create persistence fails', async () => {
    await expect(
      service.create(values, undefined, actorId)
    ).rejects.toMatchObject({
      code: 'PUBLIC_DOCUMENT_PDF_REQUIRED',
    });
    const save = PublicDocument.prototype.save;
    PublicDocument.prototype.save = async function failSave() {
      throw new Error('simulated create failure');
    } as typeof save;
    try {
      await expect(service.create(values, upload, actorId)).rejects.toThrow(
        'simulated create failure'
      );
    } finally {
      PublicDocument.prototype.save = save;
    }
    const remaining = await readdir(
      path.join(uploadsRoot, 'public-documents'),
      {
        recursive: true,
      }
    );
    expect(remaining.some((entry) => entry.endsWith('.pdf'))).toBe(false);
  });

  it('replaces, hides, and removes an owner-scoped PDF safely', async () => {
    const created = await service.create(values, upload, actorId);
    const replaced = await service.update(
      created.document.id,
      {
        ...values,
        documentDate: '2026-08-23',
        retainedFile: created.document.fileUrl,
      },
      upload,
      actorId
    );
    const replacementUrl = replaced.document.fileUrl;
    const removed = await service.update(
      created.document.id,
      { ...values, retainedFile: '', isVisible: false },
      undefined,
      actorId
    );
    expect(removed.document.fileUrl).toBe('');
    await expect(
      readFile(path.join(uploadsRoot, replacementUrl.replace('/uploads/', '')))
    ).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(service.listPublic()).resolves.toEqual([]);
  });

  it('retains the previous PDF and compensates a replacement when update persistence fails', async () => {
    const created = await service.create(values, upload, actorId);
    const previousUrl = created.document.fileUrl;
    const save = PublicDocument.prototype.save;
    PublicDocument.prototype.save = async function failSave() {
      throw new Error('simulated update failure');
    } as typeof save;
    try {
      await expect(
        service.update(
          created.document.id,
          { ...values, retainedFile: previousUrl },
          upload,
          actorId
        )
      ).rejects.toThrow('simulated update failure');
    } finally {
      PublicDocument.prototype.save = save;
    }
    expect((await PublicDocument.findById(created.document.id))?.fileUrl).toBe(
      previousUrl
    );
    const ownerFiles = await readdir(
      path.join(uploadsRoot, 'public-documents', created.document.id)
    );
    expect(ownerFiles).toHaveLength(1);
  });

  it('rejects visible file removal and malformed IDs without changing state', async () => {
    const document = await stored();
    await expect(
      service.update(
        document.id,
        { ...values, retainedFile: '', isVisible: true },
        undefined,
        actorId
      )
    ).rejects.toMatchObject({ code: 'VISIBLE_PUBLIC_DOCUMENT_REQUIRES_FILE' });
    await expect(
      service.update(
        'bad-id',
        { ...values, retainedFile: document.fileUrl },
        undefined,
        actorId
      )
    ).rejects.toMatchObject({ code: 'INVALID_PUBLIC_DOCUMENT_ID' });
    await expect(
      service.update(
        new Types.ObjectId().toString(),
        { ...values, retainedFile: '' },
        undefined,
        actorId
      )
    ).rejects.toMatchObject({ statusCode: 404 });
    expect((await PublicDocument.findById(document.id))?.fileUrl).toBe(
      document.fileUrl
    );
  });

  it('orders all managed records, including hidden and fileless records', async () => {
    const first = await stored({ order: 0 });
    const hidden = await stored({ order: 1, isVisible: false });
    const fileless = await stored({ order: 2, fileUrl: '', isVisible: false });
    const reordered = await service.reorder(
      [fileless.id, first.id, hidden.id],
      actorId
    );
    expect(reordered.map((document) => document.id)).toEqual([
      fileless.id,
      first.id,
      hidden.id,
    ]);
    expect(reordered.map((document) => document.order)).toEqual([0, 1, 2]);
    expect((await service.listPublic()).map((document) => document.id)).toEqual(
      [first.id]
    );
  });

  it('rejects incomplete and duplicate order commands', async () => {
    const first = await stored({ order: 0 });
    await stored({ order: 1 });
    await expect(service.reorder([first.id], actorId)).rejects.toMatchObject({
      code: 'PUBLIC_DOCUMENT_ORDER_CONFLICT',
    });
    await expect(
      service.reorder([first.id, first.id], actorId)
    ).rejects.toMatchObject({
      code: 'INVALID_PUBLIC_DOCUMENT_ORDER',
    });
  });

  it('does not report reorder success when readback cannot confirm it', async () => {
    const first = await stored({ order: 0 });
    const second = await stored({ order: 1 });
    const snapshot = await service.listAdministration();
    const list = vi
      .spyOn(service, 'listAdministration')
      .mockResolvedValueOnce(snapshot)
      .mockResolvedValueOnce([...snapshot].reverse());
    await expect(
      service.reorder([first.id, second.id], actorId)
    ).rejects.toMatchObject({ code: 'PUBLIC_DOCUMENT_ORDER_UNCONFIRMED' });
    list.mockRestore();
  });

  it('permanently deletes records while preserving static files outside upload ownership', async () => {
    const document = await stored();
    const cleanup = vi.spyOn(files, 'removeOwned');
    await expect(service.delete(document.id)).resolves.toEqual({
      deleted: true,
      mediaCleanupWarning: null,
    });
    expect(await PublicDocument.findById(document.id)).toBeNull();
    expect(cleanup).toHaveBeenCalledWith(document.id, [document.fileUrl]);
  });

  it('reports owned-file cleanup failure separately after successful deletion', async () => {
    const created = await service.create(values, upload, actorId);
    vi.spyOn(files, 'removeOwned').mockRejectedValueOnce(
      new Error('simulated cleanup failure')
    );
    const outcome = await service.delete(created.document.id);
    expect(outcome).toMatchObject({
      deleted: true,
      mediaCleanupWarning: { code: 'PUBLIC_DOCUMENT_CLEANUP_FAILED' },
    });
    expect(await PublicDocument.findById(created.document.id)).toBeNull();
  });

  it('does not delete or clean a concurrently replaced owned PDF', async () => {
    const created = await service.create(values, upload, actorId);
    const originalDeleteOne = PublicDocument.deleteOne.bind(PublicDocument);
    let replacementUrl = '';
    const deletion = vi
      .spyOn(PublicDocument, 'deleteOne')
      .mockImplementationOnce((async (filter: unknown) => {
        const replaced = await service.update(
          created.document.id,
          {
            ...values,
            documentDate: '2026-08-24',
            retainedFile: created.document.fileUrl,
          },
          upload,
          actorId
        );
        replacementUrl = replaced.document.fileUrl;
        return originalDeleteOne(filter as never);
      }) as never);

    await expect(service.delete(created.document.id)).rejects.toMatchObject({
      code: 'PUBLIC_DOCUMENT_DELETE_CONFLICT',
    });
    deletion.mockRestore();

    expect(replacementUrl).not.toBe(created.document.fileUrl);
    expect((await PublicDocument.findById(created.document.id))?.fileUrl).toBe(
      replacementUrl
    );
    await expect(
      readFile(path.join(uploadsRoot, replacementUrl.replace('/uploads/', '')))
    ).resolves.toEqual(pdf);
  });
});
