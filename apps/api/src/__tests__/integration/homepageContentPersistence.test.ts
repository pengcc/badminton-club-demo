import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Language } from '@club/shared-types/core/enums';
import { Content, HomepageContent } from '../../models/Content';
import { ClubInformation } from '../../models/ClubInformation';
import { User } from '../../models/User';
import { Location } from '../../models/Location';
import { HomepageContentService } from '../../services/homepageContentService';
import { ClubInformationService } from '../../services/clubInformationService';
import {
  bootstrapCanonicalContent,
  canonicalLocations,
} from '../../scripts/bootstrapCanonicalContent';
import {
  CANONICAL_CLUB_INFORMATION,
  CANONICAL_HOMEPAGE_CONTENT,
} from '../../scripts/canonicalContentDefaults';

let mongoLease: MongoTestDatabaseLease;

const localized = (de: string, en = '', zh = '') => ({ de, en, zh });

const content = {
  mainMessage: localized('Willkommen', 'Welcome', '欢迎'),
  visitUsIntroduction: localized('Besucht uns'),
  contactIntroduction: localized('Kontakt', 'Contact'),
};

const clubInformation = {
  officialNameGerman: 'Deutsch-Chinesischer Badminton Verein e. V.',
  nameEnglish: 'German-Chinese Badminton Club',
  nameChinese: '德中羽毛球俱乐部',
  shortName: 'DCBV',
  foundingYear: 2009,
  introduction: localized('Verein', 'Club', '俱乐部'),
};

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('homepageContent');
  mongoLease.assertOwnedDatabase();
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await HomepageContent.deleteMany({});
  await ClubInformation.deleteMany({});
  await Content.deleteMany({});
  await Location.deleteMany({});
  await User.deleteMany({});
});

describe('canonical Club Information persistence', () => {
  it('bootstraps only missing canonical content and never overwrites retained data', async () => {
    const originalActor = new Types.ObjectId();
    const bootstrapActor = new Types.ObjectId();
    const retainedHomepage = await HomepageContent.create({
      singletonKey: 'homepage',
      content,
      updatedBy: originalActor,
    });
    const retainedClub = await ClubInformation.create({
      singletonKey: 'club',
      content: clubInformation,
      updatedBy: originalActor,
    });

    await bootstrapCanonicalContent(bootstrapActor);
    await bootstrapCanonicalContent(bootstrapActor);

    const homepageAfter = await HomepageContent.findById(retainedHomepage._id);
    const clubAfter = await ClubInformation.findById(retainedClub._id);
    expect(homepageAfter?.content).toMatchObject(content);
    expect(homepageAfter?.updatedBy).toEqual(originalActor);
    expect(homepageAfter?.updatedAt).toEqual(retainedHomepage.updatedAt);
    expect(clubAfter?.content).toMatchObject(clubInformation);
    expect(clubAfter?.updatedBy).toEqual(originalActor);
    expect(clubAfter?.updatedAt).toEqual(retainedClub.updatedAt);
  });

  it('creates each missing singleton independently', async () => {
    const actor = new Types.ObjectId();
    const retainedClub = await ClubInformation.create({
      singletonKey: 'club',
      content: clubInformation,
      updatedBy: actor,
    });

    await bootstrapCanonicalContent(actor);

    expect(await HomepageContent.countDocuments()).toBe(1);
    expect(await ClubInformation.countDocuments()).toBe(1);
    expect((await ClubInformation.findOne())?._id).toEqual(retainedClub._id);

    await HomepageContent.deleteMany({});
    await ClubInformation.deleteMany({});
    const retainedHomepage = await HomepageContent.create({
      singletonKey: 'homepage',
      content,
      updatedBy: actor,
    });

    await bootstrapCanonicalContent(actor);

    expect(await HomepageContent.countDocuments()).toBe(1);
    expect((await HomepageContent.findOne())?._id).toEqual(
      retainedHomepage._id
    );
    expect(await ClubInformation.countDocuments()).toBe(1);
  });

  it('restores exact Location defaults only when the collection is empty', async () => {
    const actor = new Types.ObjectId();
    await bootstrapCanonicalContent(actor);

    const seeded = await Location.find().sort({ order: 1 }).lean();
    expect(seeded).toHaveLength(2);
    expect(seeded).toMatchObject(canonicalLocations(actor));

    const retained = seeded[0];
    await bootstrapCanonicalContent(new Types.ObjectId());
    expect(await Location.countDocuments()).toBe(2);
    expect(await Location.findById(retained._id).lean()).toEqual(retained);
  });

  it('stores one coherent canonical identity aggregate', async () => {
    const administrator = new Types.ObjectId().toString();
    await ClubInformationService.updateContent(clubInformation, administrator);
    await ClubInformationService.updateContent(
      { ...clubInformation, shortName: 'DCBV' },
      administrator
    );

    expect(await ClubInformation.countDocuments()).toBe(1);
    await expect(
      ClubInformationService.getPublicContent(Language.ENGLISH)
    ).resolves.toMatchObject({
      localizedName: 'German-Chinese Badminton Club',
      shortName: 'DCBV',
      introduction: 'Club',
    });
  });

  it('retains canonical Club Information after a failed replacement', async () => {
    await ClubInformationService.updateContent(
      clubInformation,
      new Types.ObjectId().toString()
    );
    await expect(
      ClubInformationService.updateContent(
        { ...clubInformation, shortName: 'Not saved' },
        'invalid-user-id'
      )
    ).rejects.toBeDefined();

    const stored = await ClubInformation.findOne({ singletonKey: 'club' });
    expect(stored?.content.shortName).toBe('DCBV');
  });
});

afterAll(async () => {
  await mongoLease.release();
});

describe('homepage content persistence', () => {
  it('stores one coherent multilingual aggregate and updates it atomically', async () => {
    const adminId = new Types.ObjectId().toString();

    await HomepageContentService.updateContent(content, adminId);
    expect(await HomepageContent.countDocuments()).toBe(1);

    const nextContent = {
      ...content,
      mainMessage: localized('Neu', '', '新'),
      contactIntroduction: localized(''),
    };
    await HomepageContentService.updateContent(nextContent, adminId);

    const stored = await HomepageContent.findOne({ singletonKey: 'homepage' });
    expect(stored?.content).toMatchObject(nextContent);
    expect(await HomepageContent.countDocuments()).toBe(1);
  });

  it('retains the prior aggregate when a replacement cannot be persisted', async () => {
    const adminId = new Types.ObjectId().toString();
    await HomepageContentService.updateContent(content, adminId);

    await expect(
      HomepageContentService.updateContent(
        { ...content, mainMessage: localized('Nicht speichern') },
        'invalid-user-id'
      )
    ).rejects.toBeDefined();

    const stored = await HomepageContent.findOne({ singletonKey: 'homepage' });
    expect(stored?.content.mainMessage).toMatchObject(content.mainMessage);
  });

  it('uses requested content and canonical German fallback publicly', async () => {
    await HomepageContentService.updateContent(
      content,
      new Types.ObjectId().toString()
    );

    await expect(
      HomepageContentService.getPublicContent(Language.ENGLISH)
    ).resolves.toMatchObject({
      mainMessage: 'Welcome',
      visitUsIntroduction: 'Besucht uns',
      contactIntroduction: 'Contact',
    });
  });
});
