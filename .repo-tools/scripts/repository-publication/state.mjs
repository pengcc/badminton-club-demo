import { RepositoryToolError } from '../shared/repository-tool-error.mjs';
import { buildScopeSummary } from './scope-summary.mjs';

export async function findOpenBranchPr(gh, repo, branch, defaultBranch) {
  const prs = await gh.listPullRequests(repo, [
    '--state',
    'open',
    '--head',
    branch,
    '--limit',
    '2',
  ]);
  if (prs.length > 1)
    throw new RepositoryToolError(
      'AMBIGUOUS_PR',
      'More than one open PR exists for this branch. No PR was mutated.'
    );
  if (!prs.length) return null;
  const pr = await gh.viewPullRequest(repo, prs[0].number);
  if (
    pr.state !== 'OPEN' ||
    pr.headRefName !== branch ||
    pr.baseRefName !== defaultBranch
  ) {
    throw new RepositoryToolError(
      'PR_STATE_CHANGED',
      'The branch PR no longer matches the expected open head/base.'
    );
  }
  return pr;
}

export async function detectPublishState({ git, gh, showDiff = false }) {
  const root = await git.repoRoot();
  const branch = await git.branch();
  if (branch === 'HEAD')
    throw new RepositoryToolError(
      'UNSAFE_BRANCH_STATE',
      'Detached HEAD is unsupported.'
    );
  const origin = await git.origin();
  const defaultBranch = await git.defaultBranch();
  await git.fetchDefault(defaultBranch);
  const defaultRef = `origin/${defaultBranch}`;
  if (!(await git.verifyRef(defaultRef)))
    throw new RepositoryToolError(
      'UNSAFE_BRANCH_STATE',
      `Comparison ref not found: ${defaultRef}`
    );
  const defaultFresh = await git.includesDefault(defaultRef);
  const hasUncommitted = Boolean(await git.status());
  const upstream = await git.upstream(branch);
  if (upstream && upstream !== defaultRef && upstream !== `origin/${branch}`) {
    throw new RepositoryToolError(
      'UNSAFE_BRANCH_STATE',
      'Feature branch has an unrelated upstream. Inspect branch identity before publishing.'
    );
  }
  const hasUnpushed = (await git.remoteHead(branch)) !== (await git.head());
  // Scan the complete committed PR delta, including already-pushed changes.
  const compareRef = await git.ref(defaultRef);
  const scope = buildScopeSummary({
    branch,
    nameStatus: await git.diff([
      '--name-status',
      '--no-renames',
      `${compareRef}...HEAD`,
    ]),
    numstat: await git.diff([
      '--numstat',
      '--no-renames',
      `${compareRef}...HEAD`,
    ]),
    diff: showDiff ? await git.diff([`${compareRef}...HEAD`]) : '',
  });
  const ghReady = await gh.authReady();
  const repo = ghReady ? await gh.repoName(origin) : '';
  return {
    root,
    repo,
    branch,
    defaultBranch,
    defaultFresh,
    compareRef,
    ghReady,
    hasUncommitted,
    hasUnpushed,
    scope,
  };
}
