import { RepositoryToolError } from '../shared/repository-tool-error.mjs';

export function parseCliOptions(argv) {
  const options = {
    mode: '',
    prTitle: '',
    prTitleExplicit: false,
    bodyFile: '',
    prNumber: null,
    showDiff: false,
    verbose: false,
    acknowledgeSecretReview: false,
    help: false,
  };
  const positionals = [];
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('-')) {
      positionals.push(value);
      continue;
    }
    if (seen.has(value))
      throw new RepositoryToolError(
        'INVALID_ARGUMENT',
        `${value} may be supplied only once.`
      );
    seen.add(value);
    if (value === '--show-diff') options.showDiff = true;
    else if (value === '--verbose') options.verbose = true;
    else if (value === '--acknowledge-secret-review')
      options.acknowledgeSecretReview = true;
    else if (value === '--help' || value === '-h') options.help = true;
    else if (['--mode', '--title', '--body-file'].includes(value)) {
      const next = argv[++index];
      if (!next || next.startsWith('-'))
        throw new RepositoryToolError(
          'INVALID_ARGUMENT',
          `${value} requires a value.`
        );
      if (value === '--mode') options.mode = next;
      if (value === '--title') {
        options.prTitle = next;
        options.prTitleExplicit = true;
      }
      if (value === '--body-file') options.bodyFile = next;
    } else
      throw new RepositoryToolError(
        'INVALID_ARGUMENT',
        `Unknown option: ${value}`
      );
  }
  if (!['pr-open-or-update', 'pr-merge'].includes(options.mode))
    throw new RepositoryToolError(
      'INVALID_ARGUMENT',
      'An explicit supported --mode is required: pr-open-or-update or pr-merge.'
    );
  if (options.mode === 'pr-merge') {
    if (
      options.showDiff ||
      options.acknowledgeSecretReview ||
      options.prTitleExplicit ||
      options.bodyFile
    )
      throw new RepositoryToolError(
        'INVALID_ARGUMENT',
        'pr-merge supports only --verbose and --help.'
      );
    if (options.help) return options;
    if (
      positionals.length !== 1 ||
      !/^[1-9]\d*$/.test(positionals[0]) ||
      !Number.isSafeInteger(Number(positionals[0]))
    )
      throw new RepositoryToolError(
        'INVALID_ARGUMENT',
        'pr-merge requires exactly one positive integer PR number.'
      );
    options.prNumber = Number(positionals[0]);
  } else if (positionals.length)
    throw new RepositoryToolError(
      'INVALID_ARGUMENT',
      'Use --title and --body-file for PR content.'
    );
  return options;
}

export function usage() {
  return [
    'Usage:',
    '  pnpm pr:open-or-update [--title TITLE] [--body-file PATH] [--show-diff] [--acknowledge-secret-review] [--verbose]',
    '  pnpm pr:merge <pr-number> [--verbose]',
    '',
    'PR publication requires a clean committed feature branch and current execution-owned validation.',
    '--body-file deliberately supplies the complete PR description; omit it to preserve an existing body.',
    '--acknowledge-secret-review accepts only reviewed low-confidence findings, never blocked secrets.',
    '-h, --help shows this help. Neither path stages, commits, or runs implementation validation.',
  ].join('\n');
}
