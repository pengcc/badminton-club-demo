import { clubInformationValuesSchema } from '@club/shared-types/api/clubInformation';
import { homepageContentValuesSchema } from '@club/shared-types/api/homepageContent';
import { contactEntryValuesSchema } from '@club/shared-types/api/contact';
import { createLocationSchema } from '@club/shared-types/api/location';
import { membershipPublicContentValuesSchema } from '@club/shared-types/api/membershipPublicContent';
import { tasterSessionPublicContentValuesSchema } from '@club/shared-types/api/tasterSessionPublicContent';
import { recruitmentPublicContentValuesSchema } from '@club/shared-types/api/recruitmentPublicContent';
import { announcementMutationSchema } from '@club/shared-types/api/announcement';
import { activityMutationValuesSchema } from '@club/shared-types/api/activity';
import { publicDocumentUpdateValuesSchema } from '@club/shared-types/api/publicDocument';
import { teamPublicContentValuesSchema } from '@club/shared-types/api/teamPublicContent';
import { createHash } from 'node:crypto';
import mongoose, { Types, type ClientSession } from 'mongoose';
import { HomepageContent } from '../models/Content';
import { ClubInformation } from '../models/ClubInformation';
import { ContactEntry } from '../models/ContactEntry';
import { Location } from '../models/Location';
import { TasterSessionPublicContent } from '../models/TasterSessionPublicContent';
import { MembershipPublicContent } from '../models/MembershipPublicContent';
import { RecruitmentPublicContent } from '../models/RecruitmentPublicContent';
import { Announcement } from '../models/Announcement';
import { Activity } from '../models/Activity';
import { PublicDocument } from '../models/PublicDocument';
import { Settings } from '../models/Settings';
import * as defaults from '../scripts/canonicalContentDefaults';
import { canonicalLocations } from '../scripts/bootstrapCanonicalContent';
import {
  DEVELOPMENT_ACTIVITIES,
  DEVELOPMENT_ANNOUNCEMENTS,
} from '../scripts/developmentPublicContentFixtures';
import { SHOWCASE_LEGACY_PUBLIC_CONTENT as legacy } from '../scripts/showcaseLegacyPublicContentFingerprints';

// One bounded Issue #14 owner. This does not certify core demo data or inspect
// accounts, private applications, sessions, leases, or scratch announcements.
const NOISE = new Set([
  '_id',
  '__v',
  'createdAt',
  'updatedAt',
  'createdBy',
  'updatedBy',
]);
type Row = Record<string, unknown> & { _id: Types.ObjectId };
type Classification =
  | 'missing-bootstrap-owner'
  | 'accepted'
  | 'legacy'
  | 'custom-approved'
  | 'unresolved';

function normalized(value: unknown): unknown {
  if (value instanceof Types.ObjectId) return value.toHexString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, normalized(v)])
    );
  }
  return value;
}

export function showcaseContentFingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(normalized(value)))
    .digest('hex');
}

function businessFields(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => !NOISE.has(key))
  );
}

interface Owner {
  key: string;
  collection: string;
  singleton?: string;
  required: boolean;
  accepted: Record<string, unknown>[];
  legacy: readonly string[];
}

const singleton = (
  key: string,
  collection: string,
  content: Record<string, unknown>,
  fingerprint: string
): Owner => ({
  key,
  collection,
  singleton: key,
  required: true,
  accepted: [content],
  legacy: [fingerprint],
});

function owners(): Owner[] {
  return [
    singleton(
      'homepage',
      HomepageContent.collection.name,
      defaults.CANONICAL_HOMEPAGE_CONTENT,
      legacy.CANONICAL_HOMEPAGE_CONTENT
    ),
    singleton(
      'club',
      ClubInformation.collection.name,
      defaults.CANONICAL_CLUB_INFORMATION,
      legacy.CANONICAL_CLUB_INFORMATION
    ),
    {
      key: 'contacts',
      collection: ContactEntry.collection.name,
      required: true,
      accepted: defaults.CANONICAL_CONTACT_ENTRIES.map(
        ({ retainedQrCode: _unused, ...entry }) => ({
          ...entry,
          qrCode: '',
          qrCodeOriginalFilename: '',
        })
      ),
      legacy: legacy.contacts,
    },
    {
      key: 'locations',
      collection: Location.collection.name,
      required: true,
      accepted: canonicalLocations(new Types.ObjectId()).map(businessFields),
      legacy: legacy.locations,
    },
    singleton(
      'taster-session',
      TasterSessionPublicContent.collection.name,
      defaults.CANONICAL_TASTER_SESSION_PUBLIC_CONTENT,
      legacy.CANONICAL_TASTER_SESSION_PUBLIC_CONTENT
    ),
    singleton(
      'membership',
      MembershipPublicContent.collection.name,
      defaults.CANONICAL_MEMBERSHIP_PUBLIC_CONTENT,
      legacy.CANONICAL_MEMBERSHIP_PUBLIC_CONTENT
    ),
    singleton(
      'recruitment',
      RecruitmentPublicContent.collection.name,
      defaults.CANONICAL_RECRUITMENT_PUBLIC_CONTENT,
      legacy.CANONICAL_RECRUITMENT_PUBLIC_CONTENT
    ),
    {
      key: 'announcements',
      collection: Announcement.collection.name,
      required: false,
      accepted: [...DEVELOPMENT_ANNOUNCEMENTS],
      legacy: [],
    },
    {
      key: 'activities',
      collection: Activity.collection.name,
      required: false,
      accepted: [...DEVELOPMENT_ACTIVITIES],
      legacy: [],
    },
    {
      key: 'public-documents',
      collection: PublicDocument.collection.name,
      required: false,
      accepted: [],
      legacy: [],
    },
    {
      key: 'team-introduction',
      collection: Settings.collection.name,
      required: false,
      accepted: [],
      legacy: [],
    },
  ];
}

export interface ShowcaseOwnerReport {
  owner: string;
  classification: Classification;
  count: number;
  fingerprint: string;
}
export interface ShowcasePublicContentReport {
  scope: 'issue-14-public-content-only';
  converged: boolean;
  owners: ShowcaseOwnerReport[];
  updated: number;
}
interface Inspection {
  report: ShowcasePublicContentReport;
  snapshots: Map<string, Row[]>;
  changes: Array<{ owner: Owner; row: Row; values: Record<string, unknown> }>;
}

export class ShowcaseReconciliationError extends Error {
  constructor(
    public readonly code:
      | 'PUBLIC_CONTENT_BLOCKED'
      | 'PUBLIC_CONTENT_DRIFT'
      | 'CUSTOM_APPROVAL_INVALID'
      | 'APPLY_CONFIRMATION_REQUIRED'
  ) {
    super(code);
  }
}

function projection(owner: Owner, row: Row): unknown {
  if (owner.singleton) return row.content;
  if (owner.key === 'team-introduction') return row.teamPublicContent ?? null;
  return businessFields(row);
}

function validBusinessShape(owner: Owner, row: Row): boolean {
  const value = projection(owner, row);
  switch (owner.key) {
    case 'homepage':
      return homepageContentValuesSchema.safeParse(value).success;
    case 'club':
      return clubInformationValuesSchema.safeParse(value).success;
    case 'taster-session':
      return tasterSessionPublicContentValuesSchema.safeParse(value).success;
    case 'membership':
      return membershipPublicContentValuesSchema.safeParse(value).success;
    case 'recruitment':
      return recruitmentPublicContentValuesSchema.safeParse(normalized(value))
        .success;
    case 'contacts':
      return contactEntryValuesSchema.safeParse({
        ...businessFields(row),
        retainedQrCode: row.qrCode,
      }).success;
    case 'locations':
      return (
        createLocationSchema.safeParse(value).success &&
        Array.isArray(row.timeSlots) &&
        row.timeSlots.every(
          (slot) =>
            slot &&
            typeof slot === 'object' &&
            typeof slot.id === 'string' &&
            slot.id.length > 0
        )
      );
    case 'announcements':
      return announcementMutationSchema.safeParse(value).success;
    case 'activities':
      return activityMutationValuesSchema.safeParse({
        ...businessFields(row),
        retainedImages: row.images,
      }).success;
    case 'public-documents':
      return publicDocumentUpdateValuesSchema.safeParse({
        ...businessFields(row),
        retainedFile: row.fileUrl,
      }).success;
    case 'team-introduction':
      return (
        value === null || teamPublicContentValuesSchema.safeParse(value).success
      );
    default:
      return false;
  }
}

function knownShape(owner: Owner, rows: Row[]): boolean {
  if (!rows.every((row) => validBusinessShape(owner, row))) return false;
  if (owner.key === 'contacts' && rows.length > 4) return false;
  if (owner.singleton) {
    return (
      rows.length === 1 &&
      rows[0].singletonKey === owner.singleton &&
      Object.keys(businessFields(rows[0])).every((k) =>
        ['singletonKey', 'content'].includes(k)
      )
    );
  }
  if (owner.key === 'team-introduction') return rows.length <= 1;
  const fields =
    owner.key === 'public-documents'
      ? ['displayName', 'documentDate', 'fileUrl', 'isVisible', 'order']
      : Object.keys(owner.accepted[0] ?? {});
  return rows.every(
    (row) =>
      row._id instanceof Types.ObjectId &&
      Object.keys(businessFields(row)).every((key) => fields.includes(key))
  );
}

function snapshotFingerprint(owner: Owner, rows: Row[]): string {
  // Bind approval and transactional re-read to both content and document identity.
  return showcaseContentFingerprint(
    rows.map((row) => ({ id: row._id, value: projection(owner, row) }))
  );
}

async function inspect(
  approvals: ReadonlyMap<string, string>,
  session?: ClientSession
): Promise<Inspection> {
  const db = mongoose.connection.db;
  if (!db) throw new ShowcaseReconciliationError('PUBLIC_CONTENT_BLOCKED');
  const snapshots = new Map<string, Row[]>();
  const changes: Inspection['changes'] = [];
  const reports: ShowcaseOwnerReport[] = [];
  const allowedOwners = owners();
  if (
    [...approvals.keys()].some(
      (key) => !allowedOwners.some((owner) => owner.key === key)
    )
  )
    throw new ShowcaseReconciliationError('CUSTOM_APPROVAL_INVALID');
  for (const owner of allowedOwners) {
    const rows = await db
      .collection<Row>(owner.collection)
      .find(
        owner.key === 'announcements'
          ? { demoScratchLeaseId: { $exists: false } }
          : {},
        {
          session,
          projection:
            owner.key === 'team-introduction'
              ? { teamPublicContent: 1 }
              : { createdBy: 0, updatedBy: 0 },
        }
      )
      .sort({ _id: 1 })
      .toArray();
    snapshots.set(owner.key, rows);
    const fingerprint = snapshotFingerprint(owner, rows);
    const approval = approvals.get(owner.key);
    if (approval !== undefined && approval !== fingerprint)
      throw new ShowcaseReconciliationError('CUSTOM_APPROVAL_INVALID');
    let classification: Classification = 'accepted';
    const pending: Inspection['changes'] = [];
    if (!rows.length && owner.required)
      classification = 'missing-bootstrap-owner';
    else if (!knownShape(owner, rows)) classification = 'unresolved';
    else if (owner.key === 'team-introduction') {
      const content = rows[0]?.teamPublicContent as
        | {
            enabled?: boolean;
            title?: Record<string, string>;
            description?: Record<string, string>;
          }
        | undefined;
      if (
        content &&
        (content.enabled !== false ||
          Object.values(content.title ?? {}).some(Boolean) ||
          Object.values(content.description ?? {}).some(Boolean))
      )
        classification = 'unresolved';
    } else {
      for (const row of rows) {
        const value = projection(owner, row);
        const hash = showcaseContentFingerprint(value);
        if (
          owner.accepted.some(
            (accepted) => showcaseContentFingerprint(accepted) === hash
          )
        )
          continue;
        const legacyIndex = owner.legacy.indexOf(hash);
        if (legacyIndex >= 0) {
          const accepted = owner.accepted[legacyIndex];
          pending.push({
            owner,
            row,
            values: owner.singleton ? { content: accepted } : accepted,
          });
          if (classification !== 'unresolved') classification = 'legacy';
        } else classification = 'unresolved';
      }
    }
    // A reviewed custom state is preserved, never rewritten to record approval.
    if (classification === 'unresolved' && approval && knownShape(owner, rows))
      classification = pending.length ? 'legacy' : 'custom-approved';
    if (classification === 'legacy') changes.push(...pending);
    reports.push({
      owner: owner.key,
      classification,
      count: rows.length,
      fingerprint,
    });
  }
  // Contact selection is a real cross-owner reference, including paused content.
  // A selected Contact may legitimately be hidden later by its own capability.
  const contacts = snapshots.get('contacts') ?? [];
  for (const row of snapshots.get('recruitment') ?? []) {
    const content = row.content as
      | { contactEntryId?: unknown; isOpen?: boolean }
      | undefined;
    const id = content?.contactEntryId;
    const contact = contacts.find(
      (candidate) => String(candidate._id) === String(id)
    );
    if ((id != null && !contact) || (content?.isOpen && id == null)) {
      const report = reports.find((value) => value.owner === 'recruitment');
      if (report) report.classification = 'unresolved';
    }
  }
  return {
    report: {
      scope: 'issue-14-public-content-only',
      converged: reports.every((row) =>
        ['accepted', 'custom-approved'].includes(row.classification)
      ),
      owners: reports,
      updated: 0,
    },
    snapshots,
    changes,
  };
}

export async function auditShowcasePublicContent(
  approvals: ReadonlyMap<string, string> = new Map()
): Promise<ShowcasePublicContentReport> {
  return (await inspect(approvals)).report;
}

export async function reconcileShowcasePublicContent(options: {
  confirmed: boolean;
  approvals?: ReadonlyMap<string, string>;
}): Promise<ShowcasePublicContentReport> {
  if (!options.confirmed)
    throw new ShowcaseReconciliationError('APPLY_CONFIRMATION_REQUIRED');
  const approvals = options.approvals ?? new Map();
  const before = await inspect(approvals);
  const blocked = (inspection: Inspection) =>
    inspection.report.owners.some((owner) =>
      ['unresolved', 'missing-bootstrap-owner'].includes(owner.classification)
    );
  if (blocked(before))
    throw new ShowcaseReconciliationError('PUBLIC_CONTENT_BLOCKED');
  const session = await mongoose.startSession();
  try {
    let result: ShowcasePublicContentReport | undefined;
    await session.withTransaction(
      async () => {
        const current = await inspect(approvals, session);
        if (
          blocked(current) ||
          current.report.owners.some(
            (owner, i) =>
              owner.fingerprint !== before.report.owners[i].fingerprint
          )
        )
          throw new ShowcaseReconciliationError('PUBLIC_CONTENT_DRIFT');
        const db = mongoose.connection.db;
        if (!db)
          throw new ShowcaseReconciliationError('PUBLIC_CONTENT_BLOCKED');
        for (const change of current.changes) {
          const outcome = await db
            .collection<Row>(change.owner.collection)
            .updateOne(
              { _id: change.row._id, ...businessFields(change.row) },
              { $set: { ...change.values, updatedAt: new Date() } },
              { session }
            );
          if (outcome.matchedCount !== 1)
            throw new ShowcaseReconciliationError('PUBLIC_CONTENT_DRIFT');
        }
        // An approval attests the custom rows, not permission to retain known legacy
        // defaults beside them. Derive only the expected post-upgrade fingerprint;
        // the final read still has to match that exact state, including identities.
        const afterApprovals = new Map(approvals);
        for (const owner of owners()) {
          if (!approvals.has(owner.key)) continue;
          const rows = current.snapshots.get(owner.key) ?? [];
          const expected = rows.map((row) => {
            const change = current.changes.find(
              (candidate) =>
                candidate.owner.key === owner.key &&
                candidate.row._id.equals(row._id)
            );
            return change ? { ...row, ...change.values } : row;
          });
          afterApprovals.set(owner.key, snapshotFingerprint(owner, expected));
        }
        const after = await inspect(afterApprovals, session);
        if (!after.report.converged)
          throw new ShowcaseReconciliationError('PUBLIC_CONTENT_BLOCKED');
        result = { ...after.report, updated: current.changes.length };
      },
      { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } }
    );
    if (!result)
      throw new ShowcaseReconciliationError('PUBLIC_CONTENT_BLOCKED');
    return result;
  } finally {
    await session.endSession();
  }
}
