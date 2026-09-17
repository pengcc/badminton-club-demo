import { RepositoryToolError } from '../shared/repository-tool-error.mjs';
import { pollForVerifiedMerge } from './actions.mjs';
import { renderMergePrReport } from './final-report.mjs';
import { assertMergeReady, evaluateRequiredChecks } from './validation.mjs';

function showPullRequestMetadata(output, pr) {
  output.step('Pull request metadata');
  output.info(`Number: ${pr.number}`);
  output.info(`Title: ${pr.title}`);
  output.info(`URL: ${pr.url}`);
  output.info(`Head branch: ${pr.headRefName}`);
  output.info(`Head SHA/OID: ${pr.headRefOid}`);
  output.info(`Base branch: ${pr.baseRefName}`);
  output.info(`State: ${pr.state}`);
  output.info(`Draft: ${pr.isDraft ? 'yes' : 'no'}`);
  output.info(`Review decision: ${pr.reviewDecision || 'none'}`);
  output.info(`Mergeability: ${pr.mergeable}`);
}

async function validateMergeCandidate({
  gh,
  repo,
  prNumber,
  defaultBranch,
  expected,
}) {
  const pr = await gh.viewPullRequest(repo, prNumber);
  assertMergeReady(pr, {
    branch: expected?.headRefName || pr.headRefName,
    defaultBranch,
    headSha: expected?.headRefOid || pr.headRefOid,
  });
  const checks = await gh.requiredChecks(repo, pr.number);
  evaluateRequiredChecks(checks, { prNumber: pr.number });
  return pr;
}

export async function runMergePrFlow({
  git,
  gh,
  output,
  options,
  env = process.env,
  sleep,
}) {
  const defaultBranch = env.DEFAULT_BRANCH || 'main';
  await git.repoRoot();
  await git.origin();
  if (!(await gh.authReady())) {
    throw new RepositoryToolError(
      'GH_AUTH_FAILED',
      'GitHub CLI authentication is required before pull request merge actions.'
    );
  }

  const repo = await gh.repoName();
  const displayedPr = await gh.viewPullRequest(repo, options.prNumber);
  showPullRequestMetadata(output, displayedPr);
  output.info('Merge mode: immediate');

  await validateMergeCandidate({
    gh,
    repo,
    prNumber: displayedPr.number,
    defaultBranch,
  });

  const finalPr = await validateMergeCandidate({
    gh,
    repo,
    prNumber: displayedPr.number,
    defaultBranch,
  });
  await gh.merge(repo, finalPr.number, {
    headSha: finalPr.headRefOid,
  });

  const verifiedPr = await pollForVerifiedMerge({
    gh,
    repo,
    prNumber: finalPr.number,
    defaultBranch,
    attempts: Number(env.PUBLISH_MERGE_POLL_ATTEMPTS || 12),
    intervalMs: Number(env.PUBLISH_MERGE_POLL_INTERVAL_MS || 5000),
    sleep,
  });
  const report = {
    repository: repo,
    prNumber: verifiedPr.number,
    prUrl: verifiedPr.url || displayedPr.url,
    baseBranch: defaultBranch,
    observedPrHead: verifiedPr.headRefOid,
    observedPrState: verifiedPr.state,
    mergeStatus: 'verified merged',
    mergeMode: 'immediate',
  };
  renderMergePrReport(output, report);
  return { status: 'merged', report };
}
