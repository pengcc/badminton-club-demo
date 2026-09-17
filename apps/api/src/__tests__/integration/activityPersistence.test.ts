import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Activity } from '../../models/Activity';
import { Announcement } from '../../models/Announcement';
import { AuthSession } from '../../models/AuthSession';
import { ContactEntry } from '../../models/ContactEntry';
import { Location } from '../../models/Location';
import { Settings } from '../../models/Settings';
import { ActivityOwnedFileStore } from '../../services/activityOwnedFileStore';
import { ActivityService } from '../../services/activityService';
import { seedData } from '../../scripts/seedData';
import { ensureCanonicalSettings } from '../../scripts/seedSettings';
import {
  DEVELOPMENT_ACTIVITIES,
  DEVELOPMENT_ANNOUNCEMENTS,
} from '../../scripts/developmentPublicContentFixtures';

let mongoLease: MongoTestDatabaseLease;
let databaseName = '';
let uploadsRoot = '';
let service: ActivityService;
const originalDatabaseUri = process.env.MONGODB_URI;

const actorId = new Types.ObjectId().toString();
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const upload = { buffer: png, mimetype: 'image/png', size: png.length };
const values = {
  translations: {
    de: { name: 'Sommerfest', description: 'Deutsch' },
    en: { name: '', description: '' },
    zh: { name: '夏日活动', description: '中文' },
  },
  retainedImages: [] as string[],
  videoLink: 'https://example.test/video',
  videoDescription: { de: 'Video', en: '', zh: '' },
  isVisible: true,
  order: 1,
};

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('activity');
  databaseName = mongoLease.databaseName;
  process.env.MONGODB_URI = mongoLease.uri;
  uploadsRoot = await mkdtemp(
    path.join(tmpdir(), `club-${databaseName}-uploads-`)
  );
  service = new ActivityService(new ActivityOwnedFileStore(uploadsRoot));
  mongoLease.assertOwnedDatabase();
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await Promise.all([
    Activity.deleteMany({}),
    AuthSession.deleteMany({}),
    ContactEntry.deleteMany({}),
    Settings.deleteMany({}),
  ]);
  await rm(uploadsRoot, { recursive: true, force: true });
  uploadsRoot = await mkdtemp(
    path.join(tmpdir(), `club-${databaseName}-uploads-`)
  );
  service = new ActivityService(new ActivityOwnedFileStore(uploadsRoot));
});

afterAll(async () => {
  try {
    await mongoLease.release();
  } finally {
    if (originalDatabaseUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalDatabaseUri;
    await rm(uploadsRoot, { recursive: true, force: true });
  }
});

describe('Activity persistence and media ownership', () => {
  it('keeps availability missing-as-disabled and preserves content and administrator choice', async () => {
    expect(await service.getAvailability()).toEqual({ enabled: false });
    expect(await Settings.countDocuments()).toBe(0);

    await Settings.collection.insertOne({
      notificationRecipients: {
        applicationAlerts: { additional: [] },
        tasterSessionAlerts: { additional: [] },
        guestPlayAlerts: { additional: [] },
      },
      membershipOpen: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(await service.getAvailability()).toEqual({ enabled: false });
    expect(
      (await Settings.collection.findOne({}))?.activitiesEnabled
    ).toBeUndefined();

    const activity = await service.create(values, [upload], actorId);
    const before = await Activity.findById(activity.id).lean();
    expect(await service.updateAvailability(true, actorId)).toEqual({
      enabled: true,
    });
    await ensureCanonicalSettings();
    expect(await service.getAvailability()).toEqual({ enabled: true });
    expect(await Activity.findById(activity.id).lean()).toMatchObject({
      translations: before?.translations,
      images: before?.images,
      isVisible: before?.isVisible,
      order: before?.order,
    });

    expect(await service.updateAvailability(false, actorId)).toEqual({
      enabled: false,
    });
    expect((await Activity.findById(activity.id))?.images).toEqual(
      before?.images
    );
  });

  it('creates localized Activity content with an owner-scoped image', async () => {
    const activity = await service.create(values, [upload], actorId);

    expect(activity.videoDescription).toMatchObject(values.videoDescription);
    expect(activity.images).toHaveLength(1);
    expect(activity.images[0]).toContain(`/activities/${activity.id}/`);
    expect(
      await readFile(
        path.join(uploadsRoot, activity.images[0].replace('/uploads/', ''))
      )
    ).toEqual(png);
  });

  it('replaces an owned image only after the Activity update commits', async () => {
    const activity = await service.create(values, [upload], actorId);
    const originalUrl = activity.images[0];
    const updated = await service.update(
      activity.id,
      { ...values, retainedImages: [], order: 2 },
      [upload],
      actorId
    );

    expect(updated.activity.images).toHaveLength(1);
    expect(updated.activity.images[0]).not.toBe(originalUrl);
    expect(updated.mediaCleanupWarning).toBeNull();
    await expect(
      readFile(path.join(uploadsRoot, originalUrl.replace('/uploads/', '')))
    ).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await Activity.findById(activity.id))?.order).toBe(2);
  });

  it('preserves a legacy file reference while deleting its Activity record', async () => {
    const legacyPath = path.join(uploadsRoot, 'legacy.jpg');
    await writeFile(legacyPath, png);
    const activity = await Activity.create({
      ...values,
      images: ['/uploads/legacy.jpg'],
      createdBy: actorId,
      updatedBy: actorId,
    });

    await service.delete(activity.id);

    expect(await Activity.findById(activity.id)).toBeNull();
    expect(await readFile(legacyPath)).toEqual(png);
  });

  it('toggles visibility through the Activity owner', async () => {
    const activity = await service.create(values, [], actorId);
    const hidden = await service.toggle(activity.id, actorId);
    expect(hidden.isVisible).toBe(false);
    expect((await Activity.findById(activity.id))?.isVisible).toBe(false);
  });

  it('fully resets legacy-schema Activities and only verified owner files', async () => {
    const activityId = new Types.ObjectId();
    const orphanActivityId = new Types.ObjectId();
    const filename = `${randomUUID()}.png`;
    const ownerDirectory = path.join(
      uploadsRoot,
      'activities',
      activityId.toString()
    );
    const ownedFile = path.join(ownerDirectory, filename);
    const orphanFile = path.join(
      uploadsRoot,
      'activities',
      orphanActivityId.toString(),
      `${randomUUID()}.png`
    );
    const stagedFile = path.join(
      uploadsRoot,
      '.staging',
      'activities',
      `${activityId}-interrupted`,
      randomUUID()
    );
    const legacyFile = path.join(uploadsRoot, 'legacy.png');
    await mkdir(ownerDirectory, { recursive: true });
    await mkdir(path.dirname(orphanFile), { recursive: true });
    await mkdir(path.dirname(stagedFile), { recursive: true });
    await writeFile(ownedFile, png);
    await writeFile(orphanFile, png);
    await writeFile(stagedFile, png);
    await writeFile(legacyFile, png);
    await Activity.collection.insertOne({
      _id: activityId,
      translations: values.translations,
      images: [`/uploads/activities/${activityId}/${filename}`],
      videoDescription: 'legacy string value',
      isVisible: true,
      order: 0,
      createdBy: new Types.ObjectId(actorId),
      updatedBy: new Types.ObjectId(actorId),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await seedData('all', {
      target: { kind: 'test', expectedDatabaseName: databaseName },
      activityUploadsRoot: uploadsRoot,
      contactUploadsRoot: uploadsRoot,
      publicDocumentUploadsRoot: uploadsRoot,
    });

    expect(await Activity.countDocuments()).toBe(DEVELOPMENT_ACTIVITIES.length);
    expect(await Announcement.countDocuments()).toBe(
      DEVELOPMENT_ANNOUNCEMENTS.length
    );
    expect(await Location.countDocuments()).toBe(2);
    expect(await service.getAvailability()).toEqual({ enabled: false });
    expect(
      await Activity.find({ isVisible: true }).sort({ order: 1 }).lean()
    ).toMatchObject(DEVELOPMENT_ACTIVITIES);
    await expect(readFile(ownedFile)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(orphanFile)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(readFile(stagedFile)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(await readFile(legacyFile)).toEqual(png);

    await mkdir(path.dirname(orphanFile), { recursive: true });
    await mkdir(path.dirname(stagedFile), { recursive: true });
    await writeFile(orphanFile, png);
    await writeFile(stagedFile, png);

    await seedData('all', {
      target: { kind: 'test', expectedDatabaseName: databaseName },
      activityUploadsRoot: uploadsRoot,
      contactUploadsRoot: uploadsRoot,
      publicDocumentUploadsRoot: uploadsRoot,
    });

    expect(await Activity.countDocuments()).toBe(DEVELOPMENT_ACTIVITIES.length);
    expect(await Announcement.countDocuments()).toBe(
      DEVELOPMENT_ANNOUNCEMENTS.length
    );
    expect(await Location.countDocuments()).toBe(2);

    await expect(readFile(orphanFile)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(readFile(stagedFile)).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(await readFile(legacyFile)).toEqual(png);
  }, 120_000);

  it.each([
    'cross-owner',
    'traversal',
  ] as const)('stops a reset before deleting Activities for a forged %s reference', async (forgery) => {
    const activityId = new Types.ObjectId();
    const differentOwnerId = new Types.ObjectId();
    const authSessionId = new Types.ObjectId();
    const forgedFile = path.join(
      uploadsRoot,
      'activities',
      differentOwnerId.toString(),
      `${randomUUID()}.png`
    );
    const contactSentinel = path.join(
      uploadsRoot,
      'contact-qr',
      new Types.ObjectId().toString(),
      `${randomUUID()}.png`
    );
    await mkdir(path.dirname(forgedFile), { recursive: true });
    await mkdir(path.dirname(contactSentinel), { recursive: true });
    await writeFile(forgedFile, png);
    await writeFile(contactSentinel, png);
    const forgedReference =
      forgery === 'cross-owner'
        ? `/uploads/activities/${differentOwnerId}/${path.basename(forgedFile)}`
        : `/uploads/activities/${activityId}/../escape.png`;
    await Activity.collection.insertOne({
      _id: activityId,
      translations: values.translations,
      images: [forgedReference],
      videoDescription: 'legacy string value',
      isVisible: true,
      order: 0,
      createdBy: new Types.ObjectId(actorId),
      updatedBy: new Types.ObjectId(actorId),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await AuthSession.collection.insertOne({
      _id: authSessionId,
      userId: new Types.ObjectId(),
      tokenDigest: 'reset-refusal-sentinel',
      generation: 0,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      seedData('all', {
        target: { kind: 'test', expectedDatabaseName: databaseName },
        activityUploadsRoot: uploadsRoot,
        contactUploadsRoot: uploadsRoot,
        publicDocumentUploadsRoot: uploadsRoot,
      })
    ).rejects.toMatchObject({
      code: 'ACTIVITY_FILE_OWNERSHIP_UNVERIFIED',
    });

    expect(await Activity.countDocuments()).toBe(1);
    expect(await AuthSession.findById(authSessionId)).not.toBeNull();
    expect(await readFile(forgedFile)).toEqual(png);
    expect(await readFile(contactSentinel)).toEqual(png);
  }, 120_000);

  it('stops a reset before any mutation for a forged Contact QR reference', async () => {
    const activityId = new Types.ObjectId();
    const contactId = new Types.ObjectId();
    const differentContactOwnerId = new Types.ObjectId();
    const authSessionId = new Types.ObjectId();
    const activityFile = path.join(
      uploadsRoot,
      'activities',
      activityId.toString(),
      `${randomUUID()}.png`
    );
    const forgedContactFile = path.join(
      uploadsRoot,
      'contact-qr',
      differentContactOwnerId.toString(),
      `${randomUUID()}.png`
    );
    await mkdir(path.dirname(activityFile), { recursive: true });
    await mkdir(path.dirname(forgedContactFile), { recursive: true });
    await writeFile(activityFile, png);
    await writeFile(forgedContactFile, png);
    await Activity.collection.insertOne({
      _id: activityId,
      translations: values.translations,
      images: [
        `/uploads/activities/${activityId}/${path.basename(activityFile)}`,
      ],
      isVisible: true,
      order: 0,
      createdBy: new Types.ObjectId(actorId),
      updatedBy: new Types.ObjectId(actorId),
    });
    await ContactEntry.collection.insertOne({
      _id: contactId,
      qrCode: `/uploads/contact-qr/${differentContactOwnerId}/${path.basename(forgedContactFile)}`,
    });
    await AuthSession.collection.insertOne({
      _id: authSessionId,
      userId: new Types.ObjectId(),
      tokenDigest: 'contact-reset-refusal-sentinel',
      generation: 0,
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      seedData('all', {
        target: { kind: 'test', expectedDatabaseName: databaseName },
        activityUploadsRoot: uploadsRoot,
        contactUploadsRoot: uploadsRoot,
        publicDocumentUploadsRoot: uploadsRoot,
      })
    ).rejects.toMatchObject({
      code: 'CONTACT_QR_OWNERSHIP_UNVERIFIED',
    });

    expect(await Activity.findById(activityId)).not.toBeNull();
    expect(await ContactEntry.findById(contactId)).not.toBeNull();
    expect(await AuthSession.findById(authSessionId)).not.toBeNull();
    expect(await readFile(activityFile)).toEqual(png);
    expect(await readFile(forgedContactFile)).toEqual(png);
  }, 120_000);
});
