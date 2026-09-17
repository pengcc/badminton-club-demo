import { spawn } from 'node:child_process';
import { RepositoryToolError } from './repository-tool-error.mjs';

export function createStreamingRunner({ spawnImpl = spawn } = {}) {
  const waitFor = (child, label, timeoutMs) =>
    new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve();
      };
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        finish(
          new RepositoryToolError('COMMAND_TIMEOUT', `${label} timed out.`)
        );
      }, timeoutMs);
      child.once('error', () =>
        finish(
          new RepositoryToolError('COMMAND_FAILED', `${label} could not start.`)
        )
      );
      child.once('close', (code) => {
        if (code === 0) finish();
        else
          finish(
            new RepositoryToolError(
              'COMMAND_FAILED',
              `${label} failed (exit code ${code ?? 'unknown'}).`
            )
          );
      });
    });

  return {
    async run(command, args, options, label) {
      const child = spawnImpl(command, args, {
        cwd: options.cwd,
        env: options.env ?? process.env,
        shell: false,
        stdio: ['ignore', 'inherit', 'inherit'],
      });
      await waitFor(child, label, options.timeoutMs ?? 30 * 60_000);
    },
  };
}
