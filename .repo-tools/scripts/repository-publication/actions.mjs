import { RepositoryToolError } from '../shared/repository-tool-error.mjs';

export async function pollForVerifiedMerge({
  gh,
  repo,
  prNumber,
  defaultBranch,
  attempts = 12,
  intervalMs = 5000,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const pr = await gh.viewPullRequest(repo, prNumber);
    if (pr.mergedAt && pr.baseRefName === defaultBranch) return pr;
    if (pr.state !== 'OPEN') {
      throw new RepositoryToolError(
        'POLICY_BLOCKED',
        `PR #${pr.number} is ${pr.state} without verified merge into ${defaultBranch}.`
      );
    }
    if (attempt < attempts) await sleep(intervalMs);
  }
  throw new RepositoryToolError(
    'CHECKS_PENDING',
    `PR #${prNumber} was not verified merged after ${attempts} checks.`
  );
}
