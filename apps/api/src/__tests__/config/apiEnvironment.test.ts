import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadApiEnvironment,
  resolveApiEnvironmentPath,
} from '../../config/apiEnvironment';

describe('API environment loading', () => {
  const apiDirectory = path.join('workspace', 'apps', 'api');
  const normalMongoUri = 'mongodb://normal.example.test/database';
  const alternateMongoUri = 'mongodb://alternate.example.test/database';
  let originalMongoUri: string | undefined;
  let originalPublicUploadsRoot: string | undefined;
  let originalNodeEnv: string | undefined;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalMongoUri = process.env.MONGODB_URI;
    originalPublicUploadsRoot = process.env.DEVELOPMENT_PUBLIC_UPLOADS_ROOT;
    originalNodeEnv = process.env.NODE_ENV;
    delete process.env.MONGODB_URI;
    delete process.env.DEVELOPMENT_PUBLIC_UPLOADS_ROOT;
    error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    if (originalMongoUri === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = originalMongoUri;
    }
    if (originalPublicUploadsRoot === undefined) {
      delete process.env.DEVELOPMENT_PUBLIC_UPLOADS_ROOT;
    } else {
      process.env.DEVELOPMENT_PUBLIC_UPLOADS_ROOT = originalPublicUploadsRoot;
    }
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
    vi.restoreAllMocks();
  });

  it('uses the API-local environment source without an alternate notice', () => {
    const load = vi.fn(() => ({
      parsed: { MONGODB_URI: normalMongoUri },
    }));

    expect(
      loadApiEnvironment({ apiDirectory, nodeEnv: 'development', load })
    ).toEqual({
      environmentPath: path.join(apiDirectory, '.env.local'),
      alternateDevelopmentDatabase: false,
    });
    expect(load).toHaveBeenCalledWith({
      path: path.join(apiDirectory, '.env.local'),
      quiet: true,
    });
    expect(error).not.toHaveBeenCalled();
    expect(resolveApiEnvironmentPath(apiDirectory, 'production')).toBe(
      path.join(apiDirectory, '.env.production')
    );
  });

  it('stays silent when the inherited value matches the local file', () => {
    process.env.MONGODB_URI = normalMongoUri;

    loadApiEnvironment({
      apiDirectory,
      nodeEnv: 'development',
      load: () => ({ parsed: { MONGODB_URI: normalMongoUri } }),
    });

    expect(error).not.toHaveBeenCalled();
  });

  it('keeps a differing development override and reports alternate mode once', () => {
    process.env.MONGODB_URI = alternateMongoUri;

    const state = loadApiEnvironment({
      apiDirectory,
      nodeEnv: 'development',
      load: () => ({ parsed: { MONGODB_URI: normalMongoUri } }),
    });

    expect(process.env.MONGODB_URI).toBe(alternateMongoUri);
    expect(state.alternateDevelopmentDatabase).toBe(true);
    expect(error).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith(
      'Development database mode: alternate MONGODB_URI override is active for this process; apps/api/.env.local is unchanged.'
    );
    expect(error.mock.calls.flat().join(' ')).not.toContain(normalMongoUri);
    expect(error.mock.calls.flat().join(' ')).not.toContain(alternateMongoUri);
  });

  it('reports alternate mode for local commands with NODE_ENV unset', () => {
    process.env.MONGODB_URI = alternateMongoUri;
    delete process.env.NODE_ENV;

    loadApiEnvironment({
      apiDirectory,
      load: () => ({ parsed: { MONGODB_URI: normalMongoUri } }),
    });

    expect(error).toHaveBeenCalledOnce();
  });

  it('does not load the normal application environment in test mode', () => {
    process.env.MONGODB_URI = alternateMongoUri;
    const load = vi.fn(() => ({ parsed: { MONGODB_URI: normalMongoUri } }));

    expect(loadApiEnvironment({ apiDirectory, nodeEnv: 'test', load })).toEqual(
      {
        environmentPath: path.join(apiDirectory, '.env.local'),
        alternateDevelopmentDatabase: false,
      }
    );

    expect(load).not.toHaveBeenCalled();
    expect(process.env.MONGODB_URI).toBe(alternateMongoUri);
    expect(error).not.toHaveBeenCalled();
  });

  it('production loading does not report development alternate mode', () => {
    process.env.MONGODB_URI = alternateMongoUri;

    loadApiEnvironment({
      apiDirectory,
      nodeEnv: 'production',
      load: () => ({ parsed: { MONGODB_URI: normalMongoUri } }),
    });

    expect(process.env.MONGODB_URI).toBe(alternateMongoUri);
    expect(error).not.toHaveBeenCalled();
  });

  it('refuses a process-level public uploads root that conflicts with the local file', () => {
    process.env.DEVELOPMENT_PUBLIC_UPLOADS_ROOT = '/tmp/inherited-uploads';

    expect(() =>
      loadApiEnvironment({
        apiDirectory,
        nodeEnv: 'development',
        load: () => ({
          parsed: {
            MONGODB_URI: normalMongoUri,
            DEVELOPMENT_PUBLIC_UPLOADS_ROOT: '/tmp/local-uploads',
          },
        }),
      })
    ).toThrow('Development public uploads root conflicts');
  });

  it('refuses a process-level public uploads root when the local file has no bootstrap-owned value', () => {
    process.env.DEVELOPMENT_PUBLIC_UPLOADS_ROOT = '/tmp/inherited-uploads';

    expect(() =>
      loadApiEnvironment({
        apiDirectory,
        nodeEnv: 'development',
        load: () => ({ parsed: { MONGODB_URI: normalMongoUri } }),
      })
    ).toThrow('Development public uploads root conflicts');
  });
});
