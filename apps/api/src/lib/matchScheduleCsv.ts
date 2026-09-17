import { parse } from 'csv-parse/sync';
import { AppError } from '../utils/errors';

export const MATCH_CSV_HEADER = [
  'Datum',
  'Zeit',
  'Sporthalle',
  'Hallenadresse',
  'Heimmannschaft',
  'Gastmannschaft',
] as const;

export const MATCH_CSV_MAX_DATA_ROWS = 1_000;

export interface MatchScheduleCsvRecord {
  rowNumber: number;
  columns: string[];
}

function fileError(message: string, code: string, statusCode = 400): AppError {
  return new AppError(message, statusCode, code);
}

export function decodeMatchScheduleCsv(buffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw fileError(
      'Match CSV must use valid UTF-8 encoding',
      'MATCH_CSV_INVALID_ENCODING'
    );
  }
}

export function parseMatchScheduleCsv(
  buffer: Buffer
): MatchScheduleCsvRecord[] {
  const content = decodeMatchScheduleCsv(buffer);
  if (content.length === 0) {
    throw fileError(
      'Match CSV contains no data rows',
      'MATCH_CSV_NO_DATA_ROWS'
    );
  }

  let records: string[][];
  try {
    records = parse(content, {
      bom: true,
      delimiter: ',',
      skip_empty_lines: true,
      relax_column_count: true,
      relax_quotes: false,
    }) as string[][];
  } catch {
    throw fileError(
      'Match CSV structure is invalid',
      'MATCH_CSV_INVALID_STRUCTURE'
    );
  }

  const [header, ...dataRows] = records;
  if (
    !header ||
    header.length !== MATCH_CSV_HEADER.length ||
    !MATCH_CSV_HEADER.every((column, index) => header[index] === column)
  ) {
    throw fileError(
      `Match CSV header must be exactly: ${MATCH_CSV_HEADER.join(',')}`,
      'MATCH_CSV_INVALID_HEADER'
    );
  }
  if (dataRows.length === 0) {
    throw fileError(
      'Match CSV contains no data rows',
      'MATCH_CSV_NO_DATA_ROWS'
    );
  }
  if (dataRows.length > MATCH_CSV_MAX_DATA_ROWS) {
    throw fileError(
      `Match CSV exceeds ${MATCH_CSV_MAX_DATA_ROWS} data rows`,
      'MATCH_CSV_TOO_MANY_ROWS',
      413
    );
  }

  return dataRows.map((columns, index) => ({
    rowNumber: index + 2,
    columns,
  }));
}
