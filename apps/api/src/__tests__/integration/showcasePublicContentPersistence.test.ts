import * as currentDefaults from '../../scripts/canonicalContentDefaults';
import { canonicalLocations } from '../../scripts/bootstrapCanonicalContent';
import mongoose, { Types } from 'mongoose';
import {
  beforeAll,
  beforeEach,
  afterAll,
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  acquireMongoTestDatabase,
  type MongoTestDatabaseLease,
} from '../infrastructure/mongoTestDatabase';
import { bootstrapCanonicalContent } from '../../scripts/bootstrapCanonicalContent';
import { HomepageContent } from '../../models/Content';
import { ContactEntry } from '../../models/ContactEntry';
import { Location } from '../../models/Location';
import { RecruitmentPublicContent } from '../../models/RecruitmentPublicContent';
import { Announcement } from '../../models/Announcement';
import { Activity } from '../../models/Activity';
import { PublicDocument } from '../../models/PublicDocument';
import { Settings } from '../../models/Settings';
import { ClubInformation } from '../../models/ClubInformation';
import { MembershipPublicContent } from '../../models/MembershipPublicContent';
import { TasterSessionPublicContent } from '../../models/TasterSessionPublicContent';
import {
  auditShowcasePublicContent,
  reconcileShowcasePublicContent,
  showcaseContentFingerprint,
} from '../../services/showcasePublicContentReconciliationService';
import { SHOWCASE_LEGACY_PUBLIC_CONTENT } from '../../scripts/showcaseLegacyPublicContentFingerprints';
import {
  DEVELOPMENT_MEMBERSHIP_PUBLIC_CONTENT,
  DEVELOPMENT_TASTER_SESSION_PUBLIC_CONTENT,
  DEVELOPMENT_RECRUITMENT_CONTACT,
  developmentRecruitmentPublicContent,
} from '../../scripts/developmentPublicContentFixtures';

// Synthetic legacy inputs exercise the real persistence/reconciliation boundary
// without requiring private source history or republishing historical club data.
function historicalDefaults() {
  const constants = structuredClone({
    ...currentDefaults,
  }) as unknown as Record<
    string,
    Record<string, unknown> | Record<string, unknown>[]
  >;
  for (const [key, value] of Object.entries(constants)) {
    if (key === 'CANONICAL_CONTACT_ENTRIES') {
      for (const entry of value as Record<string, unknown>[]) {
        (entry.title as Record<string, string>).de += ' — previous demo';
      }
    } else {
      const firstLocalized = Object.values(value).find(
        (field) => field && typeof field === 'object' && 'de' in field
      ) as Record<string, string>;
      firstLocalized.de += ' — previous demo';
    }
  }
  return {
    constants,
    locations: (actor: Types.ObjectId) =>
      canonicalLocations(actor).map((location) => ({
        ...location,
        translations: {
          ...location.translations,
          de: {
            ...location.translations.de,
            name: 'Previous ' + location.translations.de.name,
          },
        },
      })),
  };
}
vi.mock('../../scripts/showcaseLegacyPublicContentFingerprints', async () => {
  const { Types: MongoTypes } = await import('mongoose');
  const defaults = await import('../../scripts/canonicalContentDefaults');
  const { canonicalLocations: locations } = await import(
    '../../scripts/bootstrapCanonicalContent'
  );
  const { createHash: hash } = await import('node:crypto');
  const normalize = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(normalize)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value)
              .filter(([, v]) => v !== undefined)
              .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
              .map(([k, v]) => [k, normalize(v)])
          )
        : value;
  const fingerprint = (value: unknown) =>
    hash('sha256')
      .update(JSON.stringify(normalize(value)))
      .digest('hex');
  const constants = structuredClone({ ...defaults }) as unknown as Record<
    string,
    Record<string, unknown> | Record<string, unknown>[]
  >;
  const result: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(constants)) {
    if (key === 'CANONICAL_CONTACT_ENTRIES') {
      result.contacts = (value as Record<string, unknown>[]).map(
        ({ retainedQrCode: _unused, ...entry }) => {
          (entry.title as Record<string, string>).de += ' — previous demo';
          return fingerprint({
            ...entry,
            qrCode: '',
            qrCodeOriginalFilename: '',
          });
        }
      );
    } else {
      const field = Object.values(value).find(
        (field) => field && typeof field === 'object' && 'de' in field
      ) as Record<string, string>;
      field.de += ' — previous demo';
      result[key] = fingerprint(value);
    }
  }
  result.locations = locations(new MongoTypes.ObjectId()).map(
    ({ createdBy: _created, updatedBy: _updated, ...location }) =>
      fingerprint({
        ...location,
        translations: {
          ...location.translations,
          de: {
            ...location.translations.de,
            name: 'Previous ' + location.translations.de.name,
          },
        },
      })
  );
  return { SHOWCASE_LEGACY_PUBLIC_CONTENT: result };
});
let lease: MongoTestDatabaseLease;
const actor = new Types.ObjectId();
const models = [
  HomepageContent,
  ClubInformation,
  ContactEntry,
  Location,
  RecruitmentPublicContent,
  TasterSessionPublicContent,
  MembershipPublicContent,
  Announcement,
  Activity,
  PublicDocument,
  Settings,
];
beforeAll(async () => {
  lease = await acquireMongoTestDatabase('showcasePublicContent');
  lease.assertOwnedDatabase();
  for (const model of models) await model.createCollection();
}, 120_000);
beforeEach(async () => {
  lease.assertOwnedDatabase();
  for (const model of models) await model.collection.deleteMany({});
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await lease.release();
});

async function legacyState() {
  const old = historicalDefaults();
  const singletonOwners = [
    [HomepageContent, 'homepage', 'CANONICAL_HOMEPAGE_CONTENT'],
    [ClubInformation, 'club', 'CANONICAL_CLUB_INFORMATION'],
    [
      TasterSessionPublicContent,
      'taster-session',
      'CANONICAL_TASTER_SESSION_PUBLIC_CONTENT',
    ],
    [
      MembershipPublicContent,
      'membership',
      'CANONICAL_MEMBERSHIP_PUBLIC_CONTENT',
    ],
    [
      RecruitmentPublicContent,
      'recruitment',
      'CANONICAL_RECRUITMENT_PUBLIC_CONTENT',
    ],
  ] as const;
  for (const [model, key, name] of singletonOwners) {
    expect(showcaseContentFingerprint(old.constants[name])).toBe(
      SHOWCASE_LEGACY_PUBLIC_CONTENT[name]
    );
    await model.collection.insertOne({
      singletonKey: key,
      content: old.constants[name],
      updatedBy: actor,
    });
  }
  for (const { retainedQrCode: _unused, ...entry } of old.constants
    .CANONICAL_CONTACT_ENTRIES as Record<string, unknown>[]) {
    await ContactEntry.create({
      ...entry,
      qrCode: '',
      createdBy: actor,
      updatedBy: actor,
    });
  }
  await Location.create(old.locations(actor));
}
async function snapshot() {
  const result: Record<string, unknown> = {};
  for (const model of models)
    result[model.collection.name] = await model.collection
      .find({})
      .sort({ _id: 1 })
      .toArray();
  return JSON.stringify(result);
}

describe('Issue #14 public-content reconciliation on disposable MongoDB', () => {
  it('audits missing owners without mutation and never creates them on apply', async () => {
    const before = await snapshot();
    const report = await auditShowcasePublicContent();
    expect(report.converged).toBe(false);
    expect(
      report.owners.filter(
        (row) => row.classification === 'missing-bootstrap-owner'
      )
    ).toHaveLength(7);
    expect(
      report.owners.find((row) => row.owner === 'public-documents')
        ?.classification
    ).toBe('accepted');
    await expect(
      reconcileShowcasePublicContent({ confirmed: true })
    ).rejects.toMatchObject({ code: 'PUBLIC_CONTENT_BLOCKED' });
    expect(await snapshot()).toBe(before);
  });

  it('accepts fresh bootstrap; bootstrap and repeated apply preserve exact existing state', async () => {
    await bootstrapCanonicalContent(actor);
    const before = await snapshot();
    expect((await auditShowcasePublicContent()).converged).toBe(true);
    await bootstrapCanonicalContent(new Types.ObjectId());
    expect(await snapshot()).toBe(before);
    expect(
      (await reconcileShowcasePublicContent({ confirmed: true })).updated
    ).toBe(0);
    expect(await snapshot()).toBe(before);
  });

  it('does not accept development-only participation fixtures as canonical retained content', async () => {
    await bootstrapCanonicalContent(actor);
    const { retainedQrCode: _unused, ...entry } =
      DEVELOPMENT_RECRUITMENT_CONTACT;
    const contact = await ContactEntry.create({
      ...entry,
      qrCode: '',
      createdBy: actor,
      updatedBy: actor,
    });
    await MembershipPublicContent.updateOne(
      {},
      { content: DEVELOPMENT_MEMBERSHIP_PUBLIC_CONTENT }
    );
    await TasterSessionPublicContent.updateOne(
      {},
      { content: DEVELOPMENT_TASTER_SESSION_PUBLIC_CONTENT }
    );
    await RecruitmentPublicContent.updateOne(
      {},
      { content: developmentRecruitmentPublicContent(String(contact._id)) }
    );
    const before = await snapshot();
    const report = await auditShowcasePublicContent();
    expect(report.converged).toBe(false);
    for (const owner of [
      'contacts',
      'membership',
      'taster-session',
      'recruitment',
    ]) {
      expect(
        report.owners.find((row) => row.owner === owner)?.classification
      ).toBe('unresolved');
    }
    await expect(
      reconcileShowcasePublicContent({ confirmed: true })
    ).rejects.toMatchObject({ code: 'PUBLIC_CONTENT_BLOCKED' });
    expect(await snapshot()).toBe(before);
  });

  it('recognizes exact synthetic legacy fingerprints, upgrades in place and preserves Contact/Location/slot references', async () => {
    await legacyState();
    const contacts = await ContactEntry.find().sort({ order: 1 }).lean();
    const locations = await Location.find().sort({ order: 1 }).lean();
    // Intentional safe custom Recruitment must retain its selected Contact ID.
    await RecruitmentPublicContent.updateOne(
      {},
      { $set: { 'content.contactEntryId': contacts[0]._id } }
    );
    const audit = await auditShowcasePublicContent();
    expect(
      audit.owners.filter((row) => row.classification === 'legacy')
    ).toHaveLength(6);
    const recruitment = audit.owners.find(
      (row) => row.owner === 'recruitment'
    )!;
    const approvals = new Map([['recruitment', recruitment.fingerprint]]);
    const report = await reconcileShowcasePublicContent({
      confirmed: true,
      approvals,
    });
    expect(report.converged).toBe(true);
    expect(report.updated).toBe(8);
    expect(
      (await ContactEntry.find().sort({ order: 1 }).lean()).map((row) =>
        String(row._id)
      )
    ).toEqual(contacts.map((row) => String(row._id)));
    const afterLocations = await Location.find().sort({ order: 1 }).lean();
    expect(
      afterLocations.map((row) => ({
        id: String(row._id),
        slots: row.timeSlots.map((slot) => slot.id),
      }))
    ).toEqual(
      locations.map((row) => ({
        id: String(row._id),
        slots: row.timeSlots.map((slot) => slot.id),
      }))
    );
    expect(
      String((await RecruitmentPublicContent.findOne())?.content.contactEntryId)
    ).toBe(String(contacts[0]._id));
    const beforeRepeat = await snapshot();
    expect(
      (await reconcileShowcasePublicContent({ confirmed: true, approvals }))
        .updated
    ).toBe(0);
    expect(await snapshot()).toBe(beforeRepeat);
  });

  it('upgrades legacy entries beside approved custom content instead of certifying leftover legacy', async () => {
    await legacyState();
    const custom = await ContactEntry.findOne({ order: 0 });
    await ContactEntry.updateOne(
      { _id: custom!._id },
      { $set: { email: 'reviewed@example.invalid' } }
    );
    const audit = await auditShowcasePublicContent();
    const fingerprint = audit.owners.find(
      (row) => row.owner === 'contacts'
    )!.fingerprint;
    const approvals = new Map([['contacts', fingerprint]]);
    const approvedAudit = await auditShowcasePublicContent(approvals);
    expect(
      approvedAudit.owners.find((row) => row.owner === 'contacts')
        ?.classification
    ).toBe('legacy');
    expect(approvedAudit.converged).toBe(false);
    const result = await reconcileShowcasePublicContent({
      confirmed: true,
      approvals,
    });
    expect(result.converged).toBe(true);
    expect((await ContactEntry.findById(custom!._id))?.email).toBe(
      'reviewed@example.invalid'
    );
    expect((await ContactEntry.findOne({ order: 1 }))?.email).toBe(
      'participation@example.invalid'
    );
    const nextApproval = new Map([
      [
        'contacts',
        result.owners.find((row) => row.owner === 'contacts')!.fingerprint,
      ],
    ]);
    expect(
      (
        await reconcileShowcasePublicContent({
          confirmed: true,
          approvals: nextApproval,
        })
      ).updated
    ).toBe(0);
    await expect(auditShowcasePublicContent(approvals)).rejects.toMatchObject({
      code: 'CUSTOM_APPROVAL_INVALID',
    });
  });

  it('preserves reviewed Recruitment with a subsequently hidden Contact but refuses missing references', async () => {
    await bootstrapCanonicalContent(actor);
    const contact = await ContactEntry.findOne({ order: 0 });
    await ContactEntry.updateOne(
      { _id: contact!._id },
      { $set: { isActive: false } }
    );
    await RecruitmentPublicContent.updateOne(
      {},
      {
        $set: {
          'content.isOpen': true,
          'content.contactEntryId': contact!._id,
        },
      }
    );
    const audit = await auditShowcasePublicContent();
    const approvals = new Map(
      audit.owners
        .filter((row) => ['contacts', 'recruitment'].includes(row.owner))
        .map((row) => [row.owner, row.fingerprint])
    );
    const before = await snapshot();
    expect(
      (await reconcileShowcasePublicContent({ confirmed: true, approvals }))
        .converged
    ).toBe(true);
    expect(await snapshot()).toBe(before);
    await RecruitmentPublicContent.updateOne(
      {},
      { $set: { 'content.contactEntryId': new Types.ObjectId() } }
    );
    const changed = await auditShowcasePublicContent();
    approvals.set(
      'recruitment',
      changed.owners.find((row) => row.owner === 'recruitment')!.fingerprint
    );
    await expect(
      reconcileShowcasePublicContent({ confirmed: true, approvals })
    ).rejects.toMatchObject({ code: 'PUBLIC_CONTENT_BLOCKED' });
  });

  it('fails closed for custom state, preserves exact approval, and rejects approval drift', async () => {
    await bootstrapCanonicalContent(actor);
    await HomepageContent.updateOne(
      {},
      { $set: { 'content.mainMessage.en': 'A reviewed fictional scenario' } }
    );
    const before = await snapshot();
    const audit = await auditShowcasePublicContent();
    expect(audit.converged).toBe(false);
    await expect(
      reconcileShowcasePublicContent({ confirmed: true })
    ).rejects.toMatchObject({ code: 'PUBLIC_CONTENT_BLOCKED' });
    const approval = new Map([
      [
        'homepage',
        audit.owners.find((row) => row.owner === 'homepage')!.fingerprint,
      ],
    ]);
    expect(
      (
        await reconcileShowcasePublicContent({
          confirmed: true,
          approvals: approval,
        })
      ).owners.find((row) => row.owner === 'homepage')?.classification
    ).toBe('custom-approved');
    expect(await snapshot()).toBe(before);
    await HomepageContent.updateOne(
      {},
      { $set: { 'content.mainMessage.en': 'Changed fictional scenario' } }
    );
    await expect(
      reconcileShowcasePublicContent({ confirmed: true, approvals: approval })
    ).rejects.toMatchObject({ code: 'CUSTOM_APPROVAL_INVALID' });
  });

  it('rolls back all earlier writes when a later transaction write fails', async () => {
    await legacyState();
    const before = await snapshot();
    const db = mongoose.connection.db!;
    const original = db.collection.bind(db);
    vi.spyOn(db, 'collection').mockImplementation((...args) => {
      const collection = original(...args);
      if (args[0] === ClubInformation.collection.name)
        vi.spyOn(collection, 'updateOne').mockRejectedValue(
          new Error('injected transaction failure')
        );
      return collection;
    });
    await expect(
      reconcileShowcasePublicContent({ confirmed: true })
    ).rejects.toThrow('injected transaction failure');
    vi.restoreAllMocks();
    expect(await snapshot()).toBe(before);
  });

  it('rejects state changed between audit and transaction re-read', async () => {
    await legacyState();
    const startSession = mongoose.startSession.bind(mongoose);
    vi.spyOn(mongoose, 'startSession').mockImplementationOnce(
      async (...args) => {
        await HomepageContent.updateOne(
          {},
          { $set: { 'content.mainMessage.en': 'Changed before transaction' } }
        );
        return startSession(...args);
      }
    );
    await expect(
      reconcileShowcasePublicContent({ confirmed: true })
    ).rejects.toMatchObject({ code: 'PUBLIC_CONTENT_DRIFT' });
    expect(
      (await auditShowcasePublicContent()).owners.find(
        (row) => row.owner === 'contacts'
      )?.classification
    ).toBe('legacy');
  });

  it('does not inspect or mutate excluded scratch records; arbitrary visible owners block without raw diagnostics', async () => {
    await bootstrapCanonicalContent(actor);
    await Announcement.collection.insertOne({
      demoScratchLeaseId: 'test-owned-scratch',
      translations: { de: { title: 'Excluded scratch sentinel' } },
    });
    expect((await auditShowcasePublicContent()).converged).toBe(true);
    await Activity.collection.insertOne({
      translations: { de: { name: 'Private diagnostic sentinel' } },
      images: [],
    });
    const before = await snapshot();
    const audit = await auditShowcasePublicContent();
    expect(audit.converged).toBe(false);
    expect(JSON.stringify(audit)).not.toMatch(
      /sentinel|test-owned-scratch|translations|mongodb/
    );
    await expect(
      reconcileShowcasePublicContent({ confirmed: true })
    ).rejects.toMatchObject({ code: 'PUBLIC_CONTENT_BLOCKED' });
    expect(await snapshot()).toBe(before);
  });
});
