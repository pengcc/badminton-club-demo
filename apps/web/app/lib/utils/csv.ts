export interface CsvColumn<Row> {
  header: string;
  value: (row: Row) => unknown;
}

function safeCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  const neutralized = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${neutralized.replaceAll('"', '""')}"`;
}

export function serializeCsv<Row>(
  rows: readonly Row[],
  columns: readonly CsvColumn<Row>[]
): string {
  return [
    columns.map((column) => safeCell(column.header)).join(','),
    ...rows.map((row) =>
      columns.map((column) => safeCell(column.value(row))).join(',')
    ),
  ].join('\n');
}

export function downloadCsv<Row>(options: {
  filename: string;
  rows: readonly Row[];
  columns: readonly CsvColumn<Row>[];
}): boolean {
  if (options.rows.length === 0) return false;
  const blob = new Blob(
    [`\uFEFF${serializeCsv(options.rows, options.columns)}`],
    {
      type: 'text/csv;charset=utf-8',
    }
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = options.filename;
  link.hidden = true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}
