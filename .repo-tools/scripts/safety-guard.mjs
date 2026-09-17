#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import { createCommandRunner } from './shared/command-runner.mjs';
import { createOutput } from './shared/output.mjs';
import { lstat, readFile, readlink } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import { RepositoryToolError } from './shared/repository-tool-error.mjs';
import {
  createGitClient,
  parseNameStatus,
  parsePorcelainZ,
} from './shared/git-client.mjs';
import { assertSecretSafeScope } from './repository-safety/secret-safety.mjs';

function statusForWorktreeEntry(entry) {
  if (entry.status === '??') return 'A';
  if (entry.status.includes('D')) return 'D';
  if (entry.status.includes('A')) return 'A';
  return 'M';
}

function mergeFiles(...groups) {
  const files = new Map();
  for (const group of groups) {
    for (const file of group) files.set(file.path, file);
  }
  return [...files.values()].sort((left, right) =>
    left.path.localeCompare(right.path)
  );
}

function untrackedFileDiff(path, content, mode = '100644') {
  return [
    `diff --git a/${path} b/${path}`,
    `new file mode ${mode}`,
    '--- /dev/null',
    `+++ b/${path}`,
    ...content.split(/\r?\n/).map((line) => `+${line}`),
  ].join('\n');
}

async function readUntrackedGitContent(root, path) {
  const absolutePath = resolve(root, path);
  const relativePath = relative(root, absolutePath);
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    throw new RepositoryToolError(
      'UNSAFE_PATH',
      `Untracked path resolves outside the repository: ${path}`
    );
  }
  const stats = await lstat(absolutePath);
  if (stats.isSymbolicLink()) {
    return { content: await readlink(absolutePath), mode: '120000' };
  }
  if (!stats.isFile()) {
    throw new RepositoryToolError(
      'UNSAFE_PATH',
      `Unsupported untracked filesystem entry in safety scope: ${path}`
    );
  }
  return { content: await readFile(absolutePath, 'utf8'), mode: '100644' };
}

export async function collectReadOnlySafetyScope({ git, root, compareRef }) {
  if (!(await git.verifyRef(compareRef))) {
    throw new RepositoryToolError(
      'UNSAFE_BRANCH_STATE',
      `Comparison ref not found: ${compareRef}. Refresh or create the local remote-tracking ref before running safety:guard.`
    );
  }

  const mergeBase = await git.mergeBase(compareRef, 'HEAD');
  const committedRange = `${mergeBase}...HEAD`;
  const committedFiles = parseNameStatus(
    await git.diff(['--name-status', '--no-renames', committedRange])
  );
  const committedDiff = await git.diff([committedRange]);
  const worktreeEntries = parsePorcelainZ(await git.statusZ());
  const worktreeFiles = worktreeEntries.flatMap((entry) => {
    const files = [{ path: entry.path, status: statusForWorktreeEntry(entry) }];
    if (entry.originalPath)
      files.push({ path: entry.originalPath, status: 'D' });
    return files;
  });
  const trackedWorktreeDiff = await git.diff(['HEAD']);
  const untrackedEntries = worktreeEntries.filter(
    (entry) => entry.status === '??'
  );
  const untrackedDiffs = await Promise.all(
    untrackedEntries.map(async ({ path }) => {
      const { content, mode } = await readUntrackedGitContent(root, path);
      return untrackedFileDiff(path, content, mode);
    })
  );

  return {
    compareRef,
    mergeBase,
    files: mergeFiles(committedFiles, worktreeFiles),
    diff: [committedDiff, trackedWorktreeDiff, ...untrackedDiffs]
      .filter(Boolean)
      .join('\n'),
  };
}

export async function runSafetyGuardFlow({ git, output, env = process.env }) {
  const defaultBranch = env.DEFAULT_BRANCH || 'main';
  const compareRef = `origin/${defaultBranch}`;
  const root = await git.repoRoot();
  const branch = await git.branch();
  const scope = await collectReadOnlySafetyScope({ git, root, compareRef });

  output.step('Read-only secret-safety guard');
  output.info(`Branch: ${branch}`);
  output.info(`Local comparison ref: ${scope.compareRef}`);
  output.info(`Merge base: ${scope.mergeBase}`);
  output.info(`Changed files scanned: ${scope.files.length}`);
  output.info('GitHub, fetch, stage, commit, push, and PR operations: none');

  return assertSecretSafeScope({
    files: scope.files,
    diff: scope.diff,
    output,
    standalone: true,
  });
}

export function parseOptions(argv) {
  const options = { verbose: false, help: false };
  for (const arg of argv) {
    if (arg === '--verbose') options.verbose = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else
      throw new RepositoryToolError(
        'INVALID_ARGUMENT',
        'safety:guard supports only --verbose and --help.'
      );
  }
  return options;
}

export async function main(argv = process.argv.slice(2)) {
  const major = Number(process.versions.node.split('.')[0]);
  if (!Number.isInteger(major) || major < 24) {
    throw new RepositoryToolError(
      'UNSUPPORTED_RUNTIME',
      `Node.js 24 or newer is required; current version is ${process.versions.node}.`
    );
  }
  const options = parseOptions(argv);
  if (options.help) {
    process.stdout.write('Usage: pnpm safety:guard [--verbose] [--help]\n');
    return;
  }
  const output = createOutput({ verbose: options.verbose });
  const git = createGitClient(createCommandRunner(), process.cwd());
  return runSafetyGuardFlow({ git, output });
}

export async function runCli(
  argv = process.argv.slice(2),
  { run = main, renderError = (message) => createOutput().error(message) } = {}
) {
  try {
    await run(argv);
    return 0;
  } catch (error) {
    const type =
      error instanceof RepositoryToolError ? error.type : 'UNEXPECTED_ERROR';
    if (!error.details?.alreadyPresented)
      renderError(`${type}: ${error.message}`);
    return 1;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runCli().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
