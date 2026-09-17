import { RepositoryToolError } from '../shared/repository-tool-error.mjs';

export function isMergeReadinessPending(pr) {
  return pr.mergeable === 'UNKNOWN' || pr.mergeStateStatus === 'UNKNOWN';
}

function normalizedCheckField(value, fallback) {
  return (
    String(value ?? '')
      .replace(/[\u0000-\u001f\u007f]+/gu, ' ')
      .trim() || fallback
  );
}

export function evaluateRequiredChecks(checks, { prNumber = '' } = {}) {
  const retryCommand = `pnpm pr:merge ${prNumber || '<PR>'}`;
  const bucketFor = (check) =>
    String(check.bucket ?? '')
      .trim()
      .toLowerCase();
  const actionableCheck = checks.find(
    (check) => !['pass', 'pending'].includes(bucketFor(check))
  );
  if (actionableCheck) {
    const bucket = bucketFor(actionableCheck);
    const name = normalizedCheckField(
      actionableCheck.name,
      'Unnamed required check'
    );
    const state = normalizedCheckField(actionableCheck.state, 'unknown');
    if (['fail', 'cancel', 'skipping'].includes(bucket)) {
      const outcome =
        bucket === 'fail'
          ? 'failed'
          : bucket === 'cancel'
            ? 'was cancelled'
            : 'was skipped';
      const action =
        bucket === 'fail'
          ? `Fix or rerun "${name}" and confirm it passes before retrying merge.`
          : `Rerun "${name}" and confirm it passes before retrying merge.`;
      throw new RepositoryToolError(
        'CHECKS_FAILED',
        `Required check "${name}" ${outcome} (state: ${state}). ${action}`
      );
    }
    throw new RepositoryToolError(
      'CHECKS_FAILED',
      `Required check "${name}" has an unknown result (bucket: ${bucket || 'missing'}, state: ${state}). Inspect the current check before retrying merge.`
    );
  }

  const pendingCheck = checks.find((check) => bucketFor(check) === 'pending');
  if (pendingCheck) {
    const name = normalizedCheckField(
      pendingCheck.name,
      'Unnamed required check'
    );
    const state = normalizedCheckField(pendingCheck.state, 'unknown');
    throw new RepositoryToolError(
      'CHECKS_PENDING',
      `Required check "${name}" is pending (state: ${state}); wait for it to complete, then rerun ${retryCommand}.`
    );
  }
}

export function assertMergeReady(pr, { branch, defaultBranch, headSha }) {
  if (pr.state !== 'OPEN')
    throw new RepositoryToolError(
      'POLICY_BLOCKED',
      `PR #${pr.number} is not open; inspect its current state before retrying merge.`
    );
  if (pr.baseRefName !== defaultBranch) {
    throw new RepositoryToolError(
      'POLICY_BLOCKED',
      `PR targets ${pr.baseRefName}, not ${defaultBranch}; correct the base branch and revalidate before retrying merge.`
    );
  }
  if (pr.headRefName !== branch) {
    throw new RepositoryToolError(
      'POLICY_BLOCKED',
      `PR head ${pr.headRefName} does not match ${branch}; inspect the intended feature branch before retrying merge.`
    );
  }
  if (pr.headRefOid !== headSha) {
    throw new RepositoryToolError(
      'POLICY_BLOCKED',
      'PR head commit does not match the expected head; review the current head before retrying merge.',
      { expectedHead: headSha, actualHead: pr.headRefOid }
    );
  }
  if (pr.isDraft)
    throw new RepositoryToolError(
      'POLICY_BLOCKED',
      'Draft PRs cannot be merged; mark the PR ready and complete review before retrying merge.'
    );
  if (pr.reviewDecision === 'CHANGES_REQUESTED') {
    throw new RepositoryToolError(
      'POLICY_BLOCKED',
      'Pull request review requests changes; resolve them and obtain current-head approval before retrying merge.'
    );
  }
  if (pr.mergeable === 'CONFLICTING')
    throw new RepositoryToolError(
      'POLICY_BLOCKED',
      'PR has conflicts; resolve them on the feature branch, then revalidate and review the current head before retrying merge.'
    );
  if (isMergeReadinessPending(pr)) {
    throw new RepositoryToolError(
      'POLICY_BLOCKED',
      'GitHub has not resolved merge readiness; wait for the current result or inspect the PR before retrying merge.'
    );
  }
}
