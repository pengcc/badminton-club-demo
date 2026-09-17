import { createHash } from 'node:crypto';
import mongoose, { Types, type ClientSession } from 'mongoose';
import type { LocationTasterSessionLevel } from '@club/shared-types/api/location';
import { Location } from '../models/Location';

const LEGACY_LOCATION_FIELDS = new Set([
  '_id',
  'id',
  'name',
  'address',
  'active',
]);
const LEGACY_SESSION_FIELDS = new Set([
  '_id',
  'id',
  'locationId',
  'dayOfWeek',
  'startTime',
  'endTime',
  'active',
  'acceptedLevels',
  'capacityPerSlot',
]);
const LEVELS = new Set<LocationTasterSessionLevel>(['beginner', 'experienced']);
const DEFAULT_LEVELS: LocationTasterSessionLevel[] = [
  'beginner',
  'experienced',
];
const WEEKDAY_BY_LEGACY_NUMBER = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export interface LegacyTasterSessionConfiguration {
  locations: Array<
    Record<string, unknown> & {
      id: string;
      address: string;
      active: boolean;
    }
  >;
  sessions: Array<
    Record<string, unknown> & {
      id: string;
      locationId: string;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      active: boolean;
      acceptedLevels: unknown[];
      capacityPerSlot?: number;
    }
  >;
}

export interface SharedTasterSourceTimeSlot extends Record<string, unknown> {
  id: string;
  weekday: string;
  startTime: string;
  endTime: string;
  active: boolean;
  guestPlayEnabled?: boolean;
  tasterSessionEnabled?: boolean;
  tasterSessionAcceptedLevels?: unknown[];
}

export interface SharedTasterSourceLocation {
  id: string;
  isActive: boolean;
  translations: Record<string, { address?: string }>;
  timeSlots: SharedTasterSourceTimeSlot[];
}

export interface TasterSourcePolicySnapshot {
  enabledPresent: boolean;
  enabled: boolean | null;
  acceptedLevelsPresent: boolean;
  acceptedLevels: LocationTasterSessionLevel[] | null;
}

export interface TasterSourcePolicyTransfer {
  legacySessionId: string;
  locationId: string;
  normalizedLocationAddress: string;
  expectedLocationActive: boolean;
  timeSlotId: string;
  expectedWeekday: string;
  expectedStartTime: string;
  expectedEndTime: string;
  expectedTimeSlotActive: boolean;
  expectedTasterSessionPolicy: TasterSourcePolicySnapshot;
  tasterSessionEnabled: boolean;
  tasterSessionAcceptedLevels: LocationTasterSessionLevel[];
}

export type TasterSourceSharedSlotClassification =
  | 'legacy_mapping'
  | 'explicit_policy'
  | 'approved_unrestricted'
  | 'unclassified';

export interface TasterSourceSharedSlotEvidence {
  locationId: string;
  timeSlotId: string;
  weekday: string;
  startTime: string;
  endTime: string;
  classification: TasterSourceSharedSlotClassification;
  unrestrictedApprovalKey?: string;
}

export interface TasterSourceConsolidationReport {
  transfers: TasterSourcePolicyTransfer[];
  sharedSlotEvidence: TasterSourceSharedSlotEvidence[];
  blockers: string[];
  obsoleteCapacityFieldCount: number;
}

export interface TasterSourceInspectionOptions {
  approvedUnrestrictedSlots?: ReadonlySet<string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isLocalTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function normalizeAddress(value: string): string {
  return value.trim().toLocaleLowerCase('de-DE').replace(/\s+/g, ' ');
}

function extraFields(
  value: Record<string, unknown>,
  allowed: Set<string>
): string[] {
  return Object.keys(value).filter((field) => !allowed.has(field));
}

function normalizeLevels(
  value: unknown
): LocationTasterSessionLevel[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const levels = value.filter(
    (level): level is LocationTasterSessionLevel =>
      typeof level === 'string' &&
      LEVELS.has(level as LocationTasterSessionLevel)
  );
  if (
    levels.length !== value.length ||
    new Set(levels).size !== levels.length
  ) {
    return undefined;
  }
  return [...levels].sort();
}

function policySnapshot(
  slot: Record<string, unknown>
): TasterSourcePolicySnapshot | undefined {
  const enabledPresent = Object.hasOwn(slot, 'tasterSessionEnabled');
  const acceptedLevelsPresent = Object.hasOwn(
    slot,
    'tasterSessionAcceptedLevels'
  );
  const enabled = enabledPresent ? slot.tasterSessionEnabled : null;
  const acceptedLevels = acceptedLevelsPresent
    ? normalizeLevels(slot.tasterSessionAcceptedLevels)
    : null;

  if (
    (enabledPresent && typeof enabled !== 'boolean') ||
    (acceptedLevelsPresent && acceptedLevels === undefined)
  ) {
    return undefined;
  }
  const effectiveEnabled = enabledPresent ? enabled === true : true;
  const effectiveLevels = acceptedLevelsPresent
    ? (acceptedLevels ?? [])
    : DEFAULT_LEVELS;
  if (effectiveEnabled && effectiveLevels.length === 0) return undefined;

  return {
    enabledPresent,
    enabled: enabled as boolean | null,
    acceptedLevelsPresent,
    acceptedLevels: acceptedLevels ?? null,
  };
}

function snapshotsEqual(
  left: TasterSourcePolicySnapshot,
  right: TasterSourcePolicySnapshot
): boolean {
  return (
    left.enabledPresent === right.enabledPresent &&
    left.enabled === right.enabled &&
    left.acceptedLevelsPresent === right.acceptedLevelsPresent &&
    (left.acceptedLevels ?? []).join(',') ===
      (right.acceptedLevels ?? []).join(',')
  );
}

function targetPolicySnapshot(
  transfer: TasterSourcePolicyTransfer
): TasterSourcePolicySnapshot {
  return {
    enabledPresent: true,
    enabled: transfer.tasterSessionEnabled,
    acceptedLevelsPresent: true,
    acceptedLevels: transfer.tasterSessionAcceptedLevels,
  };
}

function normalizedAddresses(location: SharedTasterSourceLocation): string[] {
  return [
    ...new Set(
      Object.values(location.translations)
        .filter(isRecord)
        .map((translation) => translation.address)
        .filter((address): address is string => typeof address === 'string')
        .map(normalizeAddress)
    ),
  ].sort();
}

export function tasterSourceUnrestrictedApprovalKey(
  location: SharedTasterSourceLocation,
  slot: SharedTasterSourceTimeSlot
): string {
  return createHash('sha256')
    .update(
      [
        location.id,
        normalizedAddresses(location).join('|'),
        slot.id,
        slot.weekday,
        slot.startTime,
        slot.endTime,
      ].join(':')
    )
    .digest('hex')
    .slice(0, 24);
}

function validateSharedSource(
  sharedLocations: SharedTasterSourceLocation[],
  blockers: string[]
): SharedTasterSourceLocation[] {
  const validLocations: SharedTasterSourceLocation[] = [];
  for (const [locationIndex, location] of sharedLocations.entries()) {
    if (
      !isRecord(location) ||
      typeof location.id !== 'string' ||
      location.id.length === 0 ||
      typeof location.isActive !== 'boolean' ||
      !isRecord(location.translations) ||
      !Array.isArray(location.timeSlots)
    ) {
      blockers.push(`invalid_shared_location:${locationIndex}`);
      continue;
    }
    const addresses = normalizedAddresses(location);
    if (addresses.length === 0) {
      blockers.push(`invalid_shared_location_address:${location.id}`);
      continue;
    }

    const validSlots: SharedTasterSourceTimeSlot[] = [];
    for (const [slotIndex, slot] of location.timeSlots.entries()) {
      if (
        !isRecord(slot) ||
        typeof slot.id !== 'string' ||
        slot.id.length === 0 ||
        typeof slot.weekday !== 'string' ||
        !isLocalTime(slot.startTime) ||
        !isLocalTime(slot.endTime) ||
        slot.endTime <= slot.startTime ||
        typeof slot.active !== 'boolean'
      ) {
        blockers.push(`invalid_shared_slot:${location.id}:${slotIndex}`);
        continue;
      }
      if (!policySnapshot(slot)) {
        blockers.push(`invalid_shared_taster_policy:${location.id}:${slot.id}`);
        continue;
      }
      validSlots.push(slot);
    }
    validLocations.push({ ...location, timeSlots: validSlots });
  }
  return validLocations;
}

export function inspectTasterSessionSourceConsolidation(
  legacy: LegacyTasterSessionConfiguration | undefined,
  sharedLocations: SharedTasterSourceLocation[],
  options: TasterSourceInspectionOptions = {}
): TasterSourceConsolidationReport {
  if (!legacy) {
    return {
      transfers: [],
      sharedSlotEvidence: [],
      blockers: ['legacy_trial_training_source_missing'],
      obsoleteCapacityFieldCount: 0,
    };
  }

  const blockers: string[] = [];
  const transfers: TasterSourcePolicyTransfer[] = [];
  const sharedSlotEvidence: TasterSourceSharedSlotEvidence[] = [];
  if (!Array.isArray(legacy.locations) || !Array.isArray(legacy.sessions)) {
    return {
      transfers,
      sharedSlotEvidence,
      blockers: ['invalid_legacy_trial_training_shape'],
      obsoleteCapacityFieldCount: 0,
    };
  }
  const validSharedLocations = validateSharedSource(sharedLocations, blockers);
  const legacyLocations = new Map<
    string,
    LegacyTasterSessionConfiguration['locations'][number]
  >();
  let obsoleteCapacityFieldCount = 0;
  const topLevelFields = Object.keys(
    legacy as unknown as Record<string, unknown>
  ).filter((field) => field !== 'locations' && field !== 'sessions');
  if (topLevelFields.length > 0) {
    blockers.push(
      `unclassified_legacy_configuration_fields:${topLevelFields.sort().join(',')}`
    );
  }

  legacy.locations.forEach((location, index) => {
    if (
      !isRecord(location) ||
      typeof location.id !== 'string' ||
      location.id.length === 0 ||
      typeof location.address !== 'string' ||
      typeof location.active !== 'boolean'
    ) {
      blockers.push(`invalid_legacy_location:${index}`);
      return;
    }
    const extra = extraFields(location, LEGACY_LOCATION_FIELDS);
    if (extra.length > 0) {
      blockers.push(
        `unclassified_legacy_location_fields:${location.id}:${extra.sort().join(',')}`
      );
    }
    if (legacyLocations.has(location.id)) {
      blockers.push(`duplicate_legacy_location_id:${location.id}`);
      return;
    }
    legacyLocations.set(location.id, location);
  });

  for (const [index, session] of legacy.sessions.entries()) {
    if (
      !isRecord(session) ||
      typeof session.id !== 'string' ||
      session.id.length === 0 ||
      typeof session.locationId !== 'string' ||
      !Number.isInteger(session.dayOfWeek) ||
      session.dayOfWeek < 0 ||
      session.dayOfWeek > 6 ||
      !isLocalTime(session.startTime) ||
      !isLocalTime(session.endTime) ||
      session.endTime <= session.startTime ||
      typeof session.active !== 'boolean' ||
      !Array.isArray(session.acceptedLevels)
    ) {
      blockers.push(`invalid_legacy_session:${index}`);
      continue;
    }
    const extra = extraFields(session, LEGACY_SESSION_FIELDS);
    if (extra.length > 0) {
      blockers.push(
        `unclassified_legacy_session_fields:${session.id}:${extra.sort().join(',')}`
      );
    }
    if (session.capacityPerSlot !== undefined) obsoleteCapacityFieldCount += 1;

    const legacyLocation = legacyLocations.get(session.locationId);
    if (!legacyLocation) {
      blockers.push(
        `legacy_location_missing:${session.id}:${session.locationId}`
      );
      continue;
    }
    const acceptedLevels = normalizeLevels(session.acceptedLevels);
    if (!acceptedLevels || acceptedLevels.length === 0) {
      blockers.push(`invalid_accepted_levels:${session.id}`);
      continue;
    }

    const address = normalizeAddress(legacyLocation.address);
    const weekday = WEEKDAY_BY_LEGACY_NUMBER[session.dayOfWeek];
    const candidates = validSharedLocations.flatMap((location) => {
      if (!normalizedAddresses(location).includes(address)) return [];
      return location.timeSlots
        .filter(
          (slot) =>
            slot.weekday === weekday &&
            slot.startTime === session.startTime &&
            slot.endTime === session.endTime
        )
        .map((slot) => ({ location, slot }));
    });

    if (candidates.length === 0) {
      blockers.push(`shared_slot_match_missing:${session.id}`);
      continue;
    }
    if (candidates.length > 1) {
      blockers.push(`shared_slot_match_ambiguous:${session.id}`);
      continue;
    }
    const [{ location, slot }] = candidates;
    transfers.push({
      legacySessionId: session.id,
      locationId: location.id,
      normalizedLocationAddress: address,
      expectedLocationActive: location.isActive,
      timeSlotId: slot.id,
      expectedWeekday: slot.weekday,
      expectedStartTime: slot.startTime,
      expectedEndTime: slot.endTime,
      expectedTimeSlotActive: slot.active,
      expectedTasterSessionPolicy: policySnapshot(slot)!,
      tasterSessionEnabled: legacyLocation.active && session.active,
      tasterSessionAcceptedLevels: acceptedLevels,
    });
  }

  const bySharedSlot = new Map<string, TasterSourcePolicyTransfer>();
  for (const transfer of transfers) {
    const key = `${transfer.locationId}:${transfer.timeSlotId}`;
    const previous = bySharedSlot.get(key);
    if (
      previous &&
      (previous.tasterSessionEnabled !== transfer.tasterSessionEnabled ||
        previous.tasterSessionAcceptedLevels.join(',') !==
          transfer.tasterSessionAcceptedLevels.join(','))
    ) {
      blockers.push(`conflicting_legacy_policy:${key}`);
    } else if (!previous) {
      bySharedSlot.set(key, transfer);
    }
  }

  for (const location of validSharedLocations) {
    if (!location.isActive) continue;
    for (const slot of location.timeSlots) {
      if (!slot.active) continue;
      const key = `${location.id}:${slot.id}`;
      let classification: TasterSourceSharedSlotClassification;
      let unrestrictedApprovalKey: string | undefined;
      if (bySharedSlot.has(key)) {
        classification = 'legacy_mapping';
      } else {
        const snapshot = policySnapshot(slot)!;
        const explicitPolicy =
          snapshot.enabledPresent || snapshot.acceptedLevelsPresent;
        unrestrictedApprovalKey = tasterSourceUnrestrictedApprovalKey(
          location,
          slot
        );
        if (explicitPolicy) {
          classification = 'explicit_policy';
        } else if (
          options.approvedUnrestrictedSlots?.has(unrestrictedApprovalKey)
        ) {
          classification = 'approved_unrestricted';
        } else {
          classification = 'unclassified';
          blockers.push(
            `unclassified_shared_slot:${location.id}:${slot.id}:${slot.weekday}:${slot.startTime}:${slot.endTime}:approval=${unrestrictedApprovalKey}`
          );
        }
      }
      sharedSlotEvidence.push({
        locationId: location.id,
        timeSlotId: slot.id,
        weekday: slot.weekday,
        startTime: slot.startTime,
        endTime: slot.endTime,
        classification,
        ...(classification === 'unclassified' ||
        classification === 'approved_unrestricted'
          ? { unrestrictedApprovalKey }
          : {}),
      });
    }
  }

  return {
    transfers: [...bySharedSlot.values()],
    sharedSlotEvidence,
    blockers: [...new Set(blockers)].sort(),
    obsoleteCapacityFieldCount,
  };
}

export async function loadRawSharedTasterSourceLocations(
  session?: ClientSession
): Promise<SharedTasterSourceLocation[]> {
  const documents = await Location.collection
    .find(
      {},
      {
        session,
        projection: {
          isActive: 1,
          translations: 1,
          timeSlots: 1,
        },
      }
    )
    .toArray();
  return documents.map((document) => ({
    id: String(document._id),
    isActive: document.isActive as boolean,
    translations:
      document.translations as SharedTasterSourceLocation['translations'],
    timeSlots: document.timeSlots as SharedTasterSourceTimeSlot[],
  }));
}

export function validateTasterSessionSourceTransferTargets(
  transfers: TasterSourcePolicyTransfer[],
  currentLocations: SharedTasterSourceLocation[]
): string[] {
  const blockers: string[] = [];
  for (const transfer of transfers) {
    const location = currentLocations.find(
      (candidate) => candidate.id === transfer.locationId
    );
    const slot = location?.timeSlots.find(
      (candidate) => candidate.id === transfer.timeSlotId
    );
    if (!location || !slot) {
      blockers.push(
        `shared_transfer_target_missing:${transfer.locationId}:${transfer.timeSlotId}`
      );
      continue;
    }
    const currentPolicy = policySnapshot(slot);
    const expectedPolicy = transfer.expectedTasterSessionPolicy;
    const alreadyApplied =
      currentPolicy &&
      snapshotsEqual(currentPolicy, targetPolicySnapshot(transfer));
    if (
      location.isActive !== transfer.expectedLocationActive ||
      !normalizedAddresses(location).includes(
        transfer.normalizedLocationAddress
      ) ||
      slot.weekday !== transfer.expectedWeekday ||
      slot.startTime !== transfer.expectedStartTime ||
      slot.endTime !== transfer.expectedEndTime ||
      slot.active !== transfer.expectedTimeSlotActive ||
      !currentPolicy ||
      (!snapshotsEqual(currentPolicy, expectedPolicy) && !alreadyApplied)
    ) {
      blockers.push(
        `shared_transfer_facts_changed:${transfer.locationId}:${transfer.timeSlotId}`
      );
    }
  }
  return blockers;
}

function mongoLocationId(locationId: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(locationId)) {
    throw new Error(`Invalid shared Location identity: ${locationId}`);
  }
  return new Types.ObjectId(locationId);
}

export async function applyTasterSessionSourceTransfers(
  transfers: TasterSourcePolicyTransfer[]
): Promise<void> {
  await mongoose.connection.transaction(async (session) => {
    const currentLocations = await loadRawSharedTasterSourceLocations(session);
    const blockers = validateTasterSessionSourceTransferTargets(
      transfers,
      currentLocations
    );
    if (blockers.length > 0) {
      throw new Error(
        `Taster Session source apply blocked: ${blockers.join(', ')}`
      );
    }

    for (const transfer of transfers) {
      const result = await Location.collection.updateOne(
        {
          _id: mongoLocationId(transfer.locationId),
          isActive: transfer.expectedLocationActive,
          timeSlots: {
            $elemMatch: {
              id: transfer.timeSlotId,
              weekday: transfer.expectedWeekday,
              startTime: transfer.expectedStartTime,
              endTime: transfer.expectedEndTime,
              active: transfer.expectedTimeSlotActive,
            },
          },
        },
        {
          $set: {
            'timeSlots.$.tasterSessionEnabled': transfer.tasterSessionEnabled,
            'timeSlots.$.tasterSessionAcceptedLevels':
              transfer.tasterSessionAcceptedLevels,
          },
        },
        { session }
      );
      if (result.matchedCount !== 1) {
        throw new Error(
          `Shared slot changed during apply: ${transfer.locationId}:${transfer.timeSlotId}`
        );
      }
    }
  });
}
