import assert from 'node:assert/strict';
import test from 'node:test';
import { createGhClient } from './gh-client.mjs';
import { RepositoryToolError } from '../shared/repository-tool-error.mjs';
import { parseCliOptions, usage } from './cli-options.mjs';
import { runPrOpenOrUpdateFlow } from './pr-open-or-update-flow.mjs';
import { runMergePrFlow } from './merge-pr-flow.mjs';
import { buildScopeSummary } from './scope-summary.mjs';
import { assertMergeReady, evaluateRequiredChecks } from './validation.mjs';

const output = {
  step() {},
  info() {},
  warning() {},
  danger() {},
  success() {},
  skipped() {},
  command() {},
};

const REVIEWED_HEAD = 'a'.repeat(40);
const DEFAULT_HEAD = 'b'.repeat(40);

function capturingOutput() {
  const steps = [];
  const commands = [];
  const infos = [];
  const skippedMessages = [];
  return {
    ...output,
    steps,
    commands,
    infos,
    skippedMessages,
    step(label) {
      steps.push(label);
    },
    info(value) {
      infos.push(value);
    },
    command(label, command) {
      commands.push({ label, command });
    },
    skipped(value) {
      skippedMessages.push(value);
    },
  };
}

function reviewLinkLines(reportOutput) {
  return reportOutput.infos.filter((line) =>
    /^(PR changes|Latest commit changes): /.test(line)
  );
}

function scope(
  branch = 'feature/test',
  { nameStatus = 'M\tfile.md', numstat = '1\t0\tfile.md' } = {}
) {
  return buildScopeSummary({
    branch,
    nameStatus,
    numstat,
  });
}

function cleanState(overrides = {}) {
  const branch = overrides.branch || 'feature/test';
  return {
    repo: 'owner/repo',
    branch,
    defaultBranch: 'main',
    defaultFresh: true,
    compareRef: 'origin/main',
    ghReady: true,
    hasUncommitted: false,
    hasUnpushed: true,
    currentBranchPr: null,
    scope: scope(branch),
    ...overrides,
  };
}

function clients({
  existingPr = null,
  prHeadOverride = '',
  initialBranch = 'feature/test',
  finalWorktreeStatus = '',
  postMutationViewError = null,
} = {}) {
  const calls = {
    ask: 0,
    stage: 0,
    commit: 0,
    push: 0,
    create: 0,
    comment: 0,
    titleUpdate: 0,
    bodyUpdate: 0,
    whitespace: [],
    merge: 0,
    switchCreate: 0,
    listHeads: [],
    order: [],
    createdBody: '',
  };
  let reads = 0;
  const pr = {
    number: 17,
    url: 'https://github.com/owner/repo/pull/17',
    title: 'Title',
    headRefOid: prHeadOverride || 'abc123',
    state: 'OPEN',
    baseRefName: 'main',
    headRefName: initialBranch,
  };
  const git = {
    repoRoot: async () => '/repo',
    origin: async () => 'git@github.com:owner/repo.git',
    branch: async () => initialBranch,
    status: async () => finalWorktreeStatus,
    logRange: async () => 'abc123 change',
    latestSubject: async () => 'chore: change',
    fetchDefault: async () => {},
    includesDefault: async () => true,
    head: async () => 'abc123',
    tree: async () => 'tree123',
    diff: async (args) =>
      args.includes('--name-status')
        ? 'M\tfile.md'
        : args.includes('--numstat')
          ? '1\t0\tfile.md'
          : 'diff --git a/file.md b/file.md\n+++ b/file.md\n+safe',
    checkWhitespace: async (args) => {
      calls.whitespace.push(args);
    },
    push: async (_branch, head) => {
      calls.push++;
      calls.pushedHead = head;
    },
  };
  const gh = {
    authReady: async () => true,
    repoName: async () => 'owner/repo',
    listPullRequests: async (_repo, args) => {
      calls.listHeads.push(args[args.indexOf('--head') + 1]);
      return existingPr || calls.create ? [{ number: 17 }] : [];
    },
    viewPullRequest: async () => {
      reads++;
      if (
        postMutationViewError &&
        (calls.create || calls.titleUpdate || reads > 2)
      )
        throw postMutationViewError;
      return { ...pr };
    },
    createPullRequest: async (_repo, { body }) => {
      calls.create++;
      calls.createdBody = body;
      return pr.url;
    },
    updatePullRequestTitle: async () => {
      calls.titleUpdate++;
    },
    updatePullRequestBody: async () => {
      calls.bodyUpdate++;
    },
    merge: async () => {
      calls.merge++;
    },
  };
  return { calls, git, gh };
}

const options = {
  showDiff: false,
  acknowledgeSecretReview: false,
  prTitle: 'Title',
  prTitleExplicit: false,
};

function assertNoPublicationMutation(calls) {
  assert.equal(calls.switchCreate, 0);
  assert.equal(calls.stage, 0);
  assert.equal(calls.commit, 0);
  assert.equal(calls.push, 0);
  assert.equal(calls.create, 0);
  assert.equal(calls.comment, 0);
}

function setExactScope(git, { nameStatus, numstat }) {
  const originalDiff = git.diff;
  git.diff = async (args) => {
    if (args.includes('--name-status')) return nameStatus;
    if (args.includes('--numstat')) return numstat;
    if (args.includes('--binary')) return 'binary-diff';
    return originalDiff(args);
  };
}

test('pr-open-or-update rejects a dirty worktree before mutation', async () => {
  const { calls, git, gh } = clients();

  await assert.rejects(
    runPrOpenOrUpdateFlow({
      git,
      gh,
      output,
      options,
      detectState: async () => cleanState({ hasUncommitted: true }),
    }),
    (error) =>
      error.type === 'UNSAFE_BRANCH_STATE' &&
      error.message.includes('Worktree must be clean')
  );

  assert.equal(calls.ask, 0);
  assert.equal(calls.stage, 0);
  assert.equal(calls.commit, 0);
  assert.equal(calls.push, 0);
  assert.equal(calls.create, 0);
  assert.equal(calls.comment, 0);
  assert.equal(calls.merge, 0);
});

test('pr-open-or-update returns a stale delivery to execution synchronization before mutation', async () => {
  const { calls, git, gh } = clients();

  await assert.rejects(
    runPrOpenOrUpdateFlow({
      git,
      gh,
      output,
      options,
      detectState: async () => cleanState({ defaultFresh: false }),
    }),
    (error) =>
      error.type === 'UNSAFE_BRANCH_STATE' &&
      error.message.includes('execute-plan Delivery Freshness Boundary') &&
      error.message.includes('without rewriting history')
  );

  assertNoPublicationMutation(calls);
});

test('created PR exposes one structured PR changes reviewLink that the CLI renders for agent consumption', async () => {
  const { calls, git, gh } = clients();
  const reportOutput = capturingOutput();

  const result = await runPrOpenOrUpdateFlow({
    git,
    gh,
    output: reportOutput,
    options,
    detectState: async () => cleanState(),
  });

  assert.equal(result.status, 'published');
  assert.equal(result.report.action, 'created');
  assert.deepEqual(result.report.reviewLink, {
    label: 'PR changes',
    url: 'https://github.com/owner/repo/pull/17/files',
  });
  assert.deepEqual(reviewLinkLines(reportOutput), [
    `${result.report.reviewLink.label}: ${result.report.reviewLink.url}`,
  ]);
  assert.equal(result.report.nextStep, 'Implementation Review');
  assert.ok(reportOutput.steps.includes('PR open-or-update report'));
  assert.match(
    reportOutput.infos.join('\n'),
    /Next workflow: Implementation Review/
  );
  assert.deepEqual(reportOutput.commands, []);
  assert.equal(calls.ask, 0);
  assert.equal(calls.stage, 0);
  assert.equal(calls.commit, 0);
  assert.equal(calls.push, 1);
  assert.equal(calls.create, 1);
  assert.equal(calls.comment, 0);
  assert.equal(calls.merge, 0);
});

test('updated PR shows one pushed-head Latest commit changes link without a generated comment', async () => {
  const { calls, git, gh } = clients({ existingPr: true });
  const reportOutput = capturingOutput();

  const result = await runPrOpenOrUpdateFlow({
    git,
    gh,
    output: reportOutput,
    options,
    detectState: async () => cleanState(),
  });

  assert.equal(result.status, 'published');
  assert.equal(result.report.action, 'updated');
  assert.deepEqual(result.report.reviewLink, {
    label: 'Latest commit changes',
    url: `https://github.com/owner/repo/pull/17/changes/${result.report.expectedHead}`,
  });
  assert.deepEqual(reviewLinkLines(reportOutput), [
    `${result.report.reviewLink.label}: ${result.report.reviewLink.url}`,
  ]);
  assert.equal(result.report.nextStep, 'Implementation Review');
  assert.match(
    reportOutput.infos.join('\n'),
    /Next workflow: Implementation Review/
  );
  assert.deepEqual(reportOutput.commands, []);
  assert.equal(calls.ask, 0);
  assert.equal(calls.stage, 0);
  assert.equal(calls.commit, 0);
  assert.equal(calls.push, 1);
  assert.equal(calls.create, 0);
  assert.equal(calls.comment, 0);
  assert.equal(calls.merge, 0);
});

test('existing PR publication survives an unavailable final read without retrying mutations', async () => {
  const { calls, git, gh } = clients({
    existingPr: true,
    postMutationViewError: new Error('temporary API failure'),
  });
  const result = await runPrOpenOrUpdateFlow({
    git,
    gh,
    output,
    options: { ...options, prTitle: 'Updated title', prTitleExplicit: true },
    detectState: async () => cleanState(),
  });
  assert.equal(result.status, 'published');
  assert.equal(result.report.prNumber, 17);
  assert.equal(result.report.prUrl, 'https://github.com/owner/repo/pull/17');
  assert.match(result.report.observation, /immediate PR read was unavailable/);
  assert.equal(calls.push, 1);
  assert.equal(calls.titleUpdate, 1);
  assert.equal(calls.create, 0);
  assert.equal(calls.comment, 0);
});

test('new PR publication uses the created URL when the final read is unavailable', async () => {
  const { calls, git, gh } = clients({
    postMutationViewError: new Error('temporary API failure'),
  });
  const result = await runPrOpenOrUpdateFlow({
    git,
    gh,
    output,
    options,
    detectState: async () => cleanState(),
  });
  assert.equal(result.status, 'published');
  assert.equal(result.report.prNumber, 17);
  assert.equal(result.report.prUrl, 'https://github.com/owner/repo/pull/17');
  assert.deepEqual(result.report.reviewLink, {
    label: 'PR changes',
    url: 'https://github.com/owner/repo/pull/17/files',
  });
  assert.match(result.report.observation, /immediate PR read was unavailable/);
  assert.equal(calls.push, 1);
  assert.equal(calls.create, 1);
  assert.equal(calls.titleUpdate, 0);
  assert.equal(calls.comment, 0);
});

test('existing PR receives an explicit title update without a generated comment', async () => {
  const { calls, git, gh } = clients({ existingPr: true });
  const result = await runPrOpenOrUpdateFlow({
    git,
    gh,
    output,
    options: { ...options, prTitle: 'Updated title', prTitleExplicit: true },
    detectState: async () => cleanState({ hasUnpushed: false }),
  });
  assert.equal(result.report.action, 'updated');
  assert.equal(calls.titleUpdate, 1);
  assert.equal(calls.comment, 0);
});

test('new PR body contains no generated validation or lifecycle record', async () => {
  const { calls, git, gh } = clients();
  await runPrOpenOrUpdateFlow({
    git,
    gh,
    output,
    options,
    detectState: async () => cleanState(),
  });
  assert.equal(calls.createdBody, '');
  assert.equal(calls.ask, 0);
});

test('unchanged PR returns one canonical PR changes review link', async () => {
  const { calls, git, gh } = clients({ existingPr: true });
  const reportOutput = capturingOutput();

  const result = await runPrOpenOrUpdateFlow({
    git,
    gh,
    output: reportOutput,
    options,
    detectState: async () => cleanState({ hasUnpushed: false }),
  });

  assert.equal(result.report.action, 'unchanged');
  assert.deepEqual(result.report.reviewLink, {
    label: 'PR changes',
    url: 'https://github.com/owner/repo/pull/17/files',
  });
  assert.deepEqual(reviewLinkLines(reportOutput), [
    `${result.report.reviewLink.label}: ${result.report.reviewLink.url}`,
  ]);
  assert.equal(calls.comment, 0);
});

test('pr-open-or-update never recovers the default branch', async () => {
  const { calls, git, gh } = clients();
  await assert.rejects(
    runPrOpenOrUpdateFlow({
      git,
      gh,
      output,
      options,
      detectState: async () => cleanState({ branch: 'main' }),
    }),
    (error) => error.type === 'UNSAFE_BRANCH_STATE'
  );
  assert.equal(calls.switchCreate, 0);
  assert.equal(calls.push, 0);
});

test('PR publication reports stale immediate PR-head observation without repeating publication', async () => {
  const { calls, git, gh } = clients({ prHeadOverride: 'unexpected' });
  const result = await runPrOpenOrUpdateFlow({
    git,
    gh,
    output,
    options,
    detectState: async () => cleanState(),
  });
  assert.equal(result.status, 'published');
  assert.match(
    result.report.observation,
    /immediate PR read showed unexpected/
  );
  assert.equal(calls.push, 1);
  assert.equal(calls.create, 1);
  assert.equal(calls.comment, 0);
  assert.equal(calls.merge, 0);
});

test('CLI accepts the separate pr-open-or-update mode', () => {
  const parsed = parseCliOptions([
    '--mode',
    'pr-open-or-update',
    '--acknowledge-secret-review',
  ]);
  assert.equal(parsed.mode, 'pr-open-or-update');
  assert.equal(parsed.acknowledgeSecretReview, true);
});

test('pr-merge accepts one PR and rejects removed lifecycle options', () => {
  const parsed = parseCliOptions(['--mode', 'pr-merge', '17']);
  assert.equal(parsed.prNumber, 17);
  for (const option of [
    '--reviewed-head',
    '--policy',
    '--auto-merge',
    '--yes',
  ]) {
    assert.throws(
      () => parseCliOptions(['--mode', 'pr-merge', '17', option]),
      new RegExp(`Unknown option: ${option}`)
    );
    assert.doesNotMatch(usage(), new RegExp(option));
  }
});

test('merge readiness permits no positive review result and preserves current safeguards', () => {
  const ready = {
    number: 17,
    state: 'OPEN',
    baseRefName: 'main',
    headRefName: 'feature/test',
    headRefOid: 'abc123',
    isDraft: false,
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    reviewDecision: '',
  };

  assert.doesNotThrow(() =>
    assertMergeReady(ready, {
      branch: 'feature/test',
      defaultBranch: 'main',
      headSha: 'abc123',
    })
  );
  const cases = [
    [{ state: 'CLOSED' }, /not open; inspect its current state/],
    [{ baseRefName: 'other' }, /correct the base branch and revalidate/],
    [{ headRefName: 'other' }, /inspect the intended feature branch/],
    [{ isDraft: true }, /mark the PR ready and complete review/],
    [
      { reviewDecision: 'CHANGES_REQUESTED' },
      /resolve them and obtain current-head approval/,
    ],
    [
      { mergeable: 'CONFLICTING' },
      /resolve them on the feature branch, then revalidate/,
    ],
    [{ mergeable: 'UNKNOWN' }, /wait for the current result or inspect the PR/],
    [
      { mergeStateStatus: 'UNKNOWN' },
      /wait for the current result or inspect the PR/,
    ],
  ];
  for (const [overrides, message] of cases) {
    assert.throws(
      () =>
        assertMergeReady(
          { ...ready, ...overrides },
          {
            branch: 'feature/test',
            defaultBranch: 'main',
            headSha: 'abc123',
          }
        ),
      message
    );
  }

  assert.throws(
    () =>
      assertMergeReady(
        { ...ready, headRefOid: 'changed' },
        {
          branch: 'feature/test',
          defaultBranch: 'main',
          headSha: 'abc123',
        }
      ),
    (error) =>
      error.type === 'POLICY_BLOCKED' &&
      error.message.includes('review the current head') &&
      error.details.expectedHead === 'abc123' &&
      error.details.actualHead === 'changed'
  );
});

test('required checks pass silently and name pending and failed checks with safe next actions', () => {
  assert.doesNotThrow(() =>
    evaluateRequiredChecks([
      { bucket: 'pass', name: 'repository-validation', state: 'SUCCESS' },
    ])
  );
  assert.throws(
    () =>
      evaluateRequiredChecks([
        { bucket: 'pending', name: 'repository-validation', state: 'QUEUED' },
      ]),
    (error) =>
      error.type === 'CHECKS_PENDING' &&
      error.message.includes('"repository-validation" is pending') &&
      error.message.includes('wait for it to complete') &&
      error.message.includes('pnpm pr:merge <PR>')
  );
  assert.throws(
    () =>
      evaluateRequiredChecks([
        { bucket: 'fail', name: 'repository-validation', state: 'FAILURE' },
      ]),
    (error) =>
      error.type === 'CHECKS_FAILED' &&
      error.message.includes('"repository-validation" failed') &&
      error.message.includes('Fix or rerun "repository-validation"')
  );
  assert.throws(
    () =>
      evaluateRequiredChecks([
        { bucket: 'mystery', name: 'repository-validation', state: 'ODD' },
      ]),
    (error) =>
      error.type === 'CHECKS_FAILED' &&
      error.message.includes('"repository-validation"') &&
      error.message.includes('unknown result') &&
      error.message.includes('Inspect the current check')
  );
});

test('cancelled and skipped required checks remain named and fail closed', () => {
  for (const [bucket, outcome] of [
    ['cancel', 'was cancelled'],
    ['skipping', 'was skipped'],
  ]) {
    assert.throws(
      () =>
        evaluateRequiredChecks([
          { bucket, name: 'repository-validation', state: bucket },
        ]),
      (error) =>
        error.type === 'CHECKS_FAILED' &&
        error.message.includes(`"repository-validation" ${outcome}`) &&
        error.message.includes('Rerun "repository-validation"')
    );
  }
});

test('an actionable required check takes precedence over pending checks in either input order', () => {
  const pending = {
    bucket: 'pending',
    name: 'browser-tests',
    state: 'IN_PROGRESS',
  };
  const failed = {
    bucket: 'fail',
    name: 'repository-validation',
    state: 'FAILURE',
  };

  for (const checks of [
    [pending, failed],
    [failed, pending],
  ]) {
    assert.throws(
      () => evaluateRequiredChecks(checks, { prNumber: 17 }),
      (error) =>
        error.type === 'CHECKS_FAILED' &&
        error.message.includes('"repository-validation" failed') &&
        error.message.includes('Fix or rerun "repository-validation"') &&
        !error.message.includes('wait for it to complete')
    );
  }
});

test('required-check diagnostics use the exact PR retry and flatten control characters', () => {
  assert.throws(
    () =>
      evaluateRequiredChecks(
        [
          {
            bucket: 'pending',
            name: 'repo\nvalidation',
            state: 'IN\tPROGRESS',
          },
        ],
        { prNumber: 17 }
      ),
    (error) =>
      error.type === 'CHECKS_PENDING' &&
      error.message.includes('"repo validation"') &&
      error.message.includes('state: IN PROGRESS') &&
      error.message.includes('pnpm pr:merge 17') &&
      !error.message.includes('\n') &&
      !error.message.includes('\t')
  );
});

test('GitHub required-check query requests and preserves check identity', async () => {
  const calls = [];
  const gh = createGhClient(
    {
      run: async (command, args) => {
        calls.push({ command, args });
        return {
          ok: true,
          stdout:
            '[{"bucket":"fail","name":"repository-validation","state":"FAILURE"}]',
          stderr: '',
        };
      },
    },
    '/repo'
  );

  const checks = await gh.requiredChecks('owner/repo', 17);

  assert.deepEqual(checks, [
    {
      bucket: 'fail',
      name: 'repository-validation',
      state: 'FAILURE',
    },
  ]);
  assert.deepEqual(calls[0].args.slice(-2), ['--json', 'bucket,name,state']);
});

test('GitHub required-check parsing fails closed for invalid JSON', async () => {
  const gh = createGhClient(
    {
      run: async () => ({
        ok: true,
        stdout: 'not-json',
        stderr: '',
      }),
    },
    '/repo'
  );

  await assert.rejects(
    gh.requiredChecks('owner/repo', 17),
    (error) =>
      error.type === 'COMMAND_FAILED' &&
      error.message.includes('Could not parse required checks for PR #17')
  );
});

function readyPr(overrides = {}) {
  return {
    number: 17,
    url: 'https://github.com/owner/repo/pull/17',
    title: 'Title',
    state: 'OPEN',
    baseRefName: 'main',
    headRefName: 'feature/test',
    headRefOid: 'abc123',
    isDraft: false,
    mergeable: 'MERGEABLE',
    mergeStateStatus: 'CLEAN',
    reviewDecision: '',
    mergedAt: null,
    ...overrides,
  };
}

test('GitHub merge primitive is fixed to squash with the observed head guard', async () => {
  const calls = [];
  const gh = createGhClient(
    {
      run: async (command, args) => {
        calls.push({ command, args });
        return { ok: true, stdout: '', stderr: '' };
      },
    },
    '/repo'
  );

  await gh.merge('owner/repo', 17, { headSha: REVIEWED_HEAD });

  assert.deepEqual(calls, [
    {
      command: 'gh',
      args: [
        'pr',
        'merge',
        '17',
        '--repo',
        'owner/repo',
        '--squash',
        '--match-head-commit',
        REVIEWED_HEAD,
      ],
    },
  ]);
});

function standaloneMergeHarness({
  currentBranch = 'feature/test',
  worktreeStatus = '',
} = {}) {
  const calls = {
    merge: [],
    fetch: 0,
    fetchBranch: 0,
    switch: 0,
    pull: 0,
    status: 0,
  };
  let merged = false;
  let activeBranch = currentBranch;
  let localHead = REVIEWED_HEAD;
  const defaultHead = DEFAULT_HEAD;
  const pr = () =>
    readyPr(
      merged
        ? {
            state: 'MERGED',
            mergedAt: '2026-07-27T00:00:00Z',
            headRefOid: REVIEWED_HEAD,
          }
        : { headRefOid: REVIEWED_HEAD }
    );
  const git = {
    repoRoot: async () => '/repo',
    origin: async () => 'git@github.com:owner/repo.git',
    status: async () => {
      calls.status += 1;
      return worktreeStatus;
    },
    branch: async () => activeBranch,
    head: async () => localHead,
    fetchDefault: async () => {
      calls.fetch += 1;
    },
    fetchBranch: async () => {
      calls.fetchBranch += 1;
    },
    remoteBranchExists: async () => true,
    verifyRef: async () => true,
    ref: async (ref) => (ref === 'origin/main' ? defaultHead : REVIEWED_HEAD),
    isAncestor: async (ancestor) => ancestor === 'origin/main',
    revListCount: async () => (activeBranch === 'main' ? 0 : 1),
    switchBranch: async (branch) => {
      calls.switch += 1;
      activeBranch = branch;
    },
    canFastForwardTo: async () => true,
    pullFastForward: async () => {
      calls.pull += 1;
      localHead = defaultHead;
    },
  };
  const gh = {
    authReady: async () => true,
    repoName: async () => 'owner/repo',
    viewPullRequest: async () => pr(),
    listPullRequests: async () =>
      activeBranch === 'main'
        ? []
        : [{ number: 17, state: merged ? 'MERGED' : 'OPEN' }],
    requiredChecks: async () => [{ bucket: 'pass' }],
    merge: async (_repo, _number, options) => {
      calls.merge.push(options);
      merged = true;
    },
  };
  return { calls, git, gh };
}

test('immediate pr:merge uses current GitHub truth without local checkout coupling', async () => {
  for (const [currentBranch, worktreeStatus] of [
    ['main', ''],
    ['feature/unrelated', ' M unrelated.md'],
    ['HEAD', ''],
  ]) {
    const { calls, git, gh } = standaloneMergeHarness({
      currentBranch,
      worktreeStatus,
    });
    let finalizeCalls = 0;
    const result = await runMergePrFlow({
      git,
      gh,
      output,
      options: {
        prNumber: 17,
      },
      sleep: async () => {},
      finalizeLifecycle: async () => {
        finalizeCalls += 1;
      },
    });
    assert.equal(result.status, 'merged');
    assert.equal(result.report.repository, 'owner/repo');
    assert.equal(result.report.baseBranch, 'main');
    assert.equal(result.report.reviewedHead, undefined);
    assert.equal(result.report.observedPrHead, REVIEWED_HEAD);
    assert.equal(result.report.observedPrState, 'MERGED');
    assert.deepEqual(calls.merge, [{ headSha: REVIEWED_HEAD }]);
    assert.equal(calls.fetch, 0);
    assert.equal(calls.fetchBranch, 0);
    assert.equal(calls.status, 0);
    assert.equal(calls.switch, 0);
    assert.equal(calls.pull, 0);
    assert.equal(finalizeCalls, 0);
  }
});

test('immediate pr:merge remains independent of default-branch movement', async () => {
  const { calls, git, gh } = standaloneMergeHarness();
  git.fetchDefault = async () => {
    throw new Error(
      'immediate merge must not fetch the default branch for ancestry'
    );
  };
  git.isAncestor = async () => {
    throw new Error('immediate merge must not check default-branch ancestry');
  };
  const result = await runMergePrFlow({
    git,
    gh,
    output,
    options: {
      prNumber: 17,
    },
    sleep: async () => {},
  });
  assert.equal(result.status, 'merged');
  assert.equal(calls.fetch, 0);
  assert.equal(calls.fetchBranch, 0);
  assert.deepEqual(calls.merge, [{ headSha: REVIEWED_HEAD }]);
});

test('immediate pr:merge repeats required-check verification immediately before merge', async () => {
  const { calls, git, gh } = standaloneMergeHarness();
  let checkReads = 0;
  gh.requiredChecks = async () => {
    checkReads += 1;
    return [{ bucket: checkReads === 1 ? 'pass' : 'pending' }];
  };
  await assert.rejects(
    runMergePrFlow({
      git,
      gh,
      output,
      options: {
        prNumber: 17,
      },
    }),
    (error) => error.type === 'CHECKS_PENDING'
  );
  assert.equal(checkReads, 2);
  assert.equal(calls.fetchBranch, 0);
  assert.equal(calls.merge.length, 0);
});

test('immediate pr:merge uses the head read during final current-state preflight', async () => {
  const { calls, git, gh } = standaloneMergeHarness();
  const finalHead = 'c'.repeat(40);
  let prReads = 0;
  gh.viewPullRequest = async () => {
    prReads += 1;
    return readyPr({
      headRefOid: calls.merge.length
        ? finalHead
        : prReads >= 3
          ? finalHead
          : REVIEWED_HEAD,
      ...(calls.merge.length
        ? { state: 'MERGED', mergedAt: '2026-07-27T00:00:00Z' }
        : {}),
    });
  };
  const result = await runMergePrFlow({
    git,
    gh,
    output,
    options: { prNumber: 17 },
    sleep: async () => {},
  });
  assert.equal(result.status, 'merged');
  assert.equal(prReads, 4);
  assert.deepEqual(calls.merge, [{ headSha: finalHead }]);
});

test('immediate pr:merge does not retry after the expected-head guard rejects a race', async () => {
  const { calls, git, gh } = standaloneMergeHarness();
  gh.merge = async (_repo, _number, options) => {
    calls.merge.push(options);
    throw new RepositoryToolError(
      'MERGE_REJECTED',
      'The PR head changed during the merge request.'
    );
  };
  await assert.rejects(
    runMergePrFlow({
      git,
      gh,
      output,
      options: { prNumber: 17 },
    }),
    (error) => error.type === 'MERGE_REJECTED'
  );
  assert.deepEqual(calls.merge, [{ headSha: REVIEWED_HEAD }]);
});

test('clean publication blocks scope drift, head drift, new dirt, and secrets before effects', async () => {
  for (const scenario of ['scope', 'head', 'dirty', 'secret']) {
    const { calls, git, gh } = clients();
    if (scenario === 'scope')
      setExactScope(git, {
        nameStatus: 'M\tother.md',
        numstat: '1\t0\tother.md',
      });
    if (scenario === 'head') {
      let count = 0;
      git.head = async () => (++count === 1 ? 'abc123' : 'different');
    }
    if (scenario === 'dirty') git.status = async () => ' M file.md';
    if (scenario === 'secret') {
      const original = git.diff;
      git.diff = async (args) =>
        args.includes('--name-status') || args.includes('--numstat')
          ? original(args)
          : 'diff --git a/file.md b/file.md\n+++ b/file.md\n+' +
            ['-----BEGIN', 'PRIVATE', 'KEY-----'].join(' ');
    }
    await assert.rejects(
      runPrOpenOrUpdateFlow({
        git,
        gh,
        output,
        options,
        detectState: async () => cleanState(),
      })
    );
    assertNoPublicationMutation(calls);
  }
});

test('publication reuses a PR that appears during the push and never creates a duplicate', async () => {
  const { calls, git, gh } = clients();
  gh.listPullRequests = async () => (calls.push ? [{ number: 17 }] : []);
  const result = await runPrOpenOrUpdateFlow({
    git,
    gh,
    output,
    options,
    detectState: async () => cleanState(),
  });
  assert.equal(result.report.prNumber, 17);
  assert.equal(calls.push, 1);
  assert.equal(calls.create, 0);
  assert.equal(calls.pushedHead, 'abc123');
});

test('ambiguous PR discovery prevents publication', async () => {
  const { calls, git, gh } = clients();
  gh.listPullRequests = async () => [{ number: 17 }, { number: 18 }];
  await assert.rejects(
    runPrOpenOrUpdateFlow({
      git,
      gh,
      output,
      options,
      detectState: async () => cleanState(),
    }),
    { type: 'AMBIGUOUS_PR' }
  );
  assertNoPublicationMutation(calls);
});

test('CLI accepts deliberate PR content and rejects commit/recovery inputs', () => {
  const result = parseCliOptions([
    '--mode',
    'pr-open-or-update',
    '--title',
    'Small change',
    '--body-file',
    '/tmp/body.md',
  ]);
  assert.equal(result.prTitle, 'Small change');
  assert.equal(result.bodyFile, '/tmp/body.md');
  for (const args of [
    ['--branch', 'recovery'],
    ['old commit message'],
    ['--title'],
    ['--body-file'],
    ['--mode', 'pr-merge'],
  ]) {
    assert.throws(
      () => parseCliOptions(['--mode', 'pr-open-or-update', ...args]),
      { type: 'INVALID_ARGUMENT' }
    );
  }
});

test('default advancement discovered at the final push boundary blocks publication', async () => {
  const { calls, git, gh } = clients();
  git.includesDefault = async () => false;
  await assert.rejects(
    runPrOpenOrUpdateFlow({
      git,
      gh,
      output,
      options,
      detectState: async () => cleanState(),
    }),
    { type: 'UNSAFE_BRANCH_STATE' }
  );
  assertNoPublicationMutation(calls);
});

test('merge success requires observed remote merge into the expected base', async () => {
  const { pollForVerifiedMerge } = await import('./actions.mjs');
  for (const pr of [
    readyPr(),
    readyPr({ state: 'CLOSED' }),
    readyPr({ state: 'MERGED', mergedAt: '2026-09-16', baseRefName: 'other' }),
  ]) {
    await assert.rejects(
      pollForVerifiedMerge({
        gh: { viewPullRequest: async () => pr },
        repo: 'owner/repo',
        prNumber: 17,
        defaultBranch: 'main',
        attempts: 1,
      })
    );
  }
  const merged = readyPr({ state: 'MERGED', mergedAt: '2026-09-16' });
  assert.equal(
    await pollForVerifiedMerge({
      gh: { viewPullRequest: async () => merged },
      repo: 'owner/repo',
      prNumber: 17,
      defaultBranch: 'main',
      attempts: 1,
    }),
    merged
  );
});
