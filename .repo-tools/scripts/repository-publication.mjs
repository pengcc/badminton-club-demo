#!/usr/bin/env node

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseCliOptions,
  usage,
} from './repository-publication/cli-options.mjs';
import { runMergePrFlow } from './repository-publication/merge-pr-flow.mjs';
import { runPrOpenOrUpdateFlow } from './repository-publication/pr-open-or-update-flow.mjs';
import { createCommandRunner } from './shared/command-runner.mjs';
import { RepositoryToolError } from './shared/repository-tool-error.mjs';
import { createGhClient } from './repository-publication/gh-client.mjs';
import { createGitClient } from './shared/git-client.mjs';
import { createOutput } from './shared/output.mjs';

export function selectPublicationFlow(
  mode,
  flows = {
    'pr-open-or-update': runPrOpenOrUpdateFlow,
    'pr-merge': runMergePrFlow,
  }
) {
  return flows[mode];
}

export function assertSupportedRuntime(version = process.versions.node) {
  const major = Number(version.split('.')[0]);
  if (!Number.isInteger(major) || major < 24) {
    throw new RepositoryToolError(
      'UNSUPPORTED_RUNTIME',
      `Node.js 24 or newer is required; current version is ${version}.`
    );
  }
}

export async function main(argv = process.argv.slice(2)) {
  assertSupportedRuntime();
  const options = parseCliOptions(argv);
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const output = createOutput({ verbose: options.verbose });
  const commandRunner = createCommandRunner();
  const git = createGitClient(commandRunner, process.cwd());
  const gh = createGhClient(commandRunner, process.cwd());
  await selectPublicationFlow(options.mode)({ git, gh, output, options });
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
