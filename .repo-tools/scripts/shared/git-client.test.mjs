import assert from 'node:assert/strict';
import test from 'node:test';
import { createGitClient } from './git-client.mjs';

function commandRunner(results) {
  const calls = [];
  return {
    calls,
    async run(command, args) {
      calls.push({ command, args });
      const result = results.shift();
      return {
        ok: false,
        exitCode: 1,
        stdout: '',
        stderr: '',
        command,
        args,
        ...result,
      };
    },
  };
}

test('shared Git parsers preserve rename destinations and NUL-delimited paths', async () => {
  const { parsePorcelainZ, parseNameStatus } = await import('./git-client.mjs');
  assert.deepEqual(parsePorcelainZ('R  new name\0old name\0?? line\nbreak\0'), [
    { status: 'R ', path: 'new name', originalPath: 'old name' },
    { status: '??', path: 'line\nbreak' },
  ]);
  assert.deepEqual(parseNameStatus('M\tfile\nR100\told\tnew\n'), [
    { status: 'M', path: 'file' },
    { status: 'R', path: 'new' },
  ]);
  assert.deepEqual(parsePorcelainZ(''), []);
  assert.deepEqual(parseNameStatus(''), []);
});

test('publication fetches the exact default ref and pushes only the captured head', async () => {
  const runner = commandRunner([
    { ok: true, stdout: 'ref: refs/heads/trunk\tHEAD\nabc\tHEAD\n' },
    { ok: true },
    { ok: true },
  ]);
  const git = createGitClient(runner, '/repo');
  assert.equal(await git.defaultBranch(), 'trunk');
  await git.fetchDefault('trunk');
  await git.push('feature/test', 'a'.repeat(40));
  assert.deepEqual(
    runner.calls.map(({ args }) => args),
    [
      ['ls-remote', '--symref', 'origin', 'HEAD'],
      ['fetch', 'origin', 'refs/heads/trunk:refs/remotes/origin/trunk'],
      ['push', 'origin', `${'a'.repeat(40)}:refs/heads/feature/test`],
    ]
  );
});

test('missing remote default fails closed', async () => {
  const git = createGitClient(
    commandRunner([{ ok: true, stdout: 'abc\tHEAD' }]),
    '/repo'
  );
  await assert.rejects(git.defaultBranch(), { type: 'UNSAFE_BRANCH_STATE' });
});
