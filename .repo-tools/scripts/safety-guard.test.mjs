import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  collectReadOnlySafetyScope,
  parseOptions,
  runCli,
  runSafetyGuardFlow,
} from './safety-guard.mjs';
import { assertSecretSafeScope } from './repository-safety/secret-safety.mjs';
import { createOutput } from './shared/output.mjs';

function capture() {
  let text = '';
  const stream = {
    isTTY: false,
    write(value) {
      text += value;
    },
  };
  return {
    output: createOutput({ stdout: stream, stderr: stream, env: {} }),
    text: () => text,
  };
}

test('standalone safety rejects effect and acknowledgement arguments', () => {
  assert.deepEqual(parseOptions(['--verbose', '--help']), {
    verbose: true,
    help: true,
  });
  for (const arg of [
    '--acknowledge-secret-review',
    '--show-diff',
    '--branch',
    'message',
    '--mode',
  ]) {
    assert.throws(() => parseOptions([arg]), { type: 'INVALID_ARGUMENT' });
  }
});

test('read-only scope combines committed, tracked, renamed and untracked changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'badminton-safety-c-'));
  try {
    await writeFile(join(root, 'new.txt'), 'ordinary fixture');
    const calls = [];
    const git = {
      async verifyRef(ref) {
        assert.equal(ref, 'origin/main');
        return true;
      },
      async mergeBase() {
        return 'base';
      },
      async statusZ() {
        return 'R  renamed.txt\0old.txt\0?? new.txt\0';
      },
      async diff(args) {
        calls.push(args);
        return args[0] === '--name-status'
          ? 'M\tcommitted.txt'
          : 'ordinary diff';
      },
    };
    const scope = await collectReadOnlySafetyScope({
      git,
      root,
      compareRef: 'origin/main',
    });
    assert.deepEqual(scope.files, [
      { path: 'committed.txt', status: 'M' },
      { path: 'new.txt', status: 'A' },
      { path: 'old.txt', status: 'D' },
      { path: 'renamed.txt', status: 'M' },
    ]);
    assert.match(scope.diff, /\+ordinary fixture/);
    assert.deepEqual(calls, [
      ['--name-status', '--no-renames', 'base...HEAD'],
      ['base...HEAD'],
      ['HEAD'],
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('standalone high-confidence blocker is rendered once and exits nonzero', async () => {
  const captured = capture();
  const git = {
    async repoRoot() {
      return process.cwd();
    },
    async branch() {
      return 'feature/test';
    },
    async verifyRef() {
      return true;
    },
    async mergeBase() {
      return 'base';
    },
    async statusZ() {
      return '';
    },
    async diff(args) {
      return args[0] === '--name-status' ? 'A\t.env' : '';
    },
  };
  const code = await runCli([], {
    run: () => runSafetyGuardFlow({ git, output: captured.output, env: {} }),
    renderError: captured.output.error,
  });
  assert.equal(code, 1);
  assert.equal(
    captured.text().split('Secret-safety guard blocked because').length - 1,
    1
  );
  assert.doesNotMatch(captured.text(), /\[ERROR\]/);
});

test('review-required findings still fail closed without acknowledgement', async () => {
  const captured = capture();
  const field = ['to', 'ken'].join('');
  const value = ['ordinary', 'fixture', 'value'].join('-');
  const code = await runCli([], {
    run: () =>
      assertSecretSafeScope({
        files: [{ path: 'example.txt', status: 'A' }],
        diff: `diff --git a/example.txt b/example.txt\n+++ b/example.txt\n+${field}="${value}"`,
        standalone: true,
        output: captured.output,
      }),
    renderError: captured.output.error,
  });
  assert.equal(code, 1);
  assert.match(captured.text(), /SECRET_SAFETY_REVIEW_REQUIRED/);
  assert.doesNotMatch(captured.text(), new RegExp(value));
});
