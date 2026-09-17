import { describe, expect, it } from 'vitest';
import {
  buildActivitiesPageHref,
  getActivitiesPageTokens,
  normalizeActivitiesPage,
} from '@app/lib/activitiesPagination';

describe('Activities pagination contract', () => {
  it.each([
    [undefined, 1],
    ['', 1],
    ['invalid', 1],
    ['0', 1],
    ['-2', 1],
    ['2', 2],
    [['5', '7'], 5],
  ])('normalizes %j to page %d', (value, expected) => {
    expect(normalizeActivitiesPage(value)).toBe(expected);
  });

  it('omits the page-one query and preserves later page identity', () => {
    expect(buildActivitiesPageHref('en', 1)).toBe('/en/activities');
    expect(buildActivitiesPageHref('en', 3)).toBe('/en/activities?page=3');
  });

  it.each([
    [1, 1, [1]],
    [1, 2, [1, 2]],
    [3, 5, [1, 2, 3, 4, 5]],
    [1, 10, [1, 2, 'ellipsis', 10]],
    [5, 10, [1, 'ellipsis', 4, 5, 6, 'ellipsis', 10]],
    [10, 10, [1, 'ellipsis', 9, 10]],
    [500, 1000, [1, 'ellipsis', 499, 500, 501, 'ellipsis', 1000]],
  ])('returns bounded tokens for page %d of %d', (page, total, expected) => {
    const tokens = getActivitiesPageTokens(page, total);
    expect(tokens).toEqual(expected);
    expect(tokens.length).toBeLessThanOrEqual(7);
  });
});
