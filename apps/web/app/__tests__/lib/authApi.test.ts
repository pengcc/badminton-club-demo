import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ post: vi.fn() }));

vi.mock('@app/lib/api/client', () => ({ default: { post: mocks.post } }));

import {
  login,
  LoginFailure,
  type LoginFailureKind,
} from '@app/lib/api/authApi';

function responseError(status: number, message: string) {
  return new AxiosError(
    'request failed',
    'ERR_BAD_RESPONSE',
    undefined,
    undefined,
    {
      data: { message },
      status,
      statusText: 'Request failed',
      headers: {},
      config: {} as never,
    }
  );
}

async function expectLoginFailure(rejection: unknown, kind: LoginFailureKind) {
  mocks.post.mockRejectedValueOnce(rejection);

  const result = login({
    email: 'member@example.test',
    password: `test-${Date.now()}`,
  }).catch((error: unknown) => error);

  const failure = await result;
  expect(failure).toBeInstanceOf(LoginFailure);
  expect(failure).toMatchObject({ kind, message: 'Login failed' });
  expect(failure).not.toHaveProperty('cause');
  expect(failure).not.toHaveProperty('request');
  expect(failure).not.toHaveProperty('response');
}

describe('login API failure normalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    [401, 'invalid_credentials'],
    [403, 'sign_in_denied'],
    [500, 'unavailable'],
  ] as const)('maps HTTP %s to %s without using backend message text', async (status, kind) => {
    await expectLoginFailure(
      responseError(status, 'first backend message'),
      kind
    );
    await expectLoginFailure(
      responseError(status, 'different backend message'),
      kind
    );
  });

  it('maps a transport failure without a response to unavailable', async () => {
    await expectLoginFailure(new AxiosError('network failed'), 'unavailable');
  });

  it.each([
    new Error('unexpected failure'),
    { unexpected: true },
    null,
  ])('maps an unrecognized failure to unavailable', async (failure) => {
    await expectLoginFailure(failure, 'unavailable');
  });
});
