import { describe, expect, it } from 'vitest';
import {
  memberExportQuerySchema,
  memberListQuerySchema,
} from '../../schemas/user';
import { Gender, MemberListFilter } from '../enums';

describe('memberListQuerySchema', () => {
  it('applies the current-member projection and pagination defaults', () => {
    expect(memberListQuerySchema.parse({})).toEqual({
      filter: MemberListFilter.CURRENT,
      page: 1,
      pageSize: 20,
    });
  });

  it('accepts the bounded demographic gender filter', () => {
    expect(
      memberListQuerySchema.parse({ gender: Gender.NON_BINARY }).gender
    ).toBe(Gender.NON_BINARY);
    expect(memberListQuerySchema.parse({ gender: 'missing' }).gender).toBe(
      'missing'
    );
    expect(() => memberListQuerySchema.parse({ gender: 'unknown' })).toThrow();
  });

  it.each(
    Object.values(MemberListFilter)
  )('accepts the %s filter', (filter) => {
    expect(memberListQuerySchema.parse({ filter }).filter).toBe(filter);
  });

  it('coerces valid pagination query strings', () => {
    expect(memberListQuerySchema.parse({ page: '3', pageSize: '50' })).toEqual({
      filter: MemberListFilter.CURRENT,
      page: 3,
      pageSize: 50,
    });
  });

  it.each([
    { page: '0' },
    { pageSize: '0' },
    { pageSize: '101' },
    { filter: 'pending' },
  ])('rejects invalid query input %#', (query) => {
    expect(() => memberListQuerySchema.parse(query)).toThrow();
  });
});

describe('memberExportQuerySchema', () => {
  it.each(['current', 'all'] as const)('accepts the %s cohort', (cohort) => {
    expect(memberExportQuerySchema.parse({ cohort })).toEqual({ cohort });
  });

  it.each([
    'active',
    'passive',
    'inactive',
  ])('rejects the Member-list-only %s filter value', (cohort) => {
    expect(() => memberExportQuerySchema.parse({ cohort })).toThrow();
  });

  it.each([
    'filter',
    'search',
    'gender',
    'administratorOnly',
    'page',
    'pageSize',
  ])('rejects the Member-list-only %s parameter', (parameter) => {
    expect(() =>
      memberExportQuerySchema.parse({ cohort: 'current', [parameter]: 'x' })
    ).toThrow();
  });

  it('requires callers to choose a cohort', () => {
    expect(() => memberExportQuerySchema.parse({})).toThrow();
  });
});
