import type { Connection } from 'mongoose';
import {
  TASTER_SESSION_COLLECTION,
  TASTER_SESSION_INDEX_MANIFEST,
  TASTER_SESSION_PENDING_EMAIL_INDEX,
  TASTER_SESSION_PENDING_EMAIL_INDEX_KEYS,
} from '../config/tasterSessionPersistence';

const CANONICAL_STATUSES = ['pending', 'invited', 'declined'] as const;
const LEGACY_STATUSES = ['contacted', 'no_capacity', 'archived'] as const;

export interface TasterSessionReadinessReport {
  collection: typeof TASTER_SESSION_COLLECTION;
  documentCount: number;
  statusCounts: Record<string, number>;
  legacyStatusCount: number;
  unknownOrMissingStatusCount: number;
  missingArchivedCount: number;
  missingDeliveryCount: number;
  legacyAppointmentFieldCount: number;
  missingOrUnnormalizedEmailCount: number;
  duplicatePendingNormalizedEmailGroups: number;
  duplicatePendingDocuments: number;
  index: {
    name: typeof TASTER_SESSION_PENDING_EMAIL_INDEX;
    present: boolean;
    compatible: boolean;
    conflictingNamedIndex: boolean;
    safeToCreate: boolean;
  };
  blockers: string[];
  readyForDeployment: boolean;
}

export interface TasterSessionReleasePrerequisiteReport {
  pendingMissingOrUnnormalizedEmailCount: number;
  duplicatePendingNormalizedEmailGroups: number;
  duplicatePendingDocuments: number;
  index: {
    name: typeof TASTER_SESSION_PENDING_EMAIL_INDEX;
    present: boolean;
    compatible: boolean;
    conflictingNamedIndex: boolean;
  };
  ready: boolean;
}

export class TasterSessionReadinessBlockedError extends Error {
  constructor(
    public readonly report:
      | TasterSessionReadinessReport
      | TasterSessionReleasePrerequisiteReport
  ) {
    super('Taster Session persistence readiness is blocked');
    this.name = 'TasterSessionReadinessBlockedError';
  }
}

function indexMatches(index: {
  key?: Record<string, unknown>;
  unique?: boolean;
  partialFilterExpression?: Record<string, unknown>;
}): boolean {
  return (
    JSON.stringify(index.key) ===
      JSON.stringify(TASTER_SESSION_PENDING_EMAIL_INDEX_KEYS) &&
    index.unique === true &&
    index.partialFilterExpression?.status === 'pending'
  );
}

export async function inspectTasterSessionReleasePrerequisite(
  connection: Connection
): Promise<TasterSessionReleasePrerequisiteReport> {
  const database = connection.db;
  if (!database) throw new Error('MongoDB connection is not ready');
  const collection = database.collection(TASTER_SESSION_COLLECTION);
  const collectionExists =
    (
      await database
        .listCollections(
          { name: TASTER_SESSION_COLLECTION },
          { nameOnly: true }
        )
        .toArray()
    ).length > 0;
  const [
    pendingMissingOrUnnormalizedEmailCount,
    duplicatePendingGroups,
    indexes,
  ] = collectionExists
    ? await Promise.all([
        collection.countDocuments({
          status: 'pending',
          $expr: {
            $ne: [
              '$email',
              {
                $toLower: {
                  $trim: { input: { $ifNull: ['$email', ''] } },
                },
              },
            ],
          },
        }),
        collection
          .aggregate<{ _id: null; groups: number; documents: number }>([
            { $match: { status: 'pending' } },
            {
              $project: {
                normalizedEmail: {
                  $toLower: {
                    $trim: { input: { $ifNull: ['$email', ''] } },
                  },
                },
              },
            },
            {
              $group: {
                _id: '$normalizedEmail',
                count: { $sum: 1 },
              },
            },
            {
              $match: {
                $or: [{ _id: '' }, { count: { $gt: 1 } }],
              },
            },
            {
              $group: {
                _id: null,
                groups: { $sum: 1 },
                documents: { $sum: '$count' },
              },
            },
          ])
          .toArray(),
        collection.indexes(),
      ])
    : [0, [], []];
  const duplicateSummary = duplicatePendingGroups[0];
  const namedIndex = indexes.find(
    (index) => index.name === TASTER_SESSION_PENDING_EMAIL_INDEX
  );
  const compatible = Boolean(namedIndex && indexMatches(namedIndex));
  const conflictingNamedIndex = Boolean(namedIndex && !compatible);

  return {
    pendingMissingOrUnnormalizedEmailCount,
    duplicatePendingNormalizedEmailGroups: duplicateSummary?.groups ?? 0,
    duplicatePendingDocuments: duplicateSummary?.documents ?? 0,
    index: {
      name: TASTER_SESSION_PENDING_EMAIL_INDEX,
      present: namedIndex !== undefined,
      compatible,
      conflictingNamedIndex,
    },
    ready:
      compatible &&
      pendingMissingOrUnnormalizedEmailCount === 0 &&
      (duplicateSummary?.groups ?? 0) === 0,
  };
}

export async function inspectTasterSessionReadiness(
  connection: Connection
): Promise<TasterSessionReadinessReport> {
  const database = connection.db;
  if (!database) throw new Error('MongoDB connection is not ready');
  const collection = database.collection(TASTER_SESSION_COLLECTION);
  const collectionExists =
    (
      await database
        .listCollections(
          { name: TASTER_SESSION_COLLECTION },
          { nameOnly: true }
        )
        .toArray()
    ).length > 0;

  const [
    documentCount,
    statusGroups,
    missingArchivedCount,
    missingDeliveryCount,
    legacyAppointmentFieldCount,
    missingOrUnnormalizedEmailCount,
    duplicatePendingGroups,
    indexes,
  ] = collectionExists
    ? await Promise.all([
        collection.countDocuments(),
        collection
          .aggregate<{ _id: unknown; count: number }>([
            { $group: { _id: '$status', count: { $sum: 1 } } },
          ])
          .toArray(),
        collection.countDocuments({ archived: { $exists: false } }),
        collection.countDocuments({
          $or: [
            { delivery: { $exists: false } },
            { 'delivery.status': { $exists: false } },
          ],
        }),
        collection.countDocuments({
          $or: [
            { appointmentDate: { $exists: true } },
            { locationId: { $exists: true } },
            { locationName: { $exists: true } },
            { sessionId: { $exists: true } },
            { processedBy: { $exists: true } },
            { processedAt: { $exists: true } },
          ],
        }),
        collection.countDocuments({
          $expr: {
            $ne: [
              '$email',
              {
                $toLower: {
                  $trim: { input: { $ifNull: ['$email', ''] } },
                },
              },
            ],
          },
        }),
        collection
          .aggregate<{ _id: null; groups: number; documents: number }>([
            { $match: { status: 'pending' } },
            {
              $project: {
                normalizedEmail: {
                  $toLower: {
                    $trim: { input: { $ifNull: ['$email', ''] } },
                  },
                },
              },
            },
            {
              $group: {
                _id: '$normalizedEmail',
                count: { $sum: 1 },
              },
            },
            {
              $match: {
                $or: [{ _id: '' }, { count: { $gt: 1 } }],
              },
            },
            {
              $group: {
                _id: null,
                groups: { $sum: 1 },
                documents: { $sum: '$count' },
              },
            },
          ])
          .toArray(),
        collection.indexes(),
      ])
    : [0, [], 0, 0, 0, 0, [], []];

  const statusCounts = Object.fromEntries(
    statusGroups.map(({ _id, count }) => [
      typeof _id === 'string' ? _id : '<missing>',
      count,
    ])
  );
  const legacyStatusCount = LEGACY_STATUSES.reduce(
    (total, status) => total + (statusCounts[status] ?? 0),
    0
  );
  const knownStatusCount = [...CANONICAL_STATUSES, ...LEGACY_STATUSES].reduce(
    (total, status) => total + (statusCounts[status] ?? 0),
    0
  );
  const unknownOrMissingStatusCount = documentCount - knownStatusCount;
  const duplicateSummary = duplicatePendingGroups[0];
  const compatibleIndex = indexes.find(indexMatches);
  const namedIndex = indexes.find(
    (index) => index.name === TASTER_SESSION_PENDING_EMAIL_INDEX
  );
  const conflictingNamedIndex = Boolean(
    namedIndex && !indexMatches(namedIndex)
  );

  const blockers: string[] = [];
  if (legacyStatusCount > 0)
    blockers.push('legacy_business_status_mapping_required');
  if (unknownOrMissingStatusCount > 0)
    blockers.push('unknown_or_missing_business_status');
  if (missingArchivedCount > 0)
    blockers.push('missing_archive_lifecycle_fields');
  if (missingDeliveryCount > 0) blockers.push('missing_delivery_fields');
  if (legacyAppointmentFieldCount > 0)
    blockers.push('legacy_appointment_fields_present');
  if (missingOrUnnormalizedEmailCount > 0)
    blockers.push('missing_or_unnormalized_email');
  if ((duplicateSummary?.groups ?? 0) > 0)
    blockers.push('duplicate_pending_normalized_email');
  if (conflictingNamedIndex) blockers.push('conflicting_pending_email_index');

  const compatible = compatibleIndex !== undefined;
  const safeToCreate = blockers.length === 0;
  return {
    collection: TASTER_SESSION_COLLECTION,
    documentCount,
    statusCounts,
    legacyStatusCount,
    unknownOrMissingStatusCount,
    missingArchivedCount,
    missingDeliveryCount,
    legacyAppointmentFieldCount,
    missingOrUnnormalizedEmailCount,
    duplicatePendingNormalizedEmailGroups: duplicateSummary?.groups ?? 0,
    duplicatePendingDocuments: duplicateSummary?.documents ?? 0,
    index: {
      name: TASTER_SESSION_PENDING_EMAIL_INDEX,
      present: compatible,
      compatible,
      conflictingNamedIndex,
      safeToCreate,
    },
    blockers,
    readyForDeployment: blockers.length === 0 && compatible,
  };
}

export async function ensureTasterSessionIndexes(
  connection: Connection
): Promise<TasterSessionReleasePrerequisiteReport> {
  const before = await inspectTasterSessionReleasePrerequisite(connection);
  if (
    before.pendingMissingOrUnnormalizedEmailCount > 0 ||
    before.duplicatePendingNormalizedEmailGroups > 0 ||
    before.index.conflictingNamedIndex
  ) {
    throw new TasterSessionReadinessBlockedError(before);
  }
  const database = connection.db;
  if (!database) throw new Error('MongoDB connection is not ready');
  const collection = database.collection(TASTER_SESSION_COLLECTION);
  for (const { keys, options } of TASTER_SESSION_INDEX_MANIFEST) {
    await collection.createIndex(keys, options);
  }
  const after = await inspectTasterSessionReleasePrerequisite(connection);
  if (!after.ready) {
    throw new TasterSessionReadinessBlockedError(after);
  }
  return after;
}
