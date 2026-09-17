import { describe, expect, it } from 'vitest';
import {
  MEMBER_CSV_HEADERS,
  encodeMemberCsvValue,
  decodeMemberCsvValue,
} from '@club/shared-types/api/memberCsv';
import {
  parseMemberCsv,
  MEMBER_CSV_MAX_BYTES,
} from '../../lib/memberCsvImport';
const values = [
  'Ada',
  'Example',
  ' ADA@example.test ',
  'female',
  '1990-01-01',
  '',
  '',
  '',
  '',
  'active',
  '',
  'true',
];
const file = (
  rows = [values],
  headers: readonly string[] = MEMBER_CSV_HEADERS
) =>
  Buffer.from(
    [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
  );
describe('Member CSV contract', () => {
  it.each([
    '+49123456789',
    '=formula',
    "'Name",
    "'+Name",
    'Ordinary',
  ])('reverses portable spreadsheet escaping for %s', (value) => {
    expect(decodeMemberCsvValue(encodeMemberCsvValue(value))).toBe(value);
  });
  it('accepts system-escaped phone and genuine apostrophe while leaving manual phone input supported', () => {
    const portable = [...values];
    portable[0] = "'Ada";
    portable[5] = '+49123456789';
    expect(
      parseMemberCsv(file([portable.map(encodeMemberCsvValue)]))[0].input
        ?.identity
    ).toMatchObject({
      firstName: "'Ada",
      phone: '+49123456789',
    });
    expect(parseMemberCsv(file([portable]))[0].input?.identity.phone).toBe(
      '+49123456789'
    );
  });
  it('accepts reordered headers and BOM using canonical shared validation', () => {
    const row = parseMemberCsv(
      Buffer.concat([
        Buffer.from('\ufeff'),
        file([[...values].reverse()], [...MEMBER_CSV_HEADERS].reverse()),
      ])
    )[0];
    expect(row.input).toMatchObject({
      identity: { email: 'ada@example.test', dateOfBirth: '1990-01-01' },
      establishPlayer: true,
    });
  });
  it.each(
    [
      MEMBER_CSV_HEADERS.slice(1),
      [...MEMBER_CSV_HEADERS, 'Internal ID'],
      [...MEMBER_CSV_HEADERS.slice(0, -1), 'Email'],
    ].map((headers) => [headers])
  )('rejects unsupported header set', (headers) => {
    expect(() => parseMemberCsv(file([values], headers))).toThrow('headers');
  });
  it.each([
    '1990',
    '01.01.1990',
    '1990-02-30',
  ])('rejects noncanonical DOB %s', (date) => {
    const row = [...values];
    row[4] = date;
    expect(parseMemberCsv(file([row]))[0].result.outcome).toBe('invalid');
  });
  it('holds duplicate email and same identity under different emails', () => {
    expect(
      parseMemberCsv(file([values, values])).every(
        (row) => row.result.reason === 'duplicate_email'
      )
    ).toBe(true);
    const other = [...values];
    other[2] = 'other@example.test';
    expect(
      parseMemberCsv(file([values, other])).every(
        (row) => row.result.reason === 'identity_candidate'
      )
    ).toBe(true);
  });
  it('rejects partial address and malformed row while retaining independent valid rows', () => {
    const partial = [...values];
    partial[2] = 'partial@example.test';
    partial[6] = 'Street 1';
    const rows = parseMemberCsv(file([values, partial, ['only']]));
    expect(rows.map((row) => row.result.outcome)).toEqual([
      'unchanged',
      'invalid',
      'invalid',
    ]);
  });
  it('fails closed for encoding, size, count and malformed CSV without echoing contents', () => {
    for (const buffer of [
      Buffer.from([0xff]),
      Buffer.alloc(MEMBER_CSV_MAX_BYTES + 1),
      file(Array.from({ length: 1001 }, () => values)),
      Buffer.from('"sensitive'),
    ]) {
      expect(() => parseMemberCsv(buffer)).toThrow(/Member CSV/);
    }
  });
  it.each(['', 'false'])('nonaffirmative Player %s stays false', (value) => {
    const row = [...values];
    row[11] = value;
    expect(parseMemberCsv(file([row]))[0].input?.establishPlayer).toBe(false);
  });
});
