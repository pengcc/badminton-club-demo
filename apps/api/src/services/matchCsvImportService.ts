import type { Api } from '@club/shared-types/api/match';
import { MatchDirection } from '@club/shared-types/core/enums';
import { createMatchSchema } from '@club/shared-types/schemas/match';
import {
  MATCH_CSV_HEADER,
  parseMatchScheduleCsv,
  type MatchScheduleCsvRecord,
} from '../lib/matchScheduleCsv';
import { AppError } from '../utils/errors';
import { MatchService, type MatchCommandActor } from './matchService';
import {
  buildMatchScheduleDuplicateKey,
  normalizeMatchScheduleComparison,
  normalizeMatchScheduleText,
} from './matchScheduleDuplicateKey';
import { berlinLocalStartToDate } from './matchTimePolicy';
import { TeamService } from './teamService';

type FailedCode = Api.MatchCsvFailedOutcome['code'];
type FailedField = NonNullable<Api.MatchCsvFailedOutcome['field']>;
const MATCH_CSV_FAILURE_FIELDS = [
  'columns',
  'Datum',
  'Zeit',
  'Sporthalle',
  'Hallenadresse',
  'Heimmannschaft',
  'Gastmannschaft',
  'teamId',
  'opponentName',
  'direction',
  'localDate',
  'localTime',
  'location',
] as const satisfies readonly FailedField[];
type KnownFailureField = (typeof MATCH_CSV_FAILURE_FIELDS)[number];

interface MappedRow {
  rowNumber: number;
  request: Api.CreateMatchRequest;
  startAt: Date;
}

function failed(
  rowNumber: number,
  code: FailedCode,
  message: string,
  field?: FailedField
): Api.MatchCsvFailedOutcome {
  return {
    rowNumber,
    outcome: 'failed',
    code,
    ...(field ? { field } : {}),
    message,
  };
}

function failureField(value: PropertyKey | undefined): FailedField | undefined {
  if (typeof value !== 'string') return undefined;
  return MATCH_CSV_FAILURE_FIELDS.includes(value as KnownFailureField)
    ? (value as KnownFailureField)
    : undefined;
}

function parseGermanDate(value: string): string | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    date.getUTCFullYear() !== Number(year) ||
    date.getUTCMonth() !== Number(month) - 1 ||
    date.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  return `${year}-${month}-${day}`;
}

function parseTime(value: string): string | null {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : null;
}

function mapRow(
  row: MatchScheduleCsvRecord,
  teamId: string,
  leagueTeamName: string
): MappedRow | Api.MatchCsvFailedOutcome {
  if (row.columns.length !== MATCH_CSV_HEADER.length) {
    return failed(
      row.rowNumber,
      'INVALID_COLUMN_COUNT',
      `Expected ${MATCH_CSV_HEADER.length} columns, received ${row.columns.length}`,
      'columns'
    );
  }

  const [rawDate, rawTime, rawHall, rawAddress, rawHome, rawAway] = row.columns;
  const values = {
    Datum: normalizeMatchScheduleText(rawDate),
    Zeit: normalizeMatchScheduleText(rawTime),
    Sporthalle: normalizeMatchScheduleText(rawHall),
    Hallenadresse: normalizeMatchScheduleText(rawAddress),
    Heimmannschaft: normalizeMatchScheduleText(rawHome),
    Gastmannschaft: normalizeMatchScheduleText(rawAway),
  };
  const missing = Object.entries(values).find(([, value]) => !value);
  if (missing) {
    return failed(
      row.rowNumber,
      'MISSING_REQUIRED_VALUE',
      `${missing[0]} is required`,
      failureField(missing[0])
    );
  }

  const localDate = parseGermanDate(values.Datum);
  if (!localDate) {
    return failed(
      row.rowNumber,
      'INVALID_DATE',
      'Datum must be a real date in DD.MM.YYYY format',
      'Datum'
    );
  }
  const localTime = parseTime(values.Zeit);
  if (!localTime) {
    return failed(
      row.rowNumber,
      'INVALID_TIME',
      'Zeit must use zero-padded HH:mm format',
      'Zeit'
    );
  }

  const selectedTeam = normalizeMatchScheduleComparison(leagueTeamName);
  const homeMatches =
    normalizeMatchScheduleComparison(values.Heimmannschaft) === selectedTeam;
  const awayMatches =
    normalizeMatchScheduleComparison(values.Gastmannschaft) === selectedTeam;
  if (!homeMatches && !awayMatches) {
    return failed(
      row.rowNumber,
      'TEAM_NOT_PRESENT',
      'Selected Team matches neither side'
    );
  }
  if (homeMatches && awayMatches) {
    return failed(
      row.rowNumber,
      'TEAM_MATCHES_BOTH_SIDES',
      'Selected Team matches both sides'
    );
  }

  const request = {
    teamId,
    opponentName: homeMatches ? values.Gastmannschaft : values.Heimmannschaft,
    direction: homeMatches ? MatchDirection.HOME : MatchDirection.AWAY,
    localDate,
    localTime,
    location: `${values.Sporthalle}\n${values.Hallenadresse}`,
  };
  const validation = createMatchSchema.safeParse(request);
  if (!validation.success) {
    const issue = validation.error.issues[0];
    return failed(
      row.rowNumber,
      'MATCH_VALIDATION_FAILED',
      issue?.message ?? 'Mapped Match is invalid',
      failureField(issue?.path[0])
    );
  }

  try {
    return {
      rowNumber: row.rowNumber,
      request: validation.data,
      startAt: berlinLocalStartToDate(localDate, localTime),
    };
  } catch (error) {
    if (error instanceof AppError && error.code === 'VALIDATION_ERROR') {
      return failed(
        row.rowNumber,
        'INVALID_LOCAL_START',
        'Match start is invalid or ambiguous in Europe/Berlin',
        'Zeit'
      );
    }
    throw error;
  }
}

function rowFacts(row: MappedRow) {
  return {
    localDate: row.request.localDate,
    localTime: row.request.localTime,
    opponentName: row.request.opponentName,
    direction: row.request.direction,
    location: row.request.location,
  };
}

export class MatchCsvImportService {
  static async import(
    buffer: Buffer,
    teamId: string,
    actor: MatchCommandActor
  ): Promise<Api.MatchCsvImportResponse> {
    const rows = parseMatchScheduleCsv(buffer);
    const team = await TeamService.getTeamById(teamId);
    if (!team) {
      throw new AppError('Team not found', 404, 'TEAM_NOT_FOUND');
    }

    const outcomes: Api.MatchCsvImportOutcome[] = [];
    const resolvedKeys = new Set<string>();

    for (const row of rows) {
      const mapped = mapRow(row, teamId, team.leagueTeamName);
      if ('outcome' in mapped) {
        outcomes.push(mapped);
        continue;
      }

      const scheduleDuplicateKey = buildMatchScheduleDuplicateKey({
        teamId,
        opponentName: mapped.request.opponentName,
        direction: mapped.request.direction,
        startAt: mapped.startAt,
        location: mapped.request.location,
      });
      if (resolvedKeys.has(scheduleDuplicateKey)) {
        outcomes.push({
          rowNumber: mapped.rowNumber,
          outcome: 'duplicate',
          code: 'DUPLICATE_IN_FILE',
          ...rowFacts(mapped),
        });
        continue;
      }

      const persisted =
        await MatchService.getMatchByScheduleDuplicateKey(scheduleDuplicateKey);
      if (persisted) {
        resolvedKeys.add(scheduleDuplicateKey);
        outcomes.push({
          rowNumber: mapped.rowNumber,
          outcome: 'duplicate',
          code: 'MATCH_ALREADY_EXISTS',
          matchId: persisted.id,
          ...rowFacts(mapped),
        });
        continue;
      }

      try {
        const created = await MatchService.createMatch(mapped.request, actor);
        resolvedKeys.add(scheduleDuplicateKey);
        outcomes.push({
          rowNumber: mapped.rowNumber,
          outcome: 'created',
          code: 'MATCH_CREATED',
          matchId: created.id,
          ...rowFacts(mapped),
        });
      } catch (error) {
        if (
          error instanceof AppError &&
          error.code === 'MATCH_SCHEDULE_DUPLICATE'
        ) {
          const duplicate =
            await MatchService.getMatchByScheduleDuplicateKey(
              scheduleDuplicateKey
            );
          resolvedKeys.add(scheduleDuplicateKey);
          outcomes.push({
            rowNumber: mapped.rowNumber,
            outcome: 'duplicate',
            code: 'MATCH_ALREADY_EXISTS',
            ...(duplicate ? { matchId: duplicate.id } : {}),
            ...rowFacts(mapped),
          });
          continue;
        }
        throw error;
      }
    }

    const summary = {
      input: outcomes.length,
      created: outcomes.filter((item) => item.outcome === 'created').length,
      duplicate: outcomes.filter((item) => item.outcome === 'duplicate').length,
      failed: outcomes.filter((item) => item.outcome === 'failed').length,
    };
    return { summary, outcomes };
  }
}
