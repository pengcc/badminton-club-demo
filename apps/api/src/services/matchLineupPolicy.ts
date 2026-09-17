import {
  Gender,
  LineupPosition,
  LineupViolationCode,
  MatchAvailabilityParticipation,
} from '@club/shared-types/core/enums';
import {
  LINEUP_POSITION_DEFINITIONS,
  LINEUP_POSITION_ORDER,
  compareLineupEntries,
  type MatchLineupIntentEntry,
  type MatchLineupWarning,
} from '@club/shared-types/domain/lineup';
import type { MatchPlayerEligibilityFact } from './membershipEligibilityService';

export interface LineupPolicyPlayerFact extends MatchPlayerEligibilityFact {
  participation: MatchAvailabilityParticipation;
}

const WARNING_ORDER = Object.values(LineupViolationCode);
const POSITION_ORDER = new Map(
  LINEUP_POSITION_ORDER.map((position, index) => [position, index])
);

export function lineupKey(
  entry: Pick<MatchLineupIntentEntry, 'position' | 'playerId'>
): string {
  return `${entry.position}:${entry.playerId}`;
}

export function canonicalizeLineupIntent(
  entries: readonly MatchLineupIntentEntry[]
): MatchLineupIntentEntry[] {
  return [...entries].sort(compareLineupEntries);
}

function compareStringArrays(
  left: readonly string[] | undefined,
  right: readonly string[] | undefined
): number {
  return (left ?? []).join(':').localeCompare((right ?? []).join(':'));
}

function compareWarnings(
  left: MatchLineupWarning,
  right: MatchLineupWarning
): number {
  const codeDifference =
    WARNING_ORDER.indexOf(left.code) - WARNING_ORDER.indexOf(right.code);
  if (codeDifference) return codeDifference;
  const positionDifference =
    (left.position ? (POSITION_ORDER.get(left.position) ?? -1) : -1) -
    (right.position ? (POSITION_ORDER.get(right.position) ?? -1) : -1);
  if (positionDifference) return positionDifference;
  const playerDifference = (left.playerId ?? '').localeCompare(
    right.playerId ?? ''
  );
  if (playerDifference) return playerDifference;
  const positionsDifference = compareStringArrays(
    left.positions,
    right.positions
  );
  return (
    positionsDifference || compareStringArrays(left.playerIds, right.playerIds)
  );
}

function normalizeWarning(warning: MatchLineupWarning): MatchLineupWarning {
  return {
    ...warning,
    ...(warning.positions
      ? {
          positions: [...warning.positions].sort(
            (left, right) =>
              (POSITION_ORDER.get(left) ?? 0) - (POSITION_ORDER.get(right) ?? 0)
          ),
        }
      : {}),
    ...(warning.playerIds ? { playerIds: [...warning.playerIds].sort() } : {}),
  };
}

export function rawDuplicateWarnings(
  entries: readonly MatchLineupIntentEntry[]
): MatchLineupWarning[] {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const key = lineupKey(entry);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return entries
    .filter((entry, index) => {
      const key = lineupKey(entry);
      return (
        counts.get(key)! > 1 &&
        entries.findIndex((candidate) => lineupKey(candidate) === key) === index
      );
    })
    .map((entry) => ({
      code: LineupViolationCode.DUPLICATE_POSITION_ASSIGNMENT,
      position: entry.position,
      playerId: entry.playerId,
    }))
    .sort(compareWarnings);
}

export function classifyLineup(
  entries: readonly MatchLineupIntentEntry[],
  facts: ReadonlyMap<string, LineupPolicyPlayerFact>
): MatchLineupWarning[] {
  const warnings: MatchLineupWarning[] = rawDuplicateWarnings(entries);
  const byPosition: Partial<Record<LineupPosition, MatchLineupIntentEntry[]>> =
    {};
  const positionsByPlayer = new Map<string, Set<LineupPosition>>();

  for (const entry of entries) {
    const positionEntries = byPosition[entry.position] ?? [];
    positionEntries.push(entry);
    byPosition[entry.position] = positionEntries;
    const playerPositions =
      positionsByPlayer.get(entry.playerId) ?? new Set<LineupPosition>();
    playerPositions.add(entry.position);
    positionsByPlayer.set(entry.playerId, playerPositions);

    const fact = facts.get(entry.playerId);
    if (!fact?.referenceAvailable) {
      warnings.push({
        code: LineupViolationCode.PLAYER_REFERENCE_UNAVAILABLE,
        position: entry.position,
        playerId: entry.playerId,
      });
      continue;
    }
    if (!fact.currentlyEligible) {
      warnings.push({
        code: LineupViolationCode.PLAYER_NOT_CURRENTLY_ELIGIBLE,
        position: entry.position,
        playerId: entry.playerId,
      });
    }
    if (!fact.onMatchTeam) {
      warnings.push({
        code: LineupViolationCode.PLAYER_NOT_ON_MATCH_TEAM,
        position: entry.position,
        playerId: entry.playerId,
      });
    }
    if (fact.participation === MatchAvailabilityParticipation.UNAVAILABLE) {
      warnings.push({
        code: LineupViolationCode.PLAYER_UNAVAILABLE,
        position: entry.position,
        playerId: entry.playerId,
      });
    }
    if (
      !fact.gender ||
      !LINEUP_POSITION_DEFINITIONS[entry.position].allowedGenders.includes(
        fact.gender
      )
    ) {
      warnings.push({
        code: LineupViolationCode.POSITION_GENDER_MISMATCH,
        position: entry.position,
        playerId: entry.playerId,
      });
    }
  }

  for (const position of LINEUP_POSITION_ORDER) {
    const positionEntries = byPosition[position] ?? [];
    const definition = LINEUP_POSITION_DEFINITIONS[position];
    if (positionEntries.length > definition.capacity) {
      warnings.push({
        code: LineupViolationCode.POSITION_CAPACITY_EXCEEDED,
        position,
        playerIds: positionEntries.map((entry) => entry.playerId),
      });
    }
    if (definition.mixedComposition && positionEntries.length === 2) {
      const genders = positionEntries.map(
        (entry) => facts.get(entry.playerId)?.gender
      );
      if (
        genders.filter((gender) => gender === Gender.MALE).length !== 1 ||
        genders.filter((gender) => gender === Gender.FEMALE).length !== 1
      ) {
        warnings.push({
          code: LineupViolationCode.MIXED_PAIR_COMPOSITION_INVALID,
          position,
          playerIds: positionEntries.map((entry) => entry.playerId),
        });
      }
    }
  }

  for (const [playerId, positions] of positionsByPlayer) {
    const orderedPositions = [...positions].sort(
      (left, right) =>
        (POSITION_ORDER.get(left) ?? 0) - (POSITION_ORDER.get(right) ?? 0)
    );
    if (positions.size > 2) {
      warnings.push({
        code: LineupViolationCode.PLAYER_EVENT_LIMIT_EXCEEDED,
        playerId,
        positions: orderedPositions,
      });
    }
    const singlesPositions = orderedPositions.filter(
      (position) =>
        LINEUP_POSITION_DEFINITIONS[position].eventKind === 'singles'
    );
    if (singlesPositions.length > 1) {
      warnings.push({
        code: LineupViolationCode.PLAYER_MULTIPLE_SINGLES,
        playerId,
        positions: singlesPositions,
      });
    }
  }

  if (positionsByPlayer.size > 12) {
    warnings.push({
      code: LineupViolationCode.DISTINCT_PLAYER_LIMIT_EXCEEDED,
      playerIds: [...positionsByPlayer.keys()],
    });
  }

  return warnings.map(normalizeWarning).sort(compareWarnings);
}

function warningTouchesNewAssignment(
  warning: MatchLineupWarning,
  newEntries: readonly MatchLineupIntentEntry[]
): boolean {
  if (warning.position && warning.playerId) {
    return newEntries.some(
      (entry) =>
        entry.position === warning.position &&
        entry.playerId === warning.playerId
    );
  }
  if (warning.position) {
    return newEntries.some((entry) => entry.position === warning.position);
  }
  if (warning.playerId) {
    return newEntries.some((entry) => entry.playerId === warning.playerId);
  }
  return newEntries.length > 0;
}

function aggregateScopeKey(warning: MatchLineupWarning): string {
  if (warning.position) return `${warning.code}:position:${warning.position}`;
  if (warning.playerId) return `${warning.code}:player:${warning.playerId}`;
  return `${warning.code}:lineup`;
}

function aggregateMeasure(
  warning: MatchLineupWarning,
  entries: readonly MatchLineupIntentEntry[]
): number {
  if (warning.code === LineupViolationCode.POSITION_CAPACITY_EXCEEDED) {
    return entries.filter((entry) => entry.position === warning.position)
      .length;
  }
  if (warning.code === LineupViolationCode.PLAYER_EVENT_LIMIT_EXCEEDED) {
    return new Set(
      entries
        .filter((entry) => entry.playerId === warning.playerId)
        .map((entry) => entry.position)
    ).size;
  }
  if (warning.code === LineupViolationCode.PLAYER_MULTIPLE_SINGLES) {
    return new Set(
      entries
        .filter(
          (entry) =>
            entry.playerId === warning.playerId &&
            LINEUP_POSITION_DEFINITIONS[entry.position].eventKind === 'singles'
        )
        .map((entry) => entry.position)
    ).size;
  }
  if (warning.code === LineupViolationCode.DISTINCT_PLAYER_LIMIT_EXCEEDED) {
    return new Set(entries.map((entry) => entry.playerId)).size;
  }
  return 1;
}

const ASSIGNMENT_VIOLATIONS = new Set([
  LineupViolationCode.PLAYER_REFERENCE_UNAVAILABLE,
  LineupViolationCode.PLAYER_NOT_CURRENTLY_ELIGIBLE,
  LineupViolationCode.PLAYER_NOT_ON_MATCH_TEAM,
  LineupViolationCode.PLAYER_UNAVAILABLE,
  LineupViolationCode.POSITION_GENDER_MISMATCH,
  LineupViolationCode.DUPLICATE_POSITION_ASSIGNMENT,
]);

export function blockingLineupWarnings(input: {
  currentEntries: readonly MatchLineupIntentEntry[];
  proposedEntries: readonly MatchLineupIntentEntry[];
  baselineWarnings: readonly MatchLineupWarning[];
  proposedWarnings: readonly MatchLineupWarning[];
  newEntries: readonly MatchLineupIntentEntry[];
}): MatchLineupWarning[] {
  const baselineByScope = new Map(
    input.baselineWarnings.map((warning) => [
      aggregateScopeKey(warning),
      aggregateMeasure(warning, input.currentEntries),
    ])
  );
  return input.proposedWarnings.filter((warning) => {
    if (ASSIGNMENT_VIOLATIONS.has(warning.code)) {
      return warningTouchesNewAssignment(warning, input.newEntries);
    }
    const proposedMeasure = aggregateMeasure(warning, input.proposedEntries);
    const baselineMeasure = baselineByScope.get(aggregateScopeKey(warning));
    return (
      warningTouchesNewAssignment(warning, input.newEntries) ||
      baselineMeasure === undefined ||
      proposedMeasure > baselineMeasure
    );
  });
}
