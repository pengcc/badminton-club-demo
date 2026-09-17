import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getDemoRuntimeStatus } from '@app/lib/data/getDemoRuntimeStatus';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('API_URL', 'http://demo-api.test:3003/api/');
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('request-time demo-runtime status', () => {
  it.each([
    true,
    false,
  ])('reads the exact enabled=%s projection using the server API-base owner', async (enabled) => {
    fetchMock.mockResolvedValue(
      Response.json({ success: true, data: { enabled } })
    );
    expect(await getDemoRuntimeStatus()).toBe(enabled ? 'enabled' : 'disabled');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://demo-api.test:3003/api/demo-runtime',
      {
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      }
    );
  });

  it.each([
    null,
    {},
    { success: false, data: { enabled: false } },
    { success: true, data: { enabled: 'false' } },
    { success: true, data: {} },
    { success: true, data: { enabled: false, extra: true } },
    { success: true, data: { enabled: false }, extra: true },
  ])('treats an invalid projection as unavailable: %j', async (payload) => {
    fetchMock.mockResolvedValue(Response.json(payload));
    expect(await getDemoRuntimeStatus()).toBe('unavailable');
  });

  it('handles non-2xx responses, malformed JSON, and network failure without assuming disabled', async () => {
    fetchMock.mockResolvedValueOnce(
      Response.json(
        { success: true, data: { enabled: false } },
        { status: 503 }
      )
    );
    fetchMock.mockResolvedValueOnce(new Response('not JSON'));
    fetchMock.mockRejectedValueOnce(new Error('Network unavailable'));
    for (let index = 0; index < 3; index++) {
      expect(await getDemoRuntimeStatus()).toBe('unavailable');
    }
  });

  it('aborts a stalled request after five seconds and clears its timer', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    fetchMock.mockImplementation((_url, options: RequestInit) => {
      signal = options.signal as AbortSignal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () =>
          reject(new DOMException('Aborted', 'AbortError'))
        );
      });
    });
    const result = getDemoRuntimeStatus();
    await vi.advanceTimersByTimeAsync(4_999);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toBe('unavailable');
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
