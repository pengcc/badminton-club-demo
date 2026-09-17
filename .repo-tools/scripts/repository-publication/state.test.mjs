import assert from 'node:assert/strict';
import test from 'node:test';
import { detectPublishState, findOpenBranchPr } from './state.mjs';

function clients() {
  const calls = [];
  const git = {
    repoRoot: async () => '/repo',
    branch: async () => 'feature/current',
    origin: async () => 'git@github.com:owner/repo.git',
    defaultBranch: async () => 'trunk',
    fetchDefault: async (branch) => calls.push(['fetch', branch]),
    includesDefault: async () => true,
    status: async () => '',
    upstream: async () => 'origin/feature/current',
    verifyRef: async () => true,
    ref: async () => 'default-sha',
    head: async () => 'branch-sha',
    remoteHead: async () => 'branch-sha',
    diff: async (args) => {
      calls.push(args);
      return args.includes('--name-status')
        ? 'M\tfile.md'
        : args.includes('--numstat')
          ? '1\t0\tfile.md'
          : '';
    },
  };
  const gh = {
    authReady: async () => true,
    repoName: async (origin) => {
      calls.push(['repo', origin]);
      return 'owner/repo';
    },
  };
  return { git, gh, calls };
}

test('publication resolves origin default and scans the complete PR delta even when already pushed', async () => {
  const { git, gh, calls } = clients();
  const state = await detectPublishState({ git, gh });
  assert.equal(state.defaultBranch, 'trunk');
  assert.equal(state.hasUnpushed, false);
  assert.equal(state.scope.files.length, 1);
  assert.ok(calls.some((args) => args.includes('default-sha...HEAD')));
  assert.deepEqual(calls[0], ['fetch', 'trunk']);
  assert.deepEqual(calls.at(-1), ['repo', 'git@github.com:owner/repo.git']);
});

test('unrelated upstream and detached state fail closed', async () => {
  for (const change of [
    { upstream: async () => 'other/branch' },
    { branch: async () => 'HEAD' },
  ]) {
    const { git, gh } = clients();
    await assert.rejects(
      detectPublishState({ git: { ...git, ...change }, gh }),
      { type: 'UNSAFE_BRANCH_STATE' }
    );
  }
});

test('PR discovery detects ambiguity and mismatched state/base/head', async () => {
  const gh = { listPullRequests: async () => [{ number: 1 }, { number: 2 }] };
  await assert.rejects(
    findOpenBranchPr(gh, 'owner/repo', 'feature/current', 'trunk'),
    { type: 'AMBIGUOUS_PR' }
  );
  gh.listPullRequests = async () => [{ number: 1 }];
  for (const delta of [
    { state: 'CLOSED' },
    { baseRefName: 'other' },
    { headRefName: 'other' },
  ]) {
    gh.viewPullRequest = async () => ({
      state: 'OPEN',
      baseRefName: 'trunk',
      headRefName: 'feature/current',
      ...delta,
    });
    await assert.rejects(
      findOpenBranchPr(gh, 'owner/repo', 'feature/current', 'trunk'),
      { type: 'PR_STATE_CHANGED' }
    );
  }
});
