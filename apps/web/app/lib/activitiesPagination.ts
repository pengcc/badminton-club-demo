export type ActivitiesPageToken = number | 'ellipsis';

export function normalizeActivitiesPage(value?: string | string[]): number {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(candidate || '1', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function buildActivitiesPageHref(lang: string, page: number): string {
  const base = `/${lang}/activities`;
  return page <= 1 ? base : `${base}?page=${page}`;
}

export function getActivitiesPageTokens(
  currentPage: number,
  totalPages: number
): ActivitiesPageToken[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set([1, totalPages]);
  for (
    let page = Math.max(2, currentPage - 1);
    page <= Math.min(totalPages - 1, currentPage + 1);
    page += 1
  ) {
    pages.add(page);
  }

  const orderedPages = [...pages].sort((a, b) => a - b);
  const tokens: ActivitiesPageToken[] = [];

  for (const page of orderedPages) {
    const previous = tokens.at(-1);
    if (typeof previous === 'number' && page - previous > 1) {
      tokens.push('ellipsis');
    }
    tokens.push(page);
  }

  return tokens;
}
