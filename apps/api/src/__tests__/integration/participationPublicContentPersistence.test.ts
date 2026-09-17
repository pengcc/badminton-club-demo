import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Language } from '@club/shared-types/core/enums';
import { EMPTY_TASTER_SESSION_PUBLIC_CONTENT } from '@club/shared-types/api/tasterSessionPublicContent';
import { EMPTY_MEMBERSHIP_PUBLIC_CONTENT } from '@club/shared-types/api/membershipPublicContent';
import { ContactEntry } from '../../models/ContactEntry';
import { TasterSessionPublicContent } from '../../models/TasterSessionPublicContent';
import { MembershipPublicContent } from '../../models/MembershipPublicContent';
import { RecruitmentPublicContent } from '../../models/RecruitmentPublicContent';
import { HomepageContent } from '../../models/Content';
import { ClubInformation } from '../../models/ClubInformation';
import { User } from '../../models/User';
import { EmailTemplate } from '../../models/EmailTemplate';
import { Activity } from '../../models/Activity';
import { Announcement } from '../../models/Announcement';
import { Location } from '../../models/Location';
import { PublicDocument } from '../../models/PublicDocument';
import { TasterSessionPublicContentService } from '../../services/tasterSessionPublicContentService';
import { MembershipPublicContentService } from '../../services/membershipPublicContentService';
import { ContactQrOwnedFileStore } from '../../services/contactQrOwnedFileStore';
import {
  bootstrapCanonicalContent,
  bootstrapCanonicalContentForAdministrator,
} from '../../scripts/bootstrapCanonicalContent';
import { seedData } from '../../scripts/seedData';
import {
  CANONICAL_CLUB_INFORMATION,
  CANONICAL_CONTACT_ENTRIES,
  CANONICAL_HOMEPAGE_CONTENT,
  CANONICAL_MEMBERSHIP_PUBLIC_CONTENT,
  CANONICAL_RECRUITMENT_PUBLIC_CONTENT,
  CANONICAL_TASTER_SESSION_PUBLIC_CONTENT,
} from '../../scripts/canonicalContentDefaults';
import {
  DEVELOPMENT_ACTIVITIES,
  DEVELOPMENT_ANNOUNCEMENTS,
  DEVELOPMENT_MEMBERSHIP_PUBLIC_CONTENT,
  DEVELOPMENT_RECRUITMENT_CONTACT,
  DEVELOPMENT_TASTER_SESSION_PUBLIC_CONTENT,
} from '../../scripts/developmentPublicContentFixtures';

let mongoLease: MongoTestDatabaseLease;
let databaseName = '';
let uploadsRoot = '';
const originalUri = process.env.MONGODB_URI;
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('participationPublicContent');
  databaseName = mongoLease.databaseName;
  process.env.MONGODB_URI = mongoLease.uri;
  uploadsRoot = await mkdtemp(
    path.join(tmpdir(), `club-${databaseName}-content-seed-`)
  );
  mongoLease.assertOwnedDatabase();
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await Promise.all([
    ContactEntry.deleteMany({}),
    TasterSessionPublicContent.deleteMany({}),
    MembershipPublicContent.deleteMany({}),
    RecruitmentPublicContent.deleteMany({}),
    HomepageContent.deleteMany({}),
    ClubInformation.deleteMany({}),
    User.deleteMany({}),
    EmailTemplate.deleteMany({}),
    Activity.deleteMany({}),
    Announcement.deleteMany({}),
    Location.deleteMany({}),
    PublicDocument.deleteMany({}),
  ]);
  await rm(uploadsRoot, { recursive: true, force: true });
  uploadsRoot = await mkdtemp(
    path.join(tmpdir(), `club-${databaseName}-content-seed-`)
  );
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

describe('WP4B and WP5B canonical persistence', () => {
  it('fails before canonical owner writes when administrator attribution is invalid', async () => {
    await expect(
      bootstrapCanonicalContentForAdministrator('missing@example.test')
    ).rejects.toThrow('selected existing administrator could not be verified');

    expect(await HomepageContent.countDocuments()).toBe(0);
    expect(await ClubInformation.countDocuments()).toBe(0);
    expect(await Location.countDocuments()).toBe(0);
    expect(await ContactEntry.countDocuments()).toBe(0);
    expect(await TasterSessionPublicContent.countDocuments()).toBe(0);
    expect(await MembershipPublicContent.countDocuments()).toBe(0);
    expect(await RecruitmentPublicContent.countDocuments()).toBe(0);
  });

  it('uses explicit administrator attribution without creating development-only data', async () => {
    const administratorId = new Types.ObjectId();
    await User.collection.insertOne({
      _id: administratorId,
      email: 'bootstrap.admin@example.test',
      accountKind: 'person',
      administratorDesignation: true,
      membershipStatus: 'active',
    });

    const summary = await bootstrapCanonicalContentForAdministrator(
      ' BOOTSTRAP.ADMIN@example.test '
    );

    expect(summary.created).toEqual([
      'homepage',
      'club',
      'locations',
      'contact',
      'taster-session',
      'membership',
      'recruitment',
    ]);
    expect(await Activity.countDocuments()).toBe(0);
    expect(await Announcement.countDocuments()).toBe(0);
    expect(await EmailTemplate.countDocuments()).toBe(0);
    expect(await PublicDocument.countDocuments()).toBe(0);
    expect((await HomepageContent.findOne())?.updatedBy).toEqual(
      administratorId
    );
  });

  it('bootstraps exactly the two approved Contact records and bounded content owners', async () => {
    const actor = new Types.ObjectId();
    await bootstrapCanonicalContent(actor);

    const contacts = await ContactEntry.find({}).sort({ order: 1 }).lean();
    expect(contacts).toHaveLength(2);
    expect(contacts).toMatchObject(
      CANONICAL_CONTACT_ENTRIES.map(
        ({ retainedQrCode: _unused, ...entry }) => ({
          ...entry,
          qrCode: '',
          createdBy: actor,
          updatedBy: actor,
        })
      )
    );
    expect((await TasterSessionPublicContent.findOne())?.content).toMatchObject(
      CANONICAL_TASTER_SESSION_PUBLIC_CONTENT
    );
    expect((await MembershipPublicContent.findOne())?.content).toMatchObject(
      CANONICAL_MEMBERSHIP_PUBLIC_CONTENT
    );
    expect((await RecruitmentPublicContent.findOne())?.content).toMatchObject(
      CANONICAL_RECRUITMENT_PUBLIC_CONTENT
    );
  });

  it('never overwrites existing Contact or participation content during bootstrap', async () => {
    const originalActor = new Types.ObjectId();
    const retainedContact = await ContactEntry.create({
      category: 'retained',
      title: { de: 'Behalten', en: '', zh: '' },
      description: { de: 'Nicht überschreiben', en: '', zh: '' },
      email: 'retained@example.test',
      qrCode: '',
      qrExplanation: { de: '', en: '', zh: '' },
      externalLink: '',
      externalLinkLabel: { de: '', en: '', zh: '' },
      isActive: false,
      order: 3,
      createdBy: originalActor,
      updatedBy: originalActor,
    });
    await TasterSessionPublicContent.create({
      singletonKey: 'taster-session',
      content: {
        ...CANONICAL_TASTER_SESSION_PUBLIC_CONTENT,
        homepageSummary: { de: 'Behalten', en: '', zh: '' },
      },
      updatedBy: originalActor,
    });
    await MembershipPublicContent.create({
      singletonKey: 'membership',
      content: {
        ...CANONICAL_MEMBERSHIP_PUBLIC_CONTENT,
        homepageSummary: { de: 'Behalten', en: '', zh: '' },
      },
      updatedBy: originalActor,
    });
    await RecruitmentPublicContent.create({
      singletonKey: 'recruitment',
      content: {
        ...CANONICAL_RECRUITMENT_PUBLIC_CONTENT,
        introduction: { de: 'Behalten', en: '', zh: '' },
      },
      updatedBy: originalActor,
    });

    await bootstrapCanonicalContent(new Types.ObjectId());

    expect(await ContactEntry.countDocuments()).toBe(1);
    expect((await ContactEntry.findById(retainedContact._id))?.category).toBe(
      'retained'
    );
    expect(
      (await TasterSessionPublicContent.findOne())?.content.homepageSummary.de
    ).toBe('Behalten');
    expect(
      (await MembershipPublicContent.findOne())?.content.homepageSummary.de
    ).toBe('Behalten');
    expect(
      (await RecruitmentPublicContent.findOne())?.content.introduction.de
    ).toBe('Behalten');
  });

  it('updates each owner coherently and resolves requested locale with German fallback', async () => {
    const actor = new Types.ObjectId().toString();
    await TasterSessionPublicContentService.updateContent(
      CANONICAL_TASTER_SESSION_PUBLIC_CONTENT,
      actor
    );
    await MembershipPublicContentService.updateContent(
      CANONICAL_MEMBERSHIP_PUBLIC_CONTENT,
      actor
    );

    await expect(
      TasterSessionPublicContentService.getPublicContent(Language.ENGLISH)
    ).resolves.toMatchObject({
      homepageSummary:
        CANONICAL_TASTER_SESSION_PUBLIC_CONTENT.homepageSummary.en,
    });
    const germanOnlyMembership = {
      ...CANONICAL_MEMBERSHIP_PUBLIC_CONTENT,
      membershipTypes: { de: 'Deutsch', en: '', zh: '' },
    };
    await MembershipPublicContentService.updateContent(
      germanOnlyMembership,
      actor
    );
    await expect(
      MembershipPublicContentService.getPublicContent(Language.CHINESE)
    ).resolves.toMatchObject({ membershipTypes: 'Deutsch' });
  });

  it('keeps missing content editable for administrators but unavailable publicly', async () => {
    await expect(
      TasterSessionPublicContentService.getAdministrationContent()
    ).resolves.toMatchObject({
      content: EMPTY_TASTER_SESSION_PUBLIC_CONTENT,
      updatedAt: null,
    });
    await expect(
      MembershipPublicContentService.getAdministrationContent()
    ).resolves.toMatchObject({
      content: EMPTY_MEMBERSHIP_PUBLIC_CONTENT,
      updatedAt: null,
    });

    await expect(
      TasterSessionPublicContentService.getPublicContent(Language.GERMAN)
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'TASTER_SESSION_PUBLIC_CONTENT_UNAVAILABLE',
    });
    await expect(
      MembershipPublicContentService.getPublicContent(Language.GERMAN)
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'MEMBERSHIP_PUBLIC_CONTENT_UNAVAILABLE',
    });
  });

  it('does not publish persisted content with empty required German fields', async () => {
    const actor = new Types.ObjectId();
    await TasterSessionPublicContent.collection.insertOne({
      singletonKey: 'taster-session',
      content: {
        ...CANONICAL_TASTER_SESSION_PUBLIC_CONTENT,
        homepageSummary: { de: '', en: '', zh: '' },
      },
      updatedBy: actor,
    });
    await MembershipPublicContent.collection.insertOne({
      singletonKey: 'membership',
      content: {
        ...CANONICAL_MEMBERSHIP_PUBLIC_CONTENT,
        membershipPath: { de: '', en: '', zh: '' },
      },
      updatedBy: actor,
    });

    await expect(
      TasterSessionPublicContentService.getPublicContent(Language.GERMAN)
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'TASTER_SESSION_PUBLIC_CONTENT_UNAVAILABLE',
    });
    await expect(
      MembershipPublicContentService.getPublicContent(Language.GERMAN)
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'MEMBERSHIP_PUBLIC_CONTENT_UNAVAILABLE',
    });
  });

  it('resets the development public-content owners repeatably without fabricating legal documents', async () => {
    const actor = new Types.ObjectId();
    await User.collection.insertOne({
      _id: actor,
      email: 'seed-admin@example.test',
      firstName: 'Seed',
      lastName: 'Admin',
      gender: 'male',
      dateOfBirth: '1990-01-01',
      accountKind: 'person',
      administratorDesignation: true,
      membershipStatus: 'active',
      isPlayer: false,
      accountOnboardingStatus: 'ready',
      passwordSetupGeneration: 0,
    });
    await HomepageContent.collection.insertOne({
      singletonKey: 'homepage',
      content: { stale: true },
      updatedBy: actor,
    });
    await ClubInformation.collection.insertOne({
      singletonKey: 'club',
      content: { stale: true },
      updatedBy: actor,
    });
    const contactId = new Types.ObjectId();
    const [qrCode] = await new ContactQrOwnedFileStore(
      uploadsRoot
    ).stageAndPromote(contactId.toString(), [
      { buffer: png, mimetype: 'image/png', size: png.length },
    ]);
    await ContactEntry.create({
      _id: contactId,
      category: 'stale',
      title: { de: 'Alt', en: '', zh: '' },
      description: { de: 'Alt', en: '', zh: '' },
      email: 'stale@example.test',
      qrCode,
      qrExplanation: { de: '', en: '', zh: '' },
      externalLink: '',
      externalLinkLabel: { de: '', en: '', zh: '' },
      isActive: true,
      order: 0,
      createdBy: actor,
      updatedBy: actor,
    });
    await TasterSessionPublicContent.create({
      singletonKey: 'taster-session',
      content: {
        ...CANONICAL_TASTER_SESSION_PUBLIC_CONTENT,
        homepageSummary: { de: 'Alt', en: '', zh: '' },
      },
      updatedBy: actor,
    });
    await MembershipPublicContent.create({
      singletonKey: 'membership',
      content: {
        ...CANONICAL_MEMBERSHIP_PUBLIC_CONTENT,
        homepageSummary: { de: 'Alt', en: '', zh: '' },
      },
      updatedBy: actor,
    });
    await RecruitmentPublicContent.create({
      singletonKey: 'recruitment',
      content: CANONICAL_RECRUITMENT_PUBLIC_CONTENT,
      updatedBy: actor,
    });
    const unrelated = await EmailTemplate.collection.insertOne({
      name: 'unrelated-template',
    });
    const qrFile = path.join(uploadsRoot, qrCode.replace('/uploads/', ''));

    await seedData('content', {
      target: { kind: 'test', expectedDatabaseName: databaseName },
      activityUploadsRoot: uploadsRoot,
      contactUploadsRoot: uploadsRoot,
      publicDocumentUploadsRoot: uploadsRoot,
    });
    await expect(readFile(qrFile)).rejects.toMatchObject({ code: 'ENOENT' });
    expect((await HomepageContent.findOne())?.content).toMatchObject(
      CANONICAL_HOMEPAGE_CONTENT
    );
    expect((await ClubInformation.findOne())?.content).toMatchObject(
      CANONICAL_CLUB_INFORMATION
    );
    expect(await ContactEntry.countDocuments()).toBe(3);
    expect((await TasterSessionPublicContent.findOne())?.content).toMatchObject(
      DEVELOPMENT_TASTER_SESSION_PUBLIC_CONTENT
    );
    expect((await MembershipPublicContent.findOne())?.content).toMatchObject(
      DEVELOPMENT_MEMBERSHIP_PUBLIC_CONTENT
    );
    const recruitmentContent = (await RecruitmentPublicContent.findOne())
      ?.content;
    expect(recruitmentContent).toMatchObject({
      isOpen: true,
      contactEntryId: expect.anything(),
    });
    const recruitmentContact = await ContactEntry.findById(
      recruitmentContent?.contactEntryId
    ).lean();
    expect(recruitmentContact).toMatchObject({
      category: DEVELOPMENT_RECRUITMENT_CONTACT.category,
      title: DEVELOPMENT_RECRUITMENT_CONTACT.title,
      email: DEVELOPMENT_RECRUITMENT_CONTACT.email,
      isActive: true,
    });
    expect(recruitmentContact?.email).not.toBe(
      CANONICAL_CONTACT_ENTRIES[0].email
    );
    expect(await Location.countDocuments()).toBe(2);
    expect(
      await Announcement.find({ isActive: true }).sort({ order: 1 }).lean()
    ).toMatchObject(DEVELOPMENT_ANNOUNCEMENTS);
    expect(
      await Activity.find({ isVisible: true }).sort({ order: 1 }).lean()
    ).toMatchObject(DEVELOPMENT_ACTIVITIES);
    expect(await PublicDocument.countDocuments()).toBe(0);
    expect(
      await EmailTemplate.collection.countDocuments({
        _id: unrelated.insertedId,
      })
    ).toBe(1);

    await seedData('content', {
      target: { kind: 'test', expectedDatabaseName: databaseName },
      activityUploadsRoot: uploadsRoot,
      contactUploadsRoot: uploadsRoot,
      publicDocumentUploadsRoot: uploadsRoot,
    });
    expect(await HomepageContent.countDocuments()).toBe(1);
    expect(await ClubInformation.countDocuments()).toBe(1);
    expect(await ContactEntry.countDocuments()).toBe(3);
    expect(await TasterSessionPublicContent.countDocuments()).toBe(1);
    expect(await MembershipPublicContent.countDocuments()).toBe(1);
    expect(await RecruitmentPublicContent.countDocuments()).toBe(1);
    expect(await Location.countDocuments()).toBe(2);
    expect(await Announcement.countDocuments()).toBe(
      DEVELOPMENT_ANNOUNCEMENTS.length
    );
    expect(await Activity.countDocuments()).toBe(DEVELOPMENT_ACTIVITIES.length);
    expect(await PublicDocument.countDocuments()).toBe(0);
    expect(
      await EmailTemplate.collection.countDocuments({
        _id: unrelated.insertedId,
      })
    ).toBe(1);
  });

  it('leaves database and external files unchanged when file preflight refuses a symlink', async () => {
    const externalRoot = await mkdtemp(
      path.join(tmpdir(), 'external-content-reset-sentinel-')
    );
    const sentinel = path.join(externalRoot, 'sentinel.txt');
    await writeFile(sentinel, 'keep');
    await Announcement.collection.insertOne({
      title: { de: 'Retained sentinel', en: '', zh: '' },
    });
    await symlink(externalRoot, path.join(uploadsRoot, 'activities'));

    try {
      await expect(
        seedData('content', {
          target: { kind: 'test', expectedDatabaseName: databaseName },
          activityUploadsRoot: uploadsRoot,
          contactUploadsRoot: uploadsRoot,
          publicDocumentUploadsRoot: uploadsRoot,
        })
      ).rejects.toThrow('symbolic link');
      expect(await Announcement.countDocuments()).toBe(1);
      await expect(readFile(sentinel, 'utf8')).resolves.toBe('keep');
    } finally {
      await rm(externalRoot, { recursive: true, force: true });
    }
  });

  it('leaves the connected database unchanged when URI identity mismatches the active run', async () => {
    const approvedUri = process.env.MONGODB_URI!;
    process.env.MONGODB_URI = approvedUri.replace(
      databaseName,
      'wrong_reset_test_0123456789abcdef'
    );
    await Announcement.collection.insertOne({
      title: { de: 'Database sentinel', en: '', zh: '' },
    });

    try {
      await expect(
        seedData('content', {
          target: { kind: 'test', expectedDatabaseName: databaseName },
          activityUploadsRoot: uploadsRoot,
          contactUploadsRoot: uploadsRoot,
          publicDocumentUploadsRoot: uploadsRoot,
        })
      ).rejects.toThrow('URI database does not match');
      expect(mongoose.connection.name).toBe(databaseName);
      expect(await Announcement.countDocuments()).toBe(1);
    } finally {
      process.env.MONGODB_URI = approvedUri;
    }
  });
});
