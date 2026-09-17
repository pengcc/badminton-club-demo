import {
  RepositoryToolError,
  commandFailure,
} from './repository-tool-error.mjs';

export function createGitClient(commandRunner, cwd) {
  const run = (args, options = {}) =>
    commandRunner.run('git', args, { cwd, ...options });
  const required = async (args, context) => {
    const result = await run(args);
    if (!result.ok) throw commandFailure(context, result);
    return result.stdout.trim();
  };
  const requiredRaw = async (args, context) => {
    const result = await run(args);
    if (!result.ok) throw commandFailure(context, result);
    return result.stdout;
  };

  return {
    run,
    required,
    repoRoot: () =>
      required(
        ['rev-parse', '--show-toplevel'],
        'Could not determine repository root'
      ),
    branch: () =>
      required(
        ['rev-parse', '--abbrev-ref', 'HEAD'],
        'Could not determine current branch'
      ),
    head: () => required(['rev-parse', 'HEAD'], 'Could not determine HEAD'),
    ref: (ref) => required(['rev-parse', ref], `Could not determine ${ref}`),
    tree: (ref) =>
      required(
        ['rev-parse', `${ref}^{tree}`],
        `Could not determine tree for ${ref}`
      ),
    status: () =>
      required(['status', '--porcelain'], 'Could not inspect worktree'),
    statusZ: () =>
      requiredRaw(
        ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
        'Could not inspect worktree'
      ),
    origin: () =>
      required(['remote', 'get-url', 'origin'], "Remote 'origin' is required"),
    async defaultBranch() {
      const result = await required(
        ['ls-remote', '--symref', 'origin', 'HEAD'],
        'Could not resolve origin default branch'
      );
      const branch = result.match(/^ref: refs\/heads\/(.+)	HEAD$/m)?.[1];
      if (!branch)
        throw new RepositoryToolError(
          'UNSAFE_BRANCH_STATE',
          'Origin did not advertise one default branch.'
        );
      return branch;
    },
    async remoteHead(branch) {
      const result = await required(
        ['ls-remote', '--heads', 'origin', `refs/heads/${branch}`],
        'Could not inspect origin branch head'
      );
      if (!result) return '';
      const [head, ref] = result.split(/\s+/);
      if (!/^[a-f0-9]{40,64}$/.test(head) || ref !== `refs/heads/${branch}`)
        throw new RepositoryToolError(
          'UNSAFE_BRANCH_STATE',
          'Origin returned an ambiguous branch head.'
        );
      return head;
    },
    fetchDefault: (branch) =>
      required(
        [
          'fetch',
          'origin',
          `refs/heads/${branch}:refs/remotes/origin/${branch}`,
        ],
        `Could not fetch origin/${branch}`
      ),
    upstream: async (branch) => {
      const result = await run([
        'rev-parse',
        '--abbrev-ref',
        '--symbolic-full-name',
        `${branch}@{upstream}`,
      ]);
      return result.ok ? result.stdout.trim() : '';
    },
    verifyRef: async (ref) => (await run(['rev-parse', '--verify', ref])).ok,
    mergeBase: (left, right) =>
      required(
        ['merge-base', left, right],
        `Could not determine merge base for ${left} and ${right}`
      ),
    logRange: (range, format = '--oneline') =>
      required(['log', format, range], 'Could not inspect commits'),
    latestSubject: () =>
      required(
        ['log', '-1', '--format=%s'],
        'Could not read latest commit subject'
      ),
    diff: (args) =>
      required(['--no-pager', 'diff', ...args], 'Could not inspect diff'),
    async checkWhitespace(args) {
      const result = await run(['--no-pager', 'diff', '--check', ...args]);
      if (!result.ok)
        throw commandFailure('Git whitespace validation failed', result);
    },
    includesDefault: async (defaultRef) =>
      (await run(['merge-base', '--is-ancestor', defaultRef, 'HEAD'])).ok,
    push: (branch, expectedHead) =>
      required(
        ['push', 'origin', `${expectedHead}:refs/heads/${branch}`],
        `Could not push ${branch}`
      ),
  };
}

export function parsePorcelainZ(text) {
  const records = text.split('\0');
  const entries = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    const status = record.slice(0, 2);
    const entry = { status, path: record.slice(3) };
    if (/[RC]/.test(status)) {
      index += 1;
      if (records[index]) entry.originalPath = records[index];
    }
    entries.push(entry);
  }
  return entries;
}

export function parseNameStatus(text) {
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [status, ...parts] = line.split('\t');
      return { status: status[0], path: parts.at(-1) };
    });
}
