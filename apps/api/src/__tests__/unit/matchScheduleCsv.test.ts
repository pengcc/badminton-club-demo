import { describe, expect, it } from 'vitest';
import {
  MATCH_CSV_HEADER,
  parseMatchScheduleCsv,
} from '../../lib/matchScheduleCsv';

function buffer(value: string): Buffer {
  return Buffer.from(value, 'utf8');
}

describe('canonical Match schedule CSV parser', () => {
  it.each([
    '\n',
    '\r\n',
  ])('accepts the exact header, quoted commas, and %j records', (lineEnding) => {
    const records = parseMatchScheduleCsv(
      buffer(
        [
          MATCH_CSV_HEADER.join(','),
          '15.08.2026,19:30,Halle A,"Straße 1, Berlin",Club II,Gäste',
        ].join(lineEnding)
      )
    );
    expect(records).toEqual([
      {
        rowNumber: 2,
        columns: [
          '15.08.2026',
          '19:30',
          'Halle A',
          'Straße 1, Berlin',
          'Club II',
          'Gäste',
        ],
      },
    ]);
  });

  it('accepts one UTF-8 BOM and preserves row-level column counts', () => {
    const records = parseMatchScheduleCsv(
      buffer(
        `\uFEFF${MATCH_CSV_HEADER.join(',')}\n15.08.2026,19:30,Halle,Adresse,Club II`
      )
    );
    expect(records[0]).toMatchObject({ rowNumber: 2 });
    expect(records[0].columns).toHaveLength(5);
  });

  it.each([
    [
      'wrong header',
      'datum,Zeit,Sporthalle,Hallenadresse,Heimmannschaft,Gastmannschaft\nx',
    ],
    [
      'wrong order',
      'Zeit,Datum,Sporthalle,Hallenadresse,Heimmannschaft,Gastmannschaft\nx',
    ],
  ])('rejects %s', (_label, csv) => {
    expect(() => parseMatchScheduleCsv(buffer(csv))).toThrowError(
      expect.objectContaining({ code: 'MATCH_CSV_INVALID_HEADER' })
    );
  });

  it('rejects malformed quoting as a file-level structure error', () => {
    expect(() =>
      parseMatchScheduleCsv(
        buffer(`${MATCH_CSV_HEADER.join(',')}\n"15.08.2026,19:30`)
      )
    ).toThrowError(
      expect.objectContaining({ code: 'MATCH_CSV_INVALID_STRUCTURE' })
    );
  });

  it('rejects invalid UTF-8 and header-only files', () => {
    expect(() => parseMatchScheduleCsv(Buffer.from([0xc3, 0x28]))).toThrowError(
      expect.objectContaining({ code: 'MATCH_CSV_INVALID_ENCODING' })
    );
    expect(() =>
      parseMatchScheduleCsv(buffer(MATCH_CSV_HEADER.join(',')))
    ).toThrowError(expect.objectContaining({ code: 'MATCH_CSV_NO_DATA_ROWS' }));
  });
});
