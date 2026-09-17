import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const configUrl = pathToFileURL(path.resolve(process.cwd(), 'next.config.mjs'));

async function loadConfig(cacheKey: string) {
  return (await import(`${configUrl.href}?${cacheKey}`)).default;
}

describe('Docker Web packaging', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps standalone output disabled for the ordinary build', async () => {
    vi.stubEnv('DOCKER_STANDALONE_BUILD', '');

    const config = await loadConfig('ordinary');

    expect(config.output).toBeUndefined();
  });

  it('enables standalone output only for the Docker build', async () => {
    vi.stubEnv('DOCKER_STANDALONE_BUILD', '1');

    const config = await loadConfig('docker');

    expect(config.output).toBe('standalone');
  });

  it('freezes Docker rewrites to the POC API service', async () => {
    vi.stubEnv('DOCKER_STANDALONE_BUILD', '1');
    vi.stubEnv('API_URL', 'http://api:3003');

    const config = await loadConfig('docker-rewrites');

    await expect(config.rewrites()).resolves.toEqual([
      {
        source: '/api/:path*',
        destination: 'http://api:3003/api/:path*',
      },
      {
        source: '/uploads/:path*',
        destination: 'http://api:3003/uploads/:path*',
      },
    ]);
  });

  it('ships a static liveness asset outside the middleware matcher', async () => {
    const livenessBody = await readFile(
      path.resolve(process.cwd(), 'public/up.txt'),
      'utf8'
    );

    expect(livenessBody).toBe('ok\n');
  });
});
