import { spawn } from 'node:child_process';
import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { createProcessInspector } from './development/process-inspector.mjs';
import { fileURLToPath } from 'node:url';
import {
  COMBINED_DEVELOPMENT_SESSION_ENV,
  DEVELOPMENT_API_STARTUP_SIGNALS,
} from '../../apps/api/src/developmentStartupContract.ts';
import {
  deriveDevelopmentSlot,
  parseSlotArguments,
} from './development/dev-slots.mjs';
import { createOutput } from './shared/output.mjs';

const API_STARTUP_TIMEOUT_MS = 10_000;

function relayLines(stream, destination, inspectLine) {
  if (!stream) return;
  stream.setEncoding('utf8');
  let buffered = '';
  stream.on('data', (chunk) => {
    buffered += chunk;
    let newlineIndex = buffered.indexOf('\n');
    while (newlineIndex >= 0) {
      const line = buffered.slice(0, newlineIndex);
      if (!inspectLine(line.replace(/\r$/u, ''))) {
        destination.write(`${line}\n`);
      }
      buffered = buffered.slice(newlineIndex + 1);
      newlineIndex = buffered.indexOf('\n');
    }
  });
  stream.on('end', () => {
    if (buffered && !inspectLine(buffered.replace(/\r$/u, ''))) {
      destination.write(buffered);
    }
  });
}

function terminate(child) {
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGTERM');
  }
}

// Next 16.2.11 writes this JSON itself. Never acquire, delete, or repair its lock.
async function inspectNextLock({ cwd, inspector, readFileImpl, realpathImpl }) {
  try {
    const webRoot = await realpathImpl(path.join(cwd, 'apps', 'web'));
    const lockPath = path.join(webRoot, '.next', 'dev', 'lock');
    const content = await readFileImpl(lockPath, 'utf8');
    const info = JSON.parse(content);
    if (
      !Number.isSafeInteger(info?.pid) ||
      info.pid <= 0 ||
      !Number.isInteger(info.port) ||
      info.port < 1 ||
      info.port > 65535 ||
      info.appUrl !== `http://localhost:${info.port}`
    )
      return null;
    const details = await inspector.processDetails(info.pid);
    if (
      details?.pid !== info.pid ||
      !/^next-server(?:\s|$)/u.test(details.command)
    )
      return null;
    const processRoot = await inspector.processCwd(info.pid);
    if (!processRoot || (await realpathImpl(processRoot)) !== webRoot)
      return null;

    // Re-read the lock and live identity at the decision boundary, without a registry.
    if ((await readFileImpl(lockPath, 'utf8')) !== content) return null;
    const refreshedRoot = await inspector.processCwd(info.pid);
    if (!refreshedRoot || (await realpathImpl(refreshedRoot)) !== webRoot)
      return null;
    const refreshed = await inspector.processDetails(info.pid);
    if (
      !refreshed ||
      refreshed.pid !== details.pid ||
      refreshed.ppid !== details.ppid ||
      refreshed.pgid !== details.pgid ||
      refreshed.command !== details.command
    )
      return null;
    return { pid: info.pid, appUrl: info.appUrl };
  } catch {
    // Missing/stale/unreadable evidence leaves Next as the authoritative lock owner.
    return null;
  }
}

export async function runDevelopmentSession({
  args = [],
  cwd = process.cwd(),
  env = process.env,
  spawnImpl = spawn,
  inspector = createProcessInspector(),
  readFileImpl = readFile,
  realpathImpl = realpath,
  stdout = process.stdout,
  stderr = process.stderr,
  output = createOutput({ stdout, stderr, env }),
  failureOutput = createOutput({ stdout: stderr, stderr, env }),
  startupTimeoutMs = API_STARTUP_TIMEOUT_MS,
  setTimeoutImpl = setTimeout,
  clearTimeoutImpl = clearTimeout,
} = {}) {
  let selectedSlot;
  try {
    selectedSlot = deriveDevelopmentSlot(parseSlotArguments(args));
  } catch (error) {
    output.danger(`Development session blocked: ${error.message}.`);
    return Promise.resolve(1);
  }

  // Port inspection is fail-closed; the framework lock is best-effort evidence only.
  try {
    const identity = await inspector.gitIdentity(cwd);
    if (!identity) throw new Error('unresolved checkout');
    const ports = await Promise.all([
      inspector.inspectPort(selectedSlot.webPort, identity.gitCommonDir),
      inspector.inspectPort(selectedSlot.apiPort, identity.gitCommonDir),
    ]);
    const conflicts = ports.filter((port) => port.classification !== 'free');
    if (conflicts.length) {
      const statusCommand = `pnpm dev:status -- --slot ${selectedSlot.slot}`;
      const causes = conflicts.map((port) => {
        const role = port.port === selectedSlot.webPort ? 'Web' : 'API';
        return `${role} port ${port.port}: ${port.classification}${Number.isSafeInteger(port.pid) ? `, PID ${port.pid}` : ''}`;
      });
      const knownSlot = conflicts.every(
        (port) => port.classification === 'Badminton-owned'
      );
      const completeOtherWorktreeSlot =
        ports.every((port) => port.classification === 'Badminton-owned') &&
        Boolean(ports[0].worktreeRoot) &&
        ports[0].worktreeRoot === ports[1].worktreeRoot &&
        ports[0].worktreeRoot !== identity.worktreeRoot;
      const api = ports[1];
      const apiWorker =
        api.classification === 'Badminton-owned' &&
        api.cwd === path.join(api.worktreeRoot, 'apps', 'api') &&
        /(?:^|\s)src\/server\.ts(?:\s|$)/u.test(api.command);
      failureOutput.danger('Development session blocked before API/Web spawn.');
      failureOutput.info(
        completeOtherWorktreeSlot
          ? `Cause: development slot ${selectedSlot.slot} has Badminton-owned Web and API listeners in another worktree.`
          : knownSlot
            ? `Cause: development slot ${selectedSlot.slot} is occupied by one or more Badminton-owned listeners.`
            : `Cause: development slot ${selectedSlot.slot} is not safely free because listener ownership is external or ambiguous.`
      );
      if (completeOtherWorktreeSlot) {
        failureOutput.info(
          'Next action: Choose another explicit slot for this worktree, then rerun pnpm dev with that --slot value.'
        );
      } else {
        failureOutput.command('Next action:', statusCommand);
      }
      failureOutput.info(
        `Details:\n` +
          `  Listeners: ${causes.join('; ')}.\n` +
          (completeOtherWorktreeSlot
            ? `  Inspection: ${statusCommand}\n`
            : knownSlot
              ? '  Alternative: Use another explicit slot in a distinct worktree if this session is still needed.\n'
              : '  Recovery: Resolve external or ambiguous ownership before taking action.\n') +
          (apiWorker
            ? `  Recovery: If the identified API is stale or no longer needed, use pnpm recover:dev-api -- --slot ${selectedSlot.slot}; recovery rechecks ownership before signaling.\n`
            : '') +
          '  Safety: no existing process was stopped and no alternative slot was selected.'
      );
      return 1;
    }
  } catch {
    output.danger(
      `Development slot ${selectedSlot.slot} blocked before API/Web spawn: listener ownership could not be inspected.\n` +
        `Next action: run pnpm dev:status -- --slot ${selectedSlot.slot} and resolve the inspection failure before retrying. No existing process was stopped.`
    );
    return 1;
  }

  const nextServer = await inspectNextLock({
    cwd,
    inspector,
    readFileImpl,
    realpathImpl,
  });
  if (nextServer) {
    failureOutput.danger('Development session blocked before API/Web spawn.');
    failureOutput.info(
      'Cause: this worktree already has a verified Next.js development server.'
    );
    failureOutput.info(
      `Next action: Continue using the existing server at ${nextServer.appUrl}.`
    );
    failureOutput.info(
      `Details:\n` +
        `  PID: ${nextServer.pid}\n` +
        `  Alternative: Run kill ${nextServer.pid} only if you intentionally want to replace it, then retry pnpm dev.\n` +
        '  Safety: a different slot does not bypass the same-worktree lock. No signal was sent and the lock was not deleted.'
    );
    return 1;
  }

  const apiEnv = {
    ...env,
    PORT: String(selectedSlot.apiPort),
    FRONTEND_URL: selectedSlot.webOrigin,
    [COMBINED_DEVELOPMENT_SESSION_ENV]: '1',
  };
  const webEnv = {
    ...env,
    PORT: String(selectedSlot.webPort),
    FRONTEND_URL: selectedSlot.webOrigin,
    API_URL: selectedSlot.apiOrigin,
    NEXT_PUBLIC_API_URL: selectedSlot.apiOrigin,
  };

  return new Promise((resolve) => {
    let api;
    let web;
    let settled = false;
    let apiListening = false;
    let startupTimer;

    const finish = (exitCode) => {
      if (settled) return;
      settled = true;
      clearTimeoutImpl(startupTimer);
      terminate(api);
      terminate(web);
      resolve(exitCode);
    };

    const blockSession = ({
      mongoFailure = false,
      listenerFailure = false,
    } = {}) => {
      if (settled) return;
      const consequence =
        'Consequence: Web was not started (or was stopped) because it cannot form a usable application session without the API.';
      let diagnostic;
      if (mongoFailure) {
        // Keep the whole failure together on stderr, using the existing output styles.
        failureOutput.danger('Development session blocked.');
        failureOutput.info(
          'Cause: the configured MongoDB target was unavailable during the initial API connection.'
        );
        failureOutput.command(
          'Next action (project Docker option):',
          'pnpm mongo:docker:start'
        );
        failureOutput.info(
          `Details:\n` +
            `  ${consequence}\n` +
            '  Alternative: start or recover the configured local MongoDB provider manually.\n' +
            '  Troubleshooting: resolve any provider startup failure; check apps/api/.env.local and MONGODB_URI select the intended target, then run pnpm dev again.\n' +
            '  See .repo-tools/development/README.md. Connection values are intentionally not printed.'
        );
        finish(1);
        return;
      } else if (listenerFailure) {
        diagnostic =
          'Development session blocked: the API could not acquire its configured listener.\n' +
          `${consequence}\n` +
          `Next action: inspect the affected port with pnpm dev:status -- --slot ${selectedSlot.slot}, resolve its ownership before using recovery or stopping a process, then run pnpm dev again. The existing listener was not reused or stopped by this session.`;
      } else {
        diagnostic =
          'Development session blocked: the API did not reach its startup-ready/listening state.\n' +
          `${consequence}\n` +
          'Next action: review the bounded API startup output above, correct the startup failure, then run pnpm dev again. Raw errors and connection values are intentionally not repeated.';
      }
      output.danger(diagnostic);
      finish(1);
    };

    const startWeb = () => {
      if (settled || web) return;
      apiListening = true;
      clearTimeoutImpl(startupTimer);
      output.success(
        'API reached its listening state; starting Web development.'
      );
      web = spawnImpl('pnpm', ['--filter', '@club/web', 'dev'], {
        cwd,
        env: webEnv,
        shell: false,
        stdio: ['inherit', 'pipe', 'pipe'],
      });
      relayLines(web.stdout, stdout, () => false);
      relayLines(web.stderr, stderr, () => false);
      web.on('error', () => finish(1));
      web.on('close', () => finish(1));
    };

    const inspectApiLine = (line) => {
      if (line === DEVELOPMENT_API_STARTUP_SIGNALS.ready) {
        startWeb();
        return true;
      }
      if (line === DEVELOPMENT_API_STARTUP_SIGNALS.initialMongoFailure) {
        blockSession({ mongoFailure: true });
        return true;
      }
      if (line === DEVELOPMENT_API_STARTUP_SIGNALS.listenerFailure) {
        blockSession({ listenerFailure: true });
        return true;
      }
      return false;
    };

    output.step(
      `Starting development slot ${selectedSlot.slot}: Web ${selectedSlot.webOrigin}, API ${selectedSlot.apiOrigin}`
    );
    output.step('Starting API development and waiting for its listening state');
    startupTimer = setTimeoutImpl(blockSession, startupTimeoutMs);
    api = spawnImpl('pnpm', ['--filter', '@club/api', 'dev'], {
      cwd,
      env: apiEnv,
      shell: false,
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    relayLines(api.stdout, stdout, inspectApiLine);
    relayLines(api.stderr, stderr, inspectApiLine);
    api.on('error', () => blockSession());
    api.on('close', () => {
      if (!apiListening) blockSession();
      else finish(1);
    });
  });
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  process.exitCode = await runDevelopmentSession({
    args: process.argv.slice(2),
  });
}
