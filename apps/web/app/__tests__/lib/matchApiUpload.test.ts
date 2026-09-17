import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('../../lib/api/client', () => ({
  default: { post: mocks.post },
}));

import { importFromCSV } from '../../lib/api/matchApi';

describe('Match CSV multipart adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.post.mockResolvedValue({
      data: {
        summary: { input: 0, created: 0, duplicate: 0, failed: 0 },
        outcomes: [],
      },
    });
  });

  it('sends the original File and Team as FormData without a JSON content type', async () => {
    const file = new File(['csv'], 'schedule.csv', { type: 'text/csv' });
    await importFromCSV(file, 'team-1');

    const [, body, config] = mocks.post.mock.calls[0];
    expect(body).toBeInstanceOf(FormData);
    expect(body.get('teamId')).toBe('team-1');
    expect(body.get('file')).toBe(file);
    expect(config).toEqual({ headers: { 'Content-Type': undefined } });
  });
});
