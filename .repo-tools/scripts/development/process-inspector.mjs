import { realpath } from 'node:fs/promises';
import { createCommandRunner } from '../shared/command-runner.mjs';

function parsePidLines(stdout) {
  return [
    ...new Set(
      stdout
        .split(/\r?\n/u)
        .filter((line) => /^p\d+$/u.test(line))
        .map((line) => Number(line.slice(1)))
    ),
  ];
}

function parseProcessLine(stdout) {
  const match = stdout.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/u);
  if (!match) return null;
  return {
    pid: Number(match[1]),
    ppid: Number(match[2]),
    pgid: Number(match[3]),
    command: match[4],
  };
}

function parseProcessTable(stdout) {
  return stdout
    .split(/\r?\n/u)
    .map((line) => parseProcessLine(line))
    .filter(Boolean);
}

function parseCwd(stdout) {
  const line = stdout.split(/\r?\n/u).find((entry) => entry.startsWith('n'));
  return line?.slice(1) || null;
}

function isCanonicalNoMatch(result) {
  return (
    !result.ok &&
    result.exitCode === 1 &&
    result.signal === null &&
    !result.stdout.trim() &&
    !result.stderr.trim()
  );
}

export function createProcessInspector({
  runner = createCommandRunner(),
  realpathImpl = realpath,
} = {}) {
  const run = (command, args, options) => runner.run(command, args, options);

  const processDetails = async (pid) => {
    const result = await run('ps', [
      '-p',
      String(pid),
      '-o',
      'pid=,ppid=,pgid=,command=',
    ]);
    if (isCanonicalNoMatch(result)) return null;
    if (!result.ok) throw new Error(`process ${pid} inspection failed`);
    const details = parseProcessLine(result.stdout);
    if (!details)
      throw new Error(`process ${pid} inspection returned ambiguous output`);
    return details;
  };

  const processCwd = async (pid) => {
    const result = await run('lsof', [
      '-a',
      '-p',
      String(pid),
      '-d',
      'cwd',
      '-Fn',
    ]);
    if (isCanonicalNoMatch(result)) return null;
    if (!result.ok) throw new Error(`process ${pid} cwd inspection failed`);
    const cwd = parseCwd(result.stdout);
    if (!cwd)
      throw new Error(
        `process ${pid} cwd inspection returned ambiguous output`
      );
    return cwd;
  };

  const gitIdentity = async (cwd) => {
    const topLevel = await run('git', [
      '-C',
      cwd,
      'rev-parse',
      '--show-toplevel',
    ]);
    if (!topLevel.ok || !topLevel.stdout.trim()) return null;
    const worktreeRoot = await realpathImpl(topLevel.stdout.trim());
    const common = await run('git', [
      '-C',
      worktreeRoot,
      'rev-parse',
      '--path-format=absolute',
      '--git-common-dir',
    ]);
    if (!common.ok || !common.stdout.trim()) return null;
    return {
      worktreeRoot,
      gitCommonDir: await realpathImpl(common.stdout.trim()),
    };
  };

  const inspectPort = async (port, invokingGitCommonDir) => {
    const result = await run('lsof', [
      '-nP',
      `-iTCP:${port}`,
      '-sTCP:LISTEN',
      '-Fp',
    ]);
    if (isCanonicalNoMatch(result)) {
      return { classification: 'free', port };
    }
    if (!result.ok) {
      return {
        classification: 'ambiguous',
        port,
        reason: 'listener inspection failed',
      };
    }

    const pids = parsePidLines(result.stdout);
    if (pids.length === 0) {
      return {
        classification: 'ambiguous',
        port,
        reason: 'listener inspection returned no PID',
      };
    }
    if (pids.length !== 1) {
      return {
        classification: 'ambiguous',
        port,
        reason: `multiple listener PIDs (${pids.join(', ')})`,
      };
    }

    let details;
    let cwdValue;
    try {
      details = await processDetails(pids[0]);
      cwdValue = await processCwd(pids[0]);
    } catch {
      return {
        classification: 'ambiguous',
        port,
        reason: 'listener inspection failed',
      };
    }
    if (!details || !cwdValue) {
      return {
        classification: 'ambiguous',
        port,
        reason: 'listener identity changed or is unreadable',
      };
    }

    let cwd;
    try {
      cwd = await realpathImpl(cwdValue);
    } catch {
      return {
        classification: 'ambiguous',
        port,
        reason: 'listener cwd is unreadable',
      };
    }
    let identity = null;
    try {
      identity = await gitIdentity(cwd);
    } catch {
      identity = null;
    }
    const owned = identity?.gitCommonDir === invokingGitCommonDir;
    return {
      classification: owned ? 'Badminton-owned' : 'external/other',
      port,
      ...details,
      cwd,
      worktreeRoot: identity?.worktreeRoot ?? null,
      gitCommonDir: identity?.gitCommonDir ?? null,
    };
  };

  const listProcessGroup = async (pgid) => {
    const result = await run('ps', ['-axo', 'pid=,ppid=,pgid=,command=']);
    if (!result.ok) throw new Error('process-group inspection failed');
    return parseProcessTable(result.stdout).filter(
      (entry) => entry.pgid === pgid
    );
  };

  return {
    gitIdentity,
    inspectPort,
    listProcessGroup,
    processCwd,
    processDetails,
  };
}
