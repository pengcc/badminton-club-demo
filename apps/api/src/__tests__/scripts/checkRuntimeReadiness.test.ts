import { afterEach, describe, expect, it, vi } from 'vitest';
import { runRuntimeReadinessCli } from '../../scripts/checkRuntimeReadiness';

describe('check:runtime-readiness CLI', () => {
  const originalMongoUri = process.env.MONGODB_URI;

  afterEach(() => {
    if (originalMongoUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = originalMongoUri;
    vi.resetModules();
  });

  it('keeps configuration import failures inside a privacy-safe CLI boundary', async () => {
    const write = vi.fn();
    const exitCode = await runRuntimeReadinessCli({
      loadRunner: async () => {
        throw new Error('MONGODB_URI=mongodb://secret-target/person');
      },
      write,
    });

    expect(exitCode).toBe(1);
    expect(write).toHaveBeenCalledOnce();
    const output = JSON.stringify(write.mock.calls[0]?.[0]);
    expect(output).toContain('CONFIGURATION_INVALID');
    expect(output).not.toContain('secret-target');
  });

  it('returns zero for unverified and forwards only the explicit SMTP flag', async () => {
    const run = vi.fn(async ({ verifySmtp }: { verifySmtp: boolean }) => ({
      status: 'unverified' as const,
      observedAt: '2026-08-10T10:00:00.000Z',
      checks: [],
      verifySmtp,
    }));
    const write = vi.fn();

    await expect(
      runRuntimeReadinessCli({
        arguments_: [],
        loadRunner: async () => run,
        write,
      })
    ).resolves.toBe(0);
    expect(run).toHaveBeenCalledWith({ verifySmtp: false });
  });

  it.each([
    ['blocked', 1],
    ['degraded', 0],
    ['unverified', 0],
    ['ready', 0],
  ] as const)('uses the release-safe exit code for a %s report', async (status, expectedExitCode) => {
    const report = {
      status,
      observedAt: '2026-08-10T10:00:00.000Z',
      checks: [],
    };
    const write = vi.fn();

    await expect(
      runRuntimeReadinessCli({
        loadRunner: async () => async () => report,
        write,
      })
    ).resolves.toBe(expectedExitCode);
    expect(write).toHaveBeenCalledWith(report);
  });

  it('returns one for invalid invocation without running the preflight', async () => {
    const loadRunner = vi.fn();

    await expect(
      runRuntimeReadinessCli({ arguments_: ['--unknown'], loadRunner })
    ).resolves.toBe(1);
    expect(loadRunner).not.toHaveBeenCalled();
  });

  it('keeps a missing application Mongo URI inside the bounded readiness report', async () => {
    delete process.env.MONGODB_URI;
    const write = vi.fn();

    const exitCode = await runRuntimeReadinessCli({ write });

    expect(exitCode).toBe(1);
    const output = JSON.stringify(write.mock.calls[0]?.[0]);
    expect(output).toContain('MONGO_CONNECTION_FAILED');
    expect(output).not.toContain('Missing required environment variable');
  });
});
