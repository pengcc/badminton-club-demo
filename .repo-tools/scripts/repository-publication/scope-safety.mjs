import { assertSecretSafeScope } from '../repository-safety/secret-safety.mjs';
import { RepositoryToolError } from '../shared/repository-tool-error.mjs';
import { assertFeatureBranchCheckedOut } from './branch-safety.mjs';
import { buildScopeSummary, compareScopeSummaries } from './scope-summary.mjs';

export async function captureHeadFingerprint(git) {
  const head = await git.head();
  return { head, tree: await git.tree(head) };
}

export async function assertHeadFingerprint(git, expected, message) {
  const current = await captureHeadFingerprint(git);
  if (current.head !== expected.head || current.tree !== expected.tree) {
    throw new RepositoryToolError('SCOPE_DRIFT', message);
  }
}

export async function collectExactPublishScope({
  git,
  state,
  branch,
  defaultBranch,
  showDiff = false,
  preliminaryScope,
}) {
  await assertFeatureBranchCheckedOut({
    git,
    defaultBranch,
    expectedBranch: branch,
    operation: 'Exact-scope verification',
  });
  if (await git.status())
    throw new RepositoryToolError(
      'SCOPE_DRIFT',
      'Worktree changed during scope verification. No files were pushed.'
    );
  const head = await captureHeadFingerprint(git);
  const range = `${state.compareRef}...${head.head}`;
  const scope = buildScopeSummary({
    branch,
    nameStatus: await git.diff(['--name-status', '--no-renames', range]),
    numstat: await git.diff(['--numstat', '--no-renames', range]),
    diff: showDiff ? await git.diff([range]) : '',
  });
  const comparison = compareScopeSummaries(preliminaryScope, scope);
  if (!comparison.matches)
    throw new RepositoryToolError(
      'SCOPE_DRIFT',
      `Exact publish scope differs from the inspected scope. No files were pushed.\n${comparison.differences.join('\n')}`
    );
  return { scope, head };
}

export async function assertSecretSafePublishScope({
  git,
  state,
  confirmed,
  output,
  acknowledgeSecretReview = false,
}) {
  output?.step('Secret safety guard');
  return assertSecretSafeScope({
    files: confirmed.scope.files,
    diff: await git.diff([`${state.compareRef}...${confirmed.head.head}`]),
    output,
    acknowledgeSecretReview,
  });
}
