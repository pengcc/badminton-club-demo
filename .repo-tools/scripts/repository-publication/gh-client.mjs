import {
  commandFailure,
  RepositoryToolError,
} from '../shared/repository-tool-error.mjs';

function parseJson(result, context) {
  if (!result.ok) throw commandFailure(context, result);
  try {
    return JSON.parse(result.stdout || 'null');
  } catch (error) {
    throw new RepositoryToolError(
      'COMMAND_FAILED',
      `${context}: invalid JSON output`,
      {
        stderr: result.stderr,
        cause: error,
      }
    );
  }
}

export function createGhClient(commandRunner, cwd) {
  const run = (args) => commandRunner.run('gh', args, { cwd });

  return {
    run,
    async authReady() {
      return (await run(['auth', 'status'])).ok;
    },
    async repoName(origin) {
      const result = await run([
        'repo',
        'view',
        ...(origin ? [origin] : []),
        '--json',
        'nameWithOwner',
      ]);
      return parseJson(result, 'Could not determine GitHub repository')
        .nameWithOwner;
    },
    async listPullRequests(repo, args = []) {
      const result = await run([
        'pr',
        'list',
        '--repo',
        repo,
        ...args,
        '--json',
        'number,title,headRefName,baseRefName,url,state',
      ]);
      return parseJson(result, 'Could not list pull requests');
    },
    async viewPullRequest(repo, ref) {
      const result = await run([
        'pr',
        'view',
        String(ref),
        '--repo',
        repo,
        '--json',
        'number,url,state,baseRefName,headRefName,isDraft,mergeable,mergeStateStatus,headRefOid,mergedAt,reviewDecision,title',
      ]);
      return parseJson(result, `Could not read pull request ${ref}`);
    },
    async createPullRequest(repo, { base, head, title, body }) {
      const result = await run([
        'pr',
        'create',
        '--repo',
        repo,
        '--base',
        base,
        '--head',
        head,
        '--title',
        title,
        '--body',
        body,
      ]);
      if (!result.ok)
        throw commandFailure('Could not create pull request', result);
      return result.stdout.trim();
    },
    async updatePullRequestTitle(repo, number, title) {
      const result = await run([
        'pr',
        'edit',
        String(number),
        '--repo',
        repo,
        '--title',
        title,
      ]);
      if (!result.ok)
        throw commandFailure(
          `Could not update title for PR #${number}`,
          result
        );
    },
    async updatePullRequestBody(repo, number, body) {
      const result = await run([
        'pr',
        'edit',
        String(number),
        '--repo',
        repo,
        '--body',
        body,
      ]);
      if (!result.ok)
        throw commandFailure(`Could not update body for PR #${number}`, result);
    },
    async requiredChecks(repo, number) {
      const result = await run([
        'pr',
        'checks',
        String(number),
        '--repo',
        repo,
        '--required',
        '--json',
        'bucket,name,state',
      ]);
      const normalizedError = result.stderr.toLowerCase();
      if (
        normalizedError.includes('no required checks') ||
        normalizedError.includes('no checks reported')
      ) {
        return [];
      }
      if (!result.ok) {
        throw commandFailure(
          `Could not verify required checks for PR #${number}`,
          result
        );
      }
      if (!result.stdout.trim())
        throw commandFailure(
          `Could not verify required checks for PR #${number}`,
          result
        );
      try {
        return JSON.parse(result.stdout);
      } catch {
        throw commandFailure(
          `Could not parse required checks for PR #${number}`,
          result
        );
      }
    },
    async merge(repo, number, { headSha }) {
      const args = [
        'pr',
        'merge',
        String(number),
        '--repo',
        repo,
        '--squash',
        '--match-head-commit',
        headSha,
      ];
      const result = await run(args);
      if (!result.ok)
        throw commandFailure(`GitHub rejected merge for PR #${number}`, result);
    },
  };
}
