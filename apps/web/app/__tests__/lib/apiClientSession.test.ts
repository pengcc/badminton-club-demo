import { AxiosError, type AxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ reload: vi.fn() }));

vi.mock('@app/lib/navigation/documentNavigation', () => ({
  reloadCurrentDocument: mocks.reload,
}));

import apiClient from '@app/lib/api/client';

const originalAdapter = apiClient.defaults.adapter;

function rejectedResponse(code: string, status: number) {
  return async (config: never) => {
    throw new AxiosError(
      'request failed',
      'ERR_BAD_RESPONSE',
      config,
      undefined,
      {
        data: { code },
        status,
        statusText: status === 401 ? 'Unauthorized' : 'Forbidden',
        headers: {},
        config,
      }
    );
  };
}

describe('API client session boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
  });

  it('does not attach bearer authorization to browser API requests', async () => {
    let observed: AxiosRequestConfig | undefined;
    apiClient.defaults.adapter = async (config) => {
      observed = config;
      return {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    await apiClient.get('/auth/verify');

    expect(observed?.headers).not.toHaveProperty('Authorization');
  });

  it('leaves verification invalidity to the protected session owner', async () => {
    apiClient.defaults.adapter = rejectedResponse('SESSION_INVALID', 401);

    await expect(apiClient.get('/auth/verify')).rejects.toBeInstanceOf(
      AxiosError
    );
    expect(mocks.reload).not.toHaveBeenCalled();
  });

  it('reloads the current document for non-verify session invalidity', async () => {
    apiClient.defaults.adapter = rejectedResponse('SESSION_INVALID', 401);

    await expect(apiClient.get('/members/me')).rejects.toBeInstanceOf(
      AxiosError
    );
    expect(mocks.reload).toHaveBeenCalledOnce();
  });

  it('does not reload for an unrelated authorization failure', async () => {
    apiClient.defaults.adapter = rejectedResponse('CAPABILITY_REQUIRED', 403);

    await expect(apiClient.get('/admin')).rejects.toBeInstanceOf(AxiosError);
    expect(mocks.reload).not.toHaveBeenCalled();
  });
});
