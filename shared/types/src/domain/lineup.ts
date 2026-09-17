import {
  Gender,
  LineupPosition,
  LineupViolationCode,
  MatchAvailabilityParticipation,
} from '../core/enums';

export type LineupEventKind = 'singles' | 'doubles';
export type LineupRankingKind = 'singles' | 'doubles';

export interface LineupPositionDefinition {
  position: LineupPosition;
  order: number;
  capacity: 1 | 2;
  eventKind: LineupEventKind;
  rankingKind: LineupRankingKind;
  allowedGenders: readonly Gender[];
  mixedComposition: boolean;
}

export const LINEUP_POSITION_ORDER = [
  LineupPosition.MEN_SINGLES_1,
  LineupPosition.MEN_SINGLES_2,
  LineupPosition.OPEN_SINGLES,
  LineupPosition.WOMEN_SINGLES,
  LineupPosition.MENS_DOUBLES,
  LineupPosition.OPEN_DOUBLES,
  LineupPosition.WOMEN_DOUBLES,
  LineupPosition.MIXED_DOUBLES,
] as const;

const ALL_GENDERS = [Gender.MALE, Gender.FEMALE, Gender.NON_BINARY] as const;

export const LINEUP_POSITION_DEFINITIONS: Record<
  LineupPosition,
  LineupPositionDefinition
> = {
  [LineupPosition.MEN_SINGLES_1]: {
    position: LineupPosition.MEN_SINGLES_1,
    order: 0,
    capacity: 1,
    eventKind: 'singles',
    rankingKind: 'singles',
    allowedGenders: [Gender.MALE],
    mixedComposition: false,
  },
  [LineupPosition.MEN_SINGLES_2]: {
    position: LineupPosition.MEN_SINGLES_2,
    order: 1,
    capacity: 1,
    eventKind: 'singles',
    rankingKind: 'singles',
    allowedGenders: [Gender.MALE],
    mixedComposition: false,
  },
  [LineupPosition.OPEN_SINGLES]: {
    position: LineupPosition.OPEN_SINGLES,
    order: 2,
    capacity: 1,
    eventKind: 'singles',
    rankingKind: 'singles',
    allowedGenders: ALL_GENDERS,
    mixedComposition: false,
  },
  [LineupPosition.WOMEN_SINGLES]: {
    position: LineupPosition.WOMEN_SINGLES,
    order: 3,
    capacity: 1,
    eventKind: 'singles',
    rankingKind: 'singles',
    allowedGenders: [Gender.FEMALE],
    mixedComposition: false,
  },
  [LineupPosition.MENS_DOUBLES]: {
    position: LineupPosition.MENS_DOUBLES,
    order: 4,
    capacity: 2,
    eventKind: 'doubles',
    rankingKind: 'doubles',
    allowedGenders: [Gender.MALE],
    mixedComposition: false,
  },
  [LineupPosition.OPEN_DOUBLES]: {
    position: LineupPosition.OPEN_DOUBLES,
    order: 5,
    capacity: 2,
    eventKind: 'doubles',
    rankingKind: 'doubles',
    allowedGenders: ALL_GENDERS,
    mixedComposition: false,
  },
  [LineupPosition.WOMEN_DOUBLES]: {
    position: LineupPosition.WOMEN_DOUBLES,
    order: 6,
    capacity: 2,
    eventKind: 'doubles',
    rankingKind: 'doubles',
    allowedGenders: [Gender.FEMALE],
    mixedComposition: false,
  },
  [LineupPosition.MIXED_DOUBLES]: {
    position: LineupPosition.MIXED_DOUBLES,
    order: 7,
    capacity: 2,
    eventKind: 'doubles',
    rankingKind: 'doubles',
    allowedGenders: [Gender.MALE, Gender.FEMALE],
    mixedComposition: true,
  },
};

export interface MatchLineupEntry {
  position: LineupPosition;
  playerId: string;
  playerNameSnapshot: string;
}

export interface MatchLineupIntentEntry {
  position: LineupPosition;
  playerId: string;
}

export interface MatchLineupWarning {
  code: LineupViolationCode;
  position?: LineupPosition;
  playerId?: string;
  positions?: LineupPosition[];
  playerIds?: string[];
}

export interface MatchLineupCandidate {
  playerId: string;
  playerName: string;
  gender: Gender;
  singlesRanking: number;
  doublesRanking: number;
  participation: MatchAvailabilityParticipation;
}

export interface MatchLineupContext {
  matchId: string;
  version: number;
  lineup: MatchLineupEntry[];
  lineupWarnings: MatchLineupWarning[];
  candidates: MatchLineupCandidate[];
}

export function compareLineupEntries(
  left: Pick<MatchLineupEntry, 'position' | 'playerId'>,
  right: Pick<MatchLineupEntry, 'position' | 'playerId'>
): number {
  const positionDifference =
    LINEUP_POSITION_DEFINITIONS[left.position].order -
    LINEUP_POSITION_DEFINITIONS[right.position].order;
  return positionDifference || left.playerId.localeCompare(right.playerId);
}
