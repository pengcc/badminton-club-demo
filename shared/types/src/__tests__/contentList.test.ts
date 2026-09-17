import { describe, expect, it } from 'vitest';
import {
  administrationContentListQuerySchema,
  publicActiveContentListQuerySchema,
  publicActivityListQuerySchema,
} from '../api/contentList';

describe('content list query contracts', () => {
  it('normalizes public activity pagination while allowing only the public projection', () => {
    expect(
      publicActivityListQuerySchema.parse({
        language: 'de',
        visibleOnly: 'true',
        page: '2',
        limit: '12',
      })
    ).toEqual({
      language: 'de',
      visibleOnly: 'true',
      page: 2,
      limit: 12,
    });
    expect(() =>
      publicActivityListQuerySchema.parse({ visibleOnly: 'false' })
    ).toThrow();
  });

  it('allows only the active public projection for announcements and locations', () => {
    expect(publicActiveContentListQuerySchema.parse({})).toEqual({
      language: 'en',
      activeOnly: 'true',
    });
    expect(() =>
      publicActiveContentListQuerySchema.parse({ activeOnly: 'false' })
    ).toThrow();
  });

  it('keeps administration queries free of public projection flags', () => {
    expect(
      administrationContentListQuerySchema.parse({ language: 'zh' })
    ).toEqual({ language: 'zh' });
    expect(() =>
      administrationContentListQuerySchema.parse({ activeOnly: 'false' })
    ).toThrow();
  });
});
