import express from 'express';
import mongoose from 'mongoose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { startApi } from '../../bootstrap';
import {
  COMBINED_DEVELOPMENT_SESSION_ENV,
  DEVELOPMENT_API_STARTUP_SIGNALS,
} from '../../developmentStartupContract';

type StartupDependencies = Parameters<typeof startApi>[0];

// Exercise the real entrypoint's callbacks without opening Mongo or HTTP listeners.
describe('server startup diagnostic ownership', () => {
  const originalExitCode = process.exitCode;

  afterEach(() => {
    process.exitCode = originalExitCode;
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.doUnmock('../../bootstrap');
    vi.doUnmock('../../config/apiEnvironment');
    mongoose.deleteModel(/.+/);
    vi.resetModules();
  });

  it.each([
    false,
    true,
  ])('preserves startup signals and human ownership in combined=%s', async (combined) => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv(COMBINED_DEVELOPMENT_SESSION_ENV, combined ? '1' : '');
    vi.stubEnv('MONGODB_URI', 'mongodb://synthetic.invalid/startup-test');
    vi.stubEnv('FRONTEND_URL', 'http://localhost:3000');
    vi.stubEnv(
      'DEVELOPMENT_PUBLIC_UPLOADS_ROOT',
      '/tmp/club-server-startup-uploads'
    );
    vi.stubEnv('BANKING_ENCRYPTION_ACTIVE_KEY_VERSION', 'test-v1');
    vi.stubEnv(
      'BANKING_ENCRYPTION_KEYS',
      JSON.stringify({
        'test-v1': Buffer.alloc(32, 7).toString('base64'),
      })
    );
    vi.doMock('../../config/apiEnvironment', () => ({
      loadApiEnvironment: vi.fn(),
    }));
    let startup: StartupDependencies | undefined;
    vi.doMock('../../bootstrap', () => ({
      startApi: vi.fn(async (dependencies: StartupDependencies) => {
        startup = dependencies;
        return false;
      }),
    }));
    const human = vi.spyOn(console, 'error').mockImplementation(() => {});
    const normal = vi.spyOn(console, 'log').mockImplementation(() => {});
    const signal = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    let listenerError: Error | undefined;
    vi.spyOn(express.application, 'listen').mockImplementation(
      (...args: unknown[]) => {
        (args.at(-1) as (error?: Error) => void)(listenerError);
        return {} as ReturnType<typeof express.application.listen>;
      }
    );
    await import('../../server');
    if (!startup) throw new Error('server did not establish startup callbacks');

    startup.reportInitialMongoFailure();
    expect(human).toHaveBeenCalledTimes(combined ? 0 : 1);
    if (!combined)
      expect(human.mock.calls[0]?.[0]).toContain('initial MongoDB connection');
    expect(signal.mock.calls.map(([line]) => line)).toEqual(
      combined
        ? [`${DEVELOPMENT_API_STARTUP_SIGNALS.initialMongoFailure}\n`]
        : []
    );

    for (const code of ['EADDRINUSE', 'EACCES']) {
      human.mockClear();
      signal.mockClear();
      listenerError = Object.assign(new Error('private listener detail'), {
        code,
      });
      const onListening = vi.fn();
      startup.startListener(onListening);
      expect(onListening).not.toHaveBeenCalled();
      expect(process.exitCode).toBe(1);
      expect(human).toHaveBeenCalledTimes(combined ? 0 : 1);
      if (!combined)
        expect(human.mock.calls[0]?.[0]).toContain(
          code === 'EADDRINUSE'
            ? 'already in use'
            : 'listener could not be started'
        );
      expect(signal.mock.calls.map(([line]) => line)).toEqual(
        combined ? [`${DEVELOPMENT_API_STARTUP_SIGNALS.listenerFailure}\n`] : []
      );
      expect(JSON.stringify(human.mock.calls)).not.toContain(
        'private listener detail'
      );
    }

    signal.mockClear();
    listenerError = undefined;
    const onListening = vi.fn();
    startup.startListener(onListening);
    expect(onListening).toHaveBeenCalledOnce();
    expect(normal).toHaveBeenCalledWith(
      expect.stringContaining('Server running on port')
    );
    expect(signal.mock.calls.map(([line]) => line)).toEqual(
      combined ? [`${DEVELOPMENT_API_STARTUP_SIGNALS.ready}\n`] : []
    );
  });
});
