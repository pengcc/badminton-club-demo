import { RepositoryToolError } from '../shared/repository-tool-error.mjs';

export function isDefaultBranch(branch, defaultBranch) {
  return ['main', 'master', defaultBranch].includes(branch);
}

export async function assertFeatureBranchCheckedOut({
  git,
  defaultBranch,
  expectedBranch = '',
  operation,
}) {
  const actualBranch = await git.branch();
  if (isDefaultBranch(actualBranch, defaultBranch)) {
    throw new RepositoryToolError(
      'DEFAULT_BRANCH_MUTATION_BLOCKED',
      `${operation} is blocked while ${actualBranch} is checked out. Switch to a feature branch first.`,
      { actualBranch, defaultBranch, operation }
    );
  }
  if (expectedBranch && actualBranch !== expectedBranch) {
    throw new RepositoryToolError(
      'STALE_BRANCH_CONTEXT',
      `${operation} expected ${expectedBranch}, but ${actualBranch} is checked out.`,
      { actualBranch, expectedBranch, defaultBranch, operation }
    );
  }
  return actualBranch;
}

export async function assertPullRequestMutationBranch({
  git,
  branch,
  defaultBranch,
  operation = 'Pull request mutation',
}) {
  if (isDefaultBranch(branch, defaultBranch)) {
    throw new RepositoryToolError(
      'DEFAULT_BRANCH_MUTATION_BLOCKED',
      `${operation} cannot use ${branch} as the pull request head branch.`,
      { branch, defaultBranch, operation }
    );
  }
  return assertFeatureBranchCheckedOut({
    git,
    defaultBranch,
    expectedBranch: branch,
    operation,
  });
}
