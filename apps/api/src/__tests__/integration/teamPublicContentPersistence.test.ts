import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import mongoose, { Types } from 'mongoose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Language, TeamLevel } from '@club/shared-types/core/enums';
import { Settings } from '../../models/Settings';
import { Team } from '../../models/Team';
import teamRoutes from '../../routes/teams';
import { TeamPublicContentService } from '../../services/teamPublicContentService';
import {
  ensureCanonicalSettings,
  legacySettingsMessage,
} from '../../scripts/seedSettings';
import { seedData } from '../../scripts/seedData';

let mongoLease: MongoTestDatabaseLease;
let databaseName = '';
let uploadsRoot = '';
const originalMongoUri = process.env.MONGODB_URI;

const content = {
  enabled: true,
  title: { de: 'Mannschaften', en: 'Teams', zh: '' },
  description: {
    de: 'Unsere Mannschaften',
    en: '',
    zh: '我们的球队',
  },
};

beforeAll(async () => {
  mongoLease = await acquireMongoTestDatabase('teamPublicContent');
  databaseName = mongoLease.databaseName;
  process.env.MONGODB_URI = mongoLease.uri;
  uploadsRoot = await mkdtemp(
    path.join(tmpdir(), `club-${databaseName}-content-reset-`)
  );
  mongoLease.assertOwnedDatabase();
}, 120_000);

beforeEach(async () => {
  mongoLease.assertOwnedDatabase();
  await Settings.deleteMany({});
});

describe('Team public content persistence', () => {
  it('replaces legacy Settings with the canonical localized default during a full reset', async () => {
    await Settings.collection.insertOne({
      teamPublicContent: {
        enabled: true,
        title: 'Legacy teams',
        description: 'Legacy description',
      },
    });

    await seedData('all', {
      target: { kind: 'test', expectedDatabaseName: databaseName },
      activityUploadsRoot: uploadsRoot,
      contactUploadsRoot: uploadsRoot,
      publicDocumentUploadsRoot: uploadsRoot,
    });

    const stored = await Settings.collection.findOne({});
    expect(stored?.teamPublicContent).toMatchObject({
      enabled: false,
      title: { de: '', en: '', zh: '' },
      description: { de: '', en: '', zh: '' },
    });

    expect(
      await Team.find({}, 'teamId shortName leagueTeamName matchLevel')
        .sort({ teamId: 1 })
        .lean()
    ).toMatchObject([
      {
        teamId: 't1',
        shortName: 'Demo I',
        leagueTeamName: 'Demo I',
        matchLevel: TeamLevel.B,
      },
      {
        teamId: 't2',
        shortName: 'Demo II',
        leagueTeamName: 'Demo II',
        matchLevel: TeamLevel.D,
      },
    ]);

    const application = express();
    application.use('/api/teams', teamRoutes);
    const response = await request(application).get('/api/teams/public');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      {
        shortName: 'Demo I',
        leagueTeamName: 'Demo I',
        matchLevel: TeamLevel.B,
      },
      {
        shortName: 'Demo II',
        leagueTeamName: 'Demo II',
        matchLevel: TeamLevel.D,
      },
    ]);

    await expect(
      new Team({
        teamId: 'bad',
        shortName: 'Invalid Team',
        leagueTeamName: 'Invalid Team',
        matchLevel: 'BVBB B',
        createdById: new Types.ObjectId(),
      }).validate()
    ).rejects.toThrow();
  }, 60_000);

  it('fails closed on legacy single-language Settings without inferring a locale', async () => {
    await Settings.collection.insertOne({
      notificationRecipients: {},
      teamPublicContent: {
        enabled: true,
        title: 'Legacy teams',
        description: 'Legacy description',
      },
    });

    await expect(ensureCanonicalSettings()).rejects.toThrow(
      legacySettingsMessage
    );
    expect(await Settings.collection.findOne({})).toMatchObject({
      teamPublicContent: {
        title: 'Legacy teams',
        description: 'Legacy description',
      },
    });
  });

  it('preserves canonical administrator Settings and creates only when absent', async () => {
    const existing = await Settings.create({
      membershipOpen: true,
      teamPublicContent: content,
    });

    await ensureCanonicalSettings();
    const retained = await Settings.findById(existing._id).lean();
    expect(retained?.membershipOpen).toBe(true);
    expect(retained?.teamPublicContent).toMatchObject(content);

    await Settings.deleteMany({});
    await ensureCanonicalSettings();
    expect(await Settings.countDocuments()).toBe(1);
    await expect(
      TeamPublicContentService.getPublicContent(Language.GERMAN)
    ).resolves.toEqual({ enabled: false, title: '', description: '' });
  });

  it('stores one localized Settings aggregate and resolves German fallback', async () => {
    const administrator = new Types.ObjectId().toString();
    await TeamPublicContentService.updateContent(content, administrator);

    expect(await Settings.countDocuments()).toBe(1);
    await expect(
      TeamPublicContentService.getPublicContent(Language.ENGLISH)
    ).resolves.toEqual({
      enabled: true,
      title: 'Teams',
      description: 'Unsere Mannschaften',
    });
    await expect(
      TeamPublicContentService.getPublicContent(Language.CHINESE)
    ).resolves.toEqual({
      enabled: true,
      title: 'Mannschaften',
      description: '我们的球队',
    });
  });

  it('retains localized copy while disabling only its public display state', async () => {
    const administrator = new Types.ObjectId().toString();
    await TeamPublicContentService.updateContent(content, administrator);
    await TeamPublicContentService.updateContent(
      { ...content, enabled: false },
      administrator
    );

    expect(await Settings.countDocuments()).toBe(1);
    await expect(
      TeamPublicContentService.getPublicContent(Language.GERMAN)
    ).resolves.toEqual({
      enabled: false,
      title: 'Mannschaften',
      description: 'Unsere Mannschaften',
    });
  });

  it('retains the previous aggregate when a replacement cannot persist', async () => {
    await TeamPublicContentService.updateContent(
      content,
      new Types.ObjectId().toString()
    );
    await expect(
      TeamPublicContentService.updateContent(
        { ...content, title: { ...content.title, de: 'Nicht speichern' } },
        'invalid-user-id'
      )
    ).rejects.toBeDefined();

    const stored = await Settings.findOne();
    expect(stored?.teamPublicContent?.title.de).toBe('Mannschaften');
  });
});

afterAll(async () => {
  try {
    await mongoLease.release();
  } finally {
    await rm(uploadsRoot, { recursive: true, force: true });
    if (originalMongoUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalMongoUri;
  }
});
