export class RepositoryToolError extends Error {
  constructor(type, message, details = {}) {
    super(message);
    this.name = 'RepositoryToolError';
    this.type = type;
    this.details = details;
  }
}

export function commandFailure(context, result) {
  const details =
    result.stderr.trim() || result.stdout.trim() || 'No command output.';
  return new RepositoryToolError(
    'COMMAND_FAILED',
    `${context} (exit code ${result.exitCode ?? 'unknown'}): ${details}`,
    { result }
  );
}
