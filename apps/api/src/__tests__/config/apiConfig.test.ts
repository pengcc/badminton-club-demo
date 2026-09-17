import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEVELOPMENT_API_STARTUP_SIGNALS } from '../../developmentStartupContract';

const environmentKeys = [
  'NODE_ENV',
  'MONGODB_URI',
  'FRONTEND_URL',
  'BANKING_ENCRYPTION_ACTIVE_KEY_VERSION',
  'BANKING_ENCRYPTION_KEYS',
  'DEVELOPMENT_PUBLIC_UPLOADS_ROOT',
  'SHOWCASE_DEMO_ENABLED',
  'SHOWCASE_DEMO_ADMIN_EMAIL',
] as const;

describe('API required configuration boundaries', () => {
  let originalEnvironment: Partial<
    Record<(typeof environmentKeys)[number], string>
  >;

  beforeEach(() => {
    originalEnvironment = Object.fromEntries(
      environmentKeys
        .filter((key) => process.env[key] !== undefined)
        .map((key) => [key, process.env[key]])
    );
  });

  afterEach(() => {
    for (const key of environmentKeys) {
      const originalValue = originalEnvironment[key];
      if (originalValue === undefined) delete process.env[key];
      else process.env[key] = originalValue;
    }
    vi.doUnmock('../../config/apiEnvironment');
    vi.resetModules();
  });

  it('imports without application Mongo configuration and resolves required values live', async () => {
    delete process.env.MONGODB_URI;

    const { config } = await import('../../config');

    expect(() => config.mongoUri).toThrow(
      'Missing required environment variable: MONGODB_URI'
    );
    expect(config.frontendUrl).toBe('http://localhost:3000');

    process.env.MONGODB_URI = 'mongodb://first.example.test/api';
    expect(config.mongoUri).toBe('mongodb://first.example.test/api');
    process.env.MONGODB_URI = 'mongodb://second.example.test/api';
    expect(config.mongoUri).toBe('mongodb://second.example.test/api');
  });

  it.each([
    'development',
    'production',
  ])('requires both API startup values in %s', async (nodeEnv) => {
    process.env.NODE_ENV = nodeEnv;
    delete process.env.MONGODB_URI;
    delete process.env.FRONTEND_URL;
    process.env.BANKING_ENCRYPTION_ACTIVE_KEY_VERSION = 'test-v1';
    process.env.BANKING_ENCRYPTION_KEYS = JSON.stringify({
      'test-v1': Buffer.alloc(32, 7).toString('base64'),
    });
    process.env.DEVELOPMENT_PUBLIC_UPLOADS_ROOT = '/tmp/club-api-uploads';
    vi.doMock('../../config/apiEnvironment', () => ({
      loadApiEnvironment: vi.fn(() => ({
        environmentPath: '/tmp/.env.local',
        alternateDevelopmentDatabase: false,
      })),
    }));

    const { resolveApiStartupConfig } = await import('../../config');

    expect(resolveApiStartupConfig).toThrow(
      'Missing required environment variable: MONGODB_URI'
    );
    process.env.MONGODB_URI = 'mongodb://runtime.example.test/api';
    expect(resolveApiStartupConfig).toThrow(
      'Missing required environment variable: FRONTEND_URL'
    );
    process.env.FRONTEND_URL = 'https://club.example.test';
    expect(resolveApiStartupConfig()).toEqual({
      mongoUri: 'mongodb://runtime.example.test/api',
      frontendUrl: 'https://club.example.test',
    });
  });

  it('keeps the real server entrypoint behind required startup configuration', () => {
    const { MONGODB_URI: _mongoUri, ...inheritedEnvironment } = process.env;
    const result = spawnSync(
      process.execPath,
      [
        '--import',
        'tsx',
        fileURLToPath(new URL('../../server.ts', import.meta.url)),
      ],
      {
        encoding: 'utf8',
        env: {
          ...inheritedEnvironment,
          NODE_ENV: 'test',
          FRONTEND_URL: 'http://localhost:3000',
        },
        timeout: 10_000,
      }
    );

    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain(
      'Missing required environment variable: MONGODB_URI'
    );
    expect(result.stdout).not.toContain(DEVELOPMENT_API_STARTUP_SIGNALS.ready);
    expect(result.stdout).not.toContain('Server running on port');
  });

  it('fails closed when demo mode has no dedicated administrator identity', async () => {
    process.env.SHOWCASE_DEMO_ENABLED = 'true';
    delete process.env.SHOWCASE_DEMO_ADMIN_EMAIL;

    await expect(import('../../config')).rejects.toThrow(
      'SHOWCASE_DEMO_ADMIN_EMAIL must identify the dedicated Demo Admin'
    );
  });

  it('fails closed when the Demo Admin identity is malformed', async () => {
    process.env.SHOWCASE_DEMO_ENABLED = 'true';
    process.env.SHOWCASE_DEMO_ADMIN_EMAIL = 'demo@';

    await expect(import('../../config')).rejects.toThrow(
      'SHOWCASE_DEMO_ADMIN_EMAIL must identify the dedicated Demo Admin'
    );
  });

  it('normalizes the configured Demo Admin identity', async () => {
    process.env.SHOWCASE_DEMO_ENABLED = 'true';
    process.env.SHOWCASE_DEMO_ADMIN_EMAIL = '  Demo.Admin@Club.Invalid  ';

    const { config } = await import('../../config');
    expect(config.demoRuntime).toEqual({
      enabled: true,
      adminEmail: 'demo.admin@club.invalid',
    });
  });
});
