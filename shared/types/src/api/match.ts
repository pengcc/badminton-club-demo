import type {
  MatchAvailabilityParticipation,
  MatchDirection,
  MatchListView,
  MatchOutcome,
} from '../core/enums';
import type {
  MatchLineupContext,
  MatchLineupEntry,
  MatchLineupIntentEntry,
  MatchLineupWarning,
} from '../domain/lineup';

export const MATCH_TIME_ZONE = 'Europe/Berlin' as const;
export const MATCH_ARRIVAL_GUIDANCE_MAX_LENGTH = 500;
export const MATCH_RESULT_NOTE_MAX_LENGTH = 500;
export const MATCH_CSV_CREATED_CODE = 'MATCH_CREATED' as const;
export const MATCH_CSV_DUPLICATE_CODES = [
  'DUPLICATE_IN_FILE',
  'MATCH_ALREADY_EXISTS',
] as const;
export const MATCH_CSV_FAILED_CODES = [
  'INVALID_COLUMN_COUNT',
  'MISSING_REQUIRED_VALUE',
  'INVALID_DATE',
  'INVALID_TIME',
  'INVALID_LOCAL_START',
  'TEAM_NOT_PRESENT',
  'TEAM_MATCHES_BOTH_SIDES',
  'MATCH_VALIDATION_FAILED',
] as const;
export namespace Api {
  export type MatchVersion = number;
  export type MatchCsvFailureField =
    | 'columns'
    | 'Datum'
    | 'Zeit'
    | 'Sporthalle'
    | 'Hallenadresse'
    | 'Heimmannschaft'
    | 'Gastmannschaft'
    | 'teamId'
    | 'opponentName'
    | 'direction'
    | 'localDate'
    | 'localTime'
    | 'location';

  export interface MatchLocalStart {
    date: string;
    time: string;
    timeZone: typeof MATCH_TIME_ZONE;
  }

  export interface MatchResultResponse {
    homeScore: number;
    awayScore: number;
    note?: string;
    outcome: MatchOutcome;
  }

  export interface MatchAvailabilityEntry {
    playerId: string;
    participation: MatchAvailabilityParticipation;
  }

  export interface MatchResponse {
    id: string;
    version: MatchVersion;
    teamId: string;
    opponentName: string;
    direction: MatchDirection;
    startAt: string;
    localStart: MatchLocalStart;
    location: string;
    arrivalGuidance?: string;
    result?: MatchResultResponse;
    lineup: MatchLineupEntry[];
    availability: MatchAvailabilityEntry[];
    createdById: string;
    createdAt: string;
    updatedAt: string;
    isDemoScratch?: boolean;
  }

  export interface MatchDetailResponse extends MatchResponse {
    lineupWarnings: MatchLineupWarning[];
  }

  export type LineupContextResponse = MatchLineupContext;

  export interface CreateMatchRequest {
    teamId: string;
    opponentName: string;
    direction: MatchDirection;
    localDate: string;
    localTime: string;
    location: string;
    arrivalGuidance?: string;
  }

  export interface UpdateMatchRequest extends CreateMatchRequest {
    expectedVersion: MatchVersion;
  }

  export interface SetMatchResultRequest {
    expectedVersion: MatchVersion;
    homeScore: number;
    awayScore: number;
    note?: string;
  }

  export interface DeleteMatchRequest {
    expectedVersion: MatchVersion;
  }

  export interface SetOwnMatchAvailabilityRequest {
    expectedVersion: MatchVersion;
    participation: MatchAvailabilityParticipation;
  }

  export type SetPlayerMatchAvailabilityRequest =
    SetOwnMatchAvailabilityRequest;

  export interface SetMatchLineupRequest {
    expectedVersion: MatchVersion;
    lineup: MatchLineupIntentEntry[];
  }

  export interface MatchQueryParams {
    view?: MatchListView;
  }

  export interface MatchUrlParams {
    id: string;
  }

  export interface MatchCsvImportFields {
    teamId: string;
  }

  export interface MatchCsvCreatedOutcome {
    rowNumber: number;
    outcome: 'created';
    code: typeof MATCH_CSV_CREATED_CODE;
    matchId: string;
    localDate: string;
    localTime: string;
    opponentName: string;
    direction: MatchDirection;
    location: string;
  }

  export interface MatchCsvDuplicateOutcome {
    rowNumber: number;
    outcome: 'duplicate';
    code: (typeof MATCH_CSV_DUPLICATE_CODES)[number];
    matchId?: string;
    localDate: string;
    localTime: string;
    opponentName: string;
    direction: MatchDirection;
    location: string;
  }

  export interface MatchCsvFailedOutcome {
    rowNumber: number;
    outcome: 'failed';
    code: (typeof MATCH_CSV_FAILED_CODES)[number];
    field?: MatchCsvFailureField;
    message: string;
  }

  export type MatchCsvImportOutcome =
    | MatchCsvCreatedOutcome
    | MatchCsvDuplicateOutcome
    | MatchCsvFailedOutcome;

  export interface MatchCsvImportResponse {
    summary: {
      input: number;
      created: number;
      duplicate: number;
      failed: number;
    };
    outcomes: MatchCsvImportOutcome[];
  }
}
