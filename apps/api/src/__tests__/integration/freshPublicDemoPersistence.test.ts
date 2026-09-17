import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import { bootstrapFreshPublicDemo } from '../../scripts/bootstrapFreshPublicDemo';
import { User } from '../../models/User';
import { Player } from '../../models/Player';
import { Team } from '../../models/Team';
import { Match } from '../../models/Match';
import { MembershipApplication } from '../../models/MembershipApplication';
import { ContactEntry } from '../../models/ContactEntry';
import { MembershipPublicContent } from '../../models/MembershipPublicContent';
import { TasterSessionPublicContent } from '../../models/TasterSessionPublicContent';
import { RecruitmentPublicContent } from '../../models/RecruitmentPublicContent';
import {
  CANONICAL_CONTACT_ENTRIES,
  CANONICAL_MEMBERSHIP_PUBLIC_CONTENT,
  CANONICAL_TASTER_SESSION_PUBLIC_CONTENT,
  CANONICAL_RECRUITMENT_PUBLIC_CONTENT,
} from '../../scripts/canonicalContentDefaults';
import { auditShowcasePublicContent } from '../../services/showcasePublicContentReconciliationService';
import { ActivityOwnedFileStore } from '../../services/activityOwnedFileStore';
import { ContactQrOwnedFileStore } from '../../services/contactQrOwnedFileStore';
import { PublicDocumentOwnedFileStore } from '../../services/publicDocumentOwnedFileStore';

let lease: MongoTestDatabaseLease;
const password = 'TestPassword123!';
const inputs = () => ({
  NODE_ENV: 'production',
  MONGODB_URI: lease.uri,
  SHOWCASE_DEMO_ADMIN_EMAIL: 'demo.admin@club.invalid',
  SHOWCASE_DEMO_ADMIN_PASSWORD: password,
});
beforeEach(async () => {
  lease = await acquireMongoTestDatabase('freshDemo');
});
afterEach(async () => {
  vi.restoreAllMocks();
  await mongoose.connect(lease.uri, { autoIndex: false });
  await lease.release();
});

function forbidCleanup() {
  const forbidden = () => {
    throw new Error('destructive cleanup reached');
  };
  return [
    vi
      .spyOn(mongoose.mongo.Collection.prototype, 'deleteMany')
      .mockImplementation(forbidden),
    vi
      .spyOn(mongoose.mongo.Collection.prototype, 'deleteOne')
      .mockImplementation(forbidden),
    vi
      .spyOn(mongoose.mongo.Collection.prototype, 'drop')
      .mockImplementation(forbidden),
    vi
      .spyOn(mongoose.mongo.Db.prototype, 'dropDatabase')
      .mockImplementation(forbidden),
    vi
      .spyOn(ActivityOwnedFileStore.prototype, 'resetOwnedNamespaces')
      .mockImplementation(forbidden),
    vi
      .spyOn(ContactQrOwnedFileStore.prototype, 'resetOwnedNamespaces')
      .mockImplementation(forbidden),
    vi
      .spyOn(PublicDocumentOwnedFileStore.prototype, 'resetOwnedNamespaces')
      .mockImplementation(forbidden),
  ];
}

describe('fresh hosted seed on disposable MongoDB', () => {
  it('reuses the complete seed without cleanup, protects credentials and passes public-content audit', async () => {
    const forbidden = forbidCleanup();
    const output = vi.spyOn(console, 'log').mockImplementation(() => {});
    await bootstrapFreshPublicDemo(['--fresh-empty-target'], inputs());
    await mongoose.connect(lease.uri, { autoIndex: false });
    expect(await User.countDocuments()).toBe(60);
    expect(await Team.countDocuments()).toBe(2);
    expect(await Match.countDocuments()).toBe(9);
    expect(await MembershipApplication.countDocuments()).toBe(8);
    const users = await User.find().select('+password').lean();
    for (const user of users) {
      expect(user.email.endsWith('.invalid')).toBe(true);
      expect(await bcrypt.compare(password, user.password!)).toBe(
        user.email === inputs().SHOWCASE_DEMO_ADMIN_EMAIL
      );
      for (const local of ['admin123', 'member123', 'demo1234']) {
        expect(await bcrypt.compare(local, user.password!)).toBe(false);
      }
    }
    const teams = await Team.find().lean();
    for (const player of await Player.find().lean()) {
      expect(users.some((user) => user._id.equals(player.userId))).toBe(true);
      expect(
        player.teamIds.every((id) => teams.some((team) => team._id.equals(id)))
      ).toBe(true);
    }
    expect(
      await Match.countDocuments({ demoScratchLeaseId: { $exists: true } })
    ).toBe(0);
    // Assert the canonical source independently of the audit's acceptance rules.
    expect((await MembershipPublicContent.findOne().lean())?.content).toEqual(
      CANONICAL_MEMBERSHIP_PUBLIC_CONTENT
    );
    expect(
      (await TasterSessionPublicContent.findOne().lean())?.content
    ).toEqual(CANONICAL_TASTER_SESSION_PUBLIC_CONTENT);
    expect((await RecruitmentPublicContent.findOne().lean())?.content).toEqual(
      CANONICAL_RECRUITMENT_PUBLIC_CONTENT
    );
    const contacts = await ContactEntry.find().sort({ order: 1 }).lean();
    expect(contacts).toHaveLength(CANONICAL_CONTACT_ENTRIES.length);
    CANONICAL_CONTACT_ENTRIES.forEach(
      ({ retainedQrCode: _unused, ...entry }, index) => {
        expect(contacts[index]).toMatchObject({ ...entry, qrCode: '' });
      }
    );
    const report = await auditShowcasePublicContent();
    expect(
      report.owners.filter((owner) => owner.classification !== 'accepted')
    ).toEqual([]);
    expect(report.converged).toBe(true);
    for (const spy of forbidden) expect(spy).not.toHaveBeenCalled();
    expect(JSON.stringify(output.mock.calls)).not.toContain(password);
    expect(JSON.stringify(output.mock.calls)).not.toContain('password');
    const before = await User.find().select('+password').lean();
    await expect(
      bootstrapFreshPublicDemo(['--fresh-empty-target'], inputs())
    ).rejects.toThrow('FRESH_DEMO_BOOTSTRAP_FAILED');
    await mongoose.connect(lease.uri, { autoIndex: false });
    expect(await User.find().select('+password').lean()).toEqual(before);
  }, 180_000);

  it('refuses an unknown non-empty collection with zero mutation', async () => {
    const db = mongoose.connection.db!;
    await db.collection('unexpected_business').insertOne({ synthetic: true });
    const forbidden = forbidCleanup();
    await expect(
      bootstrapFreshPublicDemo(['--fresh-empty-target'], inputs())
    ).rejects.toThrow('FRESH_DEMO_BOOTSTRAP_FAILED');
    await mongoose.connect(lease.uri, { autoIndex: false });
    expect(
      await mongoose.connection
        .db!.collection('unexpected_business')
        .countDocuments()
    ).toBe(1);
    expect(await User.countDocuments()).toBe(0);
    for (const spy of forbidden) expect(spy).not.toHaveBeenCalled();
  });

  it('leaves partial state on failure and refuses retry without repair or credential disclosure', async () => {
    const failure = vi
      .spyOn(Player, 'create')
      .mockRejectedValueOnce(new Error(password));
    const forbidden = forbidCleanup();
    await expect(
      bootstrapFreshPublicDemo(['--fresh-empty-target'], inputs())
    ).rejects.toThrow('FRESH_DEMO_BOOTSTRAP_FAILED');
    failure.mockRestore();
    await mongoose.connect(lease.uri, { autoIndex: false });
    expect(await User.countDocuments()).toBe(60);
    expect(await Player.countDocuments()).toBe(0);
    await expect(
      bootstrapFreshPublicDemo(['--fresh-empty-target'], inputs())
    ).rejects.toThrow('FRESH_DEMO_BOOTSTRAP_FAILED');
    for (const spy of forbidden) expect(spy).not.toHaveBeenCalled();
  }, 60_000);
});
