import { describe, expect, it } from 'vitest';
import { serializeCsv } from '../../lib/utils/csv';

describe('serializeCsv', () => {
  it('quotes fields, escapes quotes, and neutralizes spreadsheet formulas', () => {
    const csv = serializeCsv(
      [
        { name: 'Smith, "Alex"', note: '=HYPERLINK("bad")' },
        { name: 'Normal', note: '+SUM(1,2)' },
      ],
      [
        { header: 'Name', value: (row) => row.name },
        { header: 'Note', value: (row) => row.note },
      ]
    );

    expect(csv).toBe(
      '"Name","Note"\n"Smith, ""Alex""","\'=HYPERLINK(""bad"")"\n"Normal","\'+SUM(1,2)"'
    );
  });
});
