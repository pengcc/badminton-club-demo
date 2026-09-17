import { readFile } from 'node:fs/promises';
import { RepositoryToolError } from '../shared/repository-tool-error.mjs';
import {
  assertFeatureBranchCheckedOut,
  assertPullRequestMutationBranch,
  isDefaultBranch,
} from './branch-safety.mjs';
import { renderPrOpenOrUpdateReport } from './final-report.mjs';
import {
  assertHeadFingerprint,
  assertSecretSafePublishScope,
  captureHeadFingerprint,
  collectExactPublishScope,
} from './scope-safety.mjs';
import { renderScopeSummary } from './scope-summary.mjs';
import { detectPublishState, findOpenBranchPr } from './state.mjs';

export function buildPrReviewLink({ action, prUrl, verifiedHead }) {
  if (action === 'updated') {
    return {
      label: 'Latest commit changes',
      url: `${prUrl}/changes/${verifiedHead}`,
    };
  }
  if (action === 'created' || action === 'unchanged') {
    return {
      label: 'PR changes',
      url: `${prUrl}/files`,
    };
  }
  throw new RepositoryToolError(
    'PR_ACTION_INVALID',
    `Unsupported PR action: ${action || 'unknown'}.`
  );
}

export async function runPrOpenOrUpdateFlow({
  git,
  gh,
  output,
  options,
  detectState = detectPublishState,
}) {
  const state = await detectState({
    git,
    gh,
    output,
    showDiff: options.showDiff,
  });
  const { branch, defaultBranch } = state;
  output.step('PR open-or-update preflight');
  output.info(`Current branch: ${branch}`);
  if (state.hasUncommitted)
    throw new RepositoryToolError(
      'UNSAFE_BRANCH_STATE',
      'Worktree must be clean before push or pull request actions. Commit the approved implementation, then rerun.'
    );
  if (branch === 'HEAD' || isDefaultBranch(branch, defaultBranch))
    throw new RepositoryToolError(
      'UNSAFE_BRANCH_STATE',
      `PR publishing from ${branch} is blocked. Use a feature branch.`
    );
  if (!state.defaultFresh)
    throw new RepositoryToolError(
      'UNSAFE_BRANCH_STATE',
      `Current HEAD does not include origin/${defaultBranch}. Return the same delivery to the execute-plan Delivery Freshness Boundary, integrate current default truth without rewriting history, and revalidate before publishing.`
    );
  if (!state.ghReady)
    throw new RepositoryToolError(
      'GH_AUTH_FAILED',
      'GitHub CLI authentication is required before publication.'
    );
  let existingPr = await findOpenBranchPr(
    gh,
    state.repo,
    branch,
    defaultBranch
  );
  if (!(await git.logRange(`origin/${defaultBranch}..HEAD`)) && !existingPr) {
    output.success('Nothing to publish.');
    return { status: 'noop' };
  }
  // A body is supplied deliberately, never generated from a second lifecycle record.
  const body = options.bodyFile
    ? await readFile(options.bodyFile, 'utf8')
    : undefined;
  renderScopeSummary(state.scope, output, {
    showDiff: options.showDiff,
    heading: 'Publish scope',
  });
  const captured = {
    scope: state.scope,
    head: await captureHeadFingerprint(git),
  };
  await assertSecretSafePublishScope({
    git,
    state,
    confirmed: captured,
    output,
    acknowledgeSecretReview: options.acknowledgeSecretReview,
  });
  const confirmed = await collectExactPublishScope({
    git,
    state,
    output,
    branch,
    defaultBranch,
    showDiff: options.showDiff,
    preliminaryScope: captured.scope,
  });
  await assertHeadFingerprint(
    git,
    captured.head,
    'Branch history changed during scope verification. No files were pushed. Re-run the command.'
  );
  const expectedPushHead = confirmed.head;
  await git.checkWhitespace([`${state.compareRef}...${expectedPushHead.head}`]);
  if (await git.status())
    throw new RepositoryToolError(
      'SCOPE_DRIFT',
      'Worktree changed during scope verification. No files were pushed.'
    );
  await assertFeatureBranchCheckedOut({
    git,
    defaultBranch,
    expectedBranch: branch,
    operation: 'Push',
  });
  await assertHeadFingerprint(
    git,
    expectedPushHead,
    'Branch history changed before push. Re-run the command.'
  );
  await git.fetchDefault(defaultBranch);
  if (!(await git.includesDefault(`origin/${defaultBranch}`)))
    throw new RepositoryToolError(
      'UNSAFE_BRANCH_STATE',
      'Remote default advanced beyond this delivery. Return to execute-plan for integration and validation.'
    );
  await assertHeadFingerprint(
    git,
    expectedPushHead,
    'Branch history changed before push. Re-run the command.'
  );
  if (await git.status())
    throw new RepositoryToolError(
      'SCOPE_DRIFT',
      'Worktree changed before push. No files were pushed.'
    );
  await git.push(branch, expectedPushHead.head);
  const headSha = expectedPushHead.head;
  // Re-read before PR mutation: a concurrent PR must be reused, never duplicated.
  const currentPr = await findOpenBranchPr(
    gh,
    state.repo,
    branch,
    defaultBranch
  );
  if (existingPr && (!currentPr || currentPr.number !== existingPr.number))
    throw new RepositoryToolError(
      'PR_STATE_CHANGED',
      'Branch pushed, but the existing PR changed or closed. Inspect the remote state before retrying.'
    );
  existingPr = currentPr;
  let pr;
  let action;
  let observation = null;
  await assertPullRequestMutationBranch({
    git,
    branch,
    defaultBranch,
    operation: 'Pull request create or update',
  });

  if (existingPr) {
    let updated = state.hasUnpushed;
    if (options.prTitleExplicit && options.prTitle !== existingPr.title) {
      await gh.updatePullRequestTitle(
        state.repo,
        existingPr.number,
        options.prTitle
      );
      updated = true;
    }
    if (body !== undefined) {
      await gh.updatePullRequestBody(state.repo, existingPr.number, body);
      updated = true;
    }
    try {
      pr = await gh.viewPullRequest(state.repo, existingPr.number);
    } catch (error) {
      pr = existingPr;
      observation = `GitHub's immediate PR read was unavailable after publication: ${error.message}`;
    }
    action = updated ? 'updated' : 'unchanged';
  } else {
    const title = options.prTitle || (await git.latestSubject());
    const createdPrUrl = await gh.createPullRequest(state.repo, {
      base: defaultBranch,
      head: branch,
      title,
      body: body ?? '',
    });
    const createdPrNumber =
      Number(createdPrUrl.match(/\/pull\/(\d+)(?:\/|$)/)?.[1]) || null;
    try {
      pr = await gh.viewPullRequest(state.repo, branch);
    } catch (error) {
      pr = {
        number: createdPrNumber,
        url: createdPrUrl,
        headRefOid: null,
      };
      observation = `GitHub's immediate PR read was unavailable after publication: ${error.message}`;
    }
    action = 'created';
  }
  if (!observation && pr.headRefOid !== headSha) {
    observation = `GitHub's immediate PR read showed ${pr.headRefOid || 'an unknown head'}; publication completed for pushed head ${headSha}.`;
  }
  const report = {
    prNumber: pr.number,
    prUrl: pr.url,
    prChangesUrl: `${pr.url}/files`,
    latestCommitChangesUrl:
      pr.headRefOid === headSha ? `${pr.url}/changes/${headSha}` : null,
    latestHeadCommit: pr.headRefOid === headSha ? null : headSha,
    reviewLink: buildPrReviewLink({
      action,
      prUrl: pr.url,
      verifiedHead: headSha,
    }),
    nextStep: 'Implementation Review',
    branch,
    action,
    expectedHead: headSha,
    defaultBranch,
    observation,
  };
  renderPrOpenOrUpdateReport(output, report);
  return { status: 'published', report };
}
