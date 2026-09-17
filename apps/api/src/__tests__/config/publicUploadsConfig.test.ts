import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolvePublicUploadsRoot } from '../../config/publicUploadsConfig';

describe('public uploads configuration', () => {
  it('requires an absolute bootstrap-owned root in development', () => {
    expect(() =>
      resolvePublicUploadsRoot({
        nodeEnv: 'development',
        workingDirectory: '/workspace/apps/api',
        configuredRoot: undefined,
      })
    ).toThrow('Run pnpm bootstrap:local-env');
    expect(() =>
      resolvePublicUploadsRoot({
        nodeEnv: 'development',
        workingDirectory: '/workspace/apps/api',
        configuredRoot: 'uploads',
      })
    ).toThrow('Run pnpm bootstrap:local-env');
  });

  it('uses the configured absolute development root', () => {
    expect(
      resolvePublicUploadsRoot({
        nodeEnv: 'development',
        workingDirectory: '/workspace/apps/api',
        configuredRoot: '/retained/apps/api/uploads',
      })
    ).toBe(path.resolve('/retained/apps/api/uploads'));
  });

  it.each([
    'test',
    'production',
  ])('preserves the working-directory uploads fallback in %s', (nodeEnv) => {
    expect(
      resolvePublicUploadsRoot({
        nodeEnv,
        workingDirectory: '/workspace/apps/api',
        configuredRoot: '/ignored',
      })
    ).toBe(path.resolve('/workspace/apps/api/uploads'));
  });
});
