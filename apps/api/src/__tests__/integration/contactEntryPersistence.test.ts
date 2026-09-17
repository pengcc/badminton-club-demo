import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ContactEntry } from '../../models/ContactEntry';
import { ContactEntryService } from '../../services/contactEntryService';
import { ContactQrOwnedFileStore } from '../../services/contactQrOwnedFileStore';

let mongoLease: MongoTestDatabaseLease;
let uploadsRoot = '';
let service: ContactEntryService;
const originalUri = process.env.MONGODB_URI;
const actorId = new Types.ObjectId().toString();
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const upload = {
  buffer: png,
  mimetype: 'image/png',
  size: png.length,
  originalname: 'club-wechat.png',
};
const values = {
  category: 'General inquiries',
  title: { de: 'Kontakt', en: '', zh: '联系' },
  description: { de: 'Schreib uns.', en: '', zh: '请联系我们。' },
  email: 'info@example.test',
  retainedQrCode: '',
  qrExplanation: { de: 'QR', en: '', zh: '' },
  externalLink: '',
  externalLinkLabel: { de: '', en: '', zh: '' },
  isActive: true,
  order: 1,
};

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('contactEntry');
  process.env.MONGODB_URI = mongoLease.uri;
  uploadsRoot = await mkdtemp(
    path.join(tmpdir(), 'club-wp4b-contact-uploads-')
  );
  service = new ContactEntryService(new ContactQrOwnedFileStore(uploadsRoot));
  mongoLease.assertOwnedDatabase();
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await ContactEntry.deleteMany({});
  await rm(uploadsRoot, { recursive: true, force: true });
  uploadsRoot = await mkdtemp(
    path.join(tmpdir(), 'club-wp4b-contact-uploads-')
  );
  service = new ContactEntryService(new ContactQrOwnedFileStore(uploadsRoot));
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

describe('Contact entry persistence and QR ownership', () => {
  it('allows four entries, rejects a fifth before file effects, and allows another after deletion', async () => {
    const created = [];
    for (let index = 0; index < 4; index += 1) {
      created.push(
        await service.create(
          { ...values, category: `Contact ${index + 1}`, order: index },
          undefined,
          actorId
        )
      );
    }
    expect(await ContactEntry.countDocuments({})).toBe(4);
    const filesBefore = await readdir(uploadsRoot, { recursive: true });

    await expect(service.create(values, upload, actorId)).rejects.toMatchObject(
      {
        statusCode: 409,
        code: 'CONTACT_ENTRY_LIMIT_REACHED',
      }
    );
    expect(await ContactEntry.countDocuments({})).toBe(4);
    expect(await readdir(uploadsRoot, { recursive: true })).toEqual(
      filesBefore
    );

    await service.delete(created[0].id);
    await expect(
      service.create(values, undefined, actorId)
    ).resolves.toBeTruthy();
    expect(await ContactEntry.countDocuments({})).toBe(4);
  });

  it('creates, replaces, removes, hides, orders, and deletes owner-scoped Contact data', async () => {
    const created = await service.create(values, upload, actorId);
    const originalQr = created.qrCode;
    expect(created.qrCodeOriginalFilename).toBe('club-wechat.png');
    expect(
      await readFile(
        path.join(uploadsRoot, originalQr.replace('/uploads/', ''))
      )
    ).toEqual(png);

    const retained = await service.update(
      created.id,
      { ...values, retainedQrCode: originalQr },
      undefined,
      actorId
    );
    expect(retained.entry.qrCodeOriginalFilename).toBe('club-wechat.png');

    const replaced = await service.update(
      created.id,
      { ...values, retainedQrCode: originalQr, order: 3, isActive: false },
      { ...upload, originalname: 'replacement-qr.png' },
      actorId
    );
    expect(replaced.entry.qrCode).not.toBe(originalQr);
    expect(replaced.entry.qrCodeOriginalFilename).toBe('replacement-qr.png');
    expect(replaced.entry.order).toBe(3);
    expect(replaced.entry.isActive).toBe(false);
    await expect(
      readFile(path.join(uploadsRoot, originalQr.replace('/uploads/', '')))
    ).rejects.toMatchObject({ code: 'ENOENT' });

    const replacementQr = replaced.entry.qrCode;
    const removed = await service.update(
      created.id,
      { ...values, retainedQrCode: '', order: 2 },
      undefined,
      actorId
    );
    expect(removed.entry.qrCode).toBe('');
    expect(removed.entry.qrCodeOriginalFilename).toBe('');
    await expect(
      readFile(path.join(uploadsRoot, replacementQr.replace('/uploads/', '')))
    ).rejects.toMatchObject({ code: 'ENOENT' });

    await service.delete(created.id);
    expect(await ContactEntry.findById(created.id)).toBeNull();
  });

  it('preserves the previous QR and compensates a promoted replacement when persistence fails', async () => {
    const created = await service.create(values, upload, actorId);
    const originalQr = created.qrCode;
    const save = ContactEntry.prototype.save;
    ContactEntry.prototype.save = async function failSave() {
      throw new Error('simulated persistence failure');
    } as typeof save;
    try {
      await expect(
        service.update(
          created.id,
          { ...values, retainedQrCode: originalQr },
          upload,
          actorId
        )
      ).rejects.toThrow('simulated persistence failure');
    } finally {
      ContactEntry.prototype.save = save;
    }
    expect((await ContactEntry.findById(created.id))?.qrCode).toBe(originalQr);
    expect(
      await readFile(
        path.join(uploadsRoot, originalQr.replace('/uploads/', ''))
      )
    ).toEqual(png);
  });
});
