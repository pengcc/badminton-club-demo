import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createProcessInspector } from './development/process-inspector.mjs';
import {
  deriveDevelopmentSlot,
  parseSlotArguments,
} from './development/dev-slots.mjs';
import { createOutput } from './shared/output.mjs';

const RECOVERY_TIMEOUT_MS = 3_000;
const RECOVERY_POLL_MS = 100;

function isInside(candidate, root) {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

function isBadmintonApiGroupLeader(command) {
  return /(?:^|\s)\S*pnpm(?:\.cjs)?\s+(?:dev:api|--filter\s+@club\/api\s+dev)(?:\s|$)/u.test(
    command
  );
}

function isApiWorkerCommand(command) {
  return /(?:^|\s)src\/server\.ts(?:\s|$)/u.test(command);
}

function isInteractiveShellCommand(command) {
  const executable = command.trim().split(/\s+/u)[0]?.replace(/^-/, '') ?? '';
  return /^(?:.*\/)?(?:zsh|bash|fish|sh)$/u.test(executable);
}

function sameListener(left, right) {
  return (
    left.pid === right.pid &&
    left.pgid === right.pgid &&
    left.cwd === right.cwd &&
    left.worktreeRoot === right.worktreeRoot &&
    left.gitCommonDir === right.gitCommonDir &&
    left.command === right.command
  );
}

async function inspectOwnedGroup(inspector, listener) {
  const members = await inspector.listProcessGroup(listener.pgid);
  const normalized = [];
  for (const member of members) {
    let cwd = await inspector.processCwd(member.pid);
    if (!cwd) {
      const stillLive = await inspector.processDetails(member.pid);
      if (!stillLive) continue;
      throw new Error(`process ${member.pid} has unreadable ownership`);
    }
    cwd = path.resolve(cwd);
    if (!isInside(cwd, listener.worktreeRoot)) {
      throw new Error(`process ${member.pid} is outside the owning worktree`);
    }
    if (
      member.pid === listener.pgid &&
      (isInteractiveShellCommand(member.command) ||
        !isBadmintonApiGroupLeader(member.command))
    ) {
      throw new Error(
        'process-group leader is not bounded Badminton development work'
      );
    }
    normalized.push({ ...member, cwd });
  }
  if (normalized.length === 0)
    throw new Error('target process group is no longer live');
  return normalized;
}

async function resolveInvokingIdentity(inspector, cwd) {
  const identity = await inspector.gitIdentity(cwd);
  if (!identity)
    throw new Error('the invoking checkout Git identity could not be resolved');
  return identity;
}

function slotSummary(web, api) {
  if (web.classification === 'free' && api.classification === 'free')
    return 'free';
  if (web.classification === 'ambiguous' || api.classification === 'ambiguous')
    return 'ambiguous';
  if (web.classification === 'free' || api.classification === 'free')
    return 'partial';
  if (
    web.classification === 'Badminton-owned' &&
    api.classification === 'Badminton-owned' &&
    web.worktreeRoot === api.worktreeRoot
  ) {
    return 'same-worktree-pair';
  }
  return 'mixed-owner';
}

function describePort(role, inspection) {
  const base = `${role} port ${inspection.port}: ${inspection.classification}`;
  if (
    !['Badminton-owned', 'external/other'].includes(inspection.classification)
  ) {
    return inspection.reason ? `${base} (${inspection.reason})` : base;
  }
  const worktree = inspection.worktreeRoot
    ? `, worktree ${inspection.worktreeRoot}`
    : '';
  return `${base}, PID ${inspection.pid}, PGID ${inspection.pgid}, cwd ${inspection.cwd}${worktree}`;
}

export async function runControlCommand({
  mode,
  args = [],
  cwd = process.cwd(),
  env = process.env,
  inspector = createProcessInspector(),
  killImpl = process.kill.bind(process),
  sleepImpl = (delay) => new Promise((resolve) => setTimeout(resolve, delay)),
  now = () => Date.now(),
  output = createOutput({ env }),
} = {}) {
  if (!['status', 'recover'].includes(mode)) {
    output.danger('Usage: --mode status|recover [--slot N]');
    return 1;
  }

  let selectedSlot;
  try {
    selectedSlot = deriveDevelopmentSlot(parseSlotArguments(args));
  } catch (error) {
    output.danger(error.message);
    return 1;
  }

  let invokingIdentity;
  try {
    invokingIdentity = await resolveInvokingIdentity(inspector, cwd);
  } catch (error) {
    output.danger(error.message);
    return 1;
  }

  if (mode === 'status') {
    const web = await inspector.inspectPort(
      selectedSlot.webPort,
      invokingIdentity.gitCommonDir
    );
    const api = await inspector.inspectPort(
      selectedSlot.apiPort,
      invokingIdentity.gitCommonDir
    );
    output.info(`Development slot ${selectedSlot.slot}`);
    output.info(describePort('Web', web));
    output.info(describePort('API', api));
    output.info(
      `Slot summary: ${slotSummary(web, api)}. Listener ownership does not prove routing or common parentage.`
    );
    return 0;
  }

  if (env.NODE_ENV === 'production') {
    output.danger(
      'API development recovery is unavailable when NODE_ENV=production'
    );
    return 1;
  }

  const ownProcess = await inspector.processDetails(process.pid);
  if (!ownProcess) {
    output.danger(
      'Recovery command process-group identity could not be resolved'
    );
    return 1;
  }

  let listener = await inspector.inspectPort(
    selectedSlot.apiPort,
    invokingIdentity.gitCommonDir
  );
  if (listener.classification === 'free') {
    output.success(
      `Development slot ${selectedSlot.slot} API port ${selectedSlot.apiPort} is free; no recovery was needed.`
    );
    return 0;
  }

  try {
    if (listener.classification !== 'Badminton-owned') {
      throw new Error(`API port ownership is ${listener.classification}`);
    }
    if (listener.cwd !== path.join(listener.worktreeRoot, 'apps', 'api')) {
      throw new Error(
        'listener cwd is not the owning worktree apps/api directory'
      );
    }
    if (!isApiWorkerCommand(listener.command)) {
      throw new Error('listener is not the Badminton development API worker');
    }
    if (listener.pgid === ownProcess.pgid) {
      throw new Error(
        "target process group is the recovery command's own group"
      );
    }
    await inspectOwnedGroup(inspector, listener);

    const refreshed = await inspector.inspectPort(
      selectedSlot.apiPort,
      invokingIdentity.gitCommonDir
    );
    if (
      refreshed.classification !== 'Badminton-owned' ||
      !sameListener(listener, refreshed)
    ) {
      throw new Error(
        'listener identity changed during the pre-signal recheck'
      );
    }
    if (!isApiWorkerCommand(refreshed.command)) {
      throw new Error(
        'listener is no longer the Badminton development API worker'
      );
    }
    await inspectOwnedGroup(inspector, refreshed);
    listener = refreshed;
  } catch (error) {
    output.danger(`Recovery refused: ${error.message}. No signal was sent.`);
    return 1;
  }

  output.warning(
    `Recovering slot ${selectedSlot.slot} API port ${selectedSlot.apiPort}: PID ${listener.pid}, PGID ${listener.pgid}, worktree ${listener.worktreeRoot}. Sending one SIGTERM to the verified process group.`
  );
  try {
    killImpl(-listener.pgid, 'SIGTERM');
  } catch (error) {
    output.danger(`SIGTERM failed: ${error.message}`);
    return 1;
  }

  const deadline = now() + RECOVERY_TIMEOUT_MS;
  while (true) {
    const portState = await inspector.inspectPort(
      selectedSlot.apiPort,
      invokingIdentity.gitCommonDir
    );
    const groupMembers = await inspector.listProcessGroup(listener.pgid);
    if (portState.classification === 'free' && groupMembers.length === 0) {
      output.success(
        `Recovered slot ${selectedSlot.slot}: API port ${selectedSlot.apiPort} is free and PGID ${listener.pgid} has exited.`
      );
      return 0;
    }
    if (now() >= deadline) {
      output.danger(
        `Recovery incomplete: API port state is ${portState.classification} and PGID ${listener.pgid} has ${groupMembers.length} live member(s). No further signal was sent.`
      );
      return 1;
    }
    await sleepImpl(RECOVERY_POLL_MS);
  }
}

function parseMainArguments(args) {
  if (args.length < 2 || args[0] !== '--mode') return { mode: null, args: [] };
  return { mode: args[1], args: args.slice(2) };
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const parsed = parseMainArguments(process.argv.slice(2));
  process.exitCode = await runControlCommand(parsed);
}
