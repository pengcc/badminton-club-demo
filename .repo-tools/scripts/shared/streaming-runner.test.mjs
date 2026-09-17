import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { RepositoryToolError } from './repository-tool-error.mjs';
import { createStreamingRunner } from './streaming-runner.mjs';

function child() {
  const result = new EventEmitter();
  result.signals = [];
  result.kill = (signal) => {
    result.signals.push(signal);
    setImmediate(() => result.emit('close', null));
  };
  return result;
}

const turn = () => new Promise((resolve) => setImmediate(resolve));

test('run preserves exact command, environment, cwd, inherited output and successful completion', async () => {
  const process = child();
  const calls = [];
  const runner = createStreamingRunner({
    spawnImpl: (...args) => {
      calls.push(args);
      return process;
    },
  });
  const environment = { SYNTHETIC: 'yes' };
  const result = runner.run(
    'tool',
    ['argument'],
    { cwd: '/fixture', env: environment },
    'Build'
  );
  assert.deepEqual(calls, [
    [
      'tool',
      ['argument'],
      {
        cwd: '/fixture',
        env: environment,
        shell: false,
        stdio: ['ignore', 'inherit', 'inherit'],
      },
    ],
  ]);
  process.emit('close', 0);
  await result;
  assert.deepEqual(process.signals, []);
});

test('run preserves bounded spawn, exit and timeout failures', async () => {
  for (const [failure, type, message] of [
    ['spawn', 'COMMAND_FAILED', 'Build could not start.'],
    ['exit', 'COMMAND_FAILED', 'Build failed (exit code 7).'],
    ['timeout', 'COMMAND_TIMEOUT', 'Build timed out.'],
  ]) {
    const process = child();
    const runner = createStreamingRunner({
      spawnImpl: () => process,
    });
    const result = runner.run(
      'tool',
      [],
      { cwd: '/fixture', timeoutMs: 10 },
      'Build'
    );
    const assertion = assert.rejects(result, (error) => {
      assert.ok(error instanceof RepositoryToolError);
      assert.equal(error.type, type);
      assert.equal(error.message, message);
      return true;
    });
    if (failure === 'spawn')
      process.emit('error', new Error('SYNTHETIC_PRIVATE_DETAIL'));
    if (failure === 'exit') process.emit('close', 7);
    await assertion;
    assert.deepEqual(process.signals, failure === 'timeout' ? ['SIGTERM'] : []);
    await turn();
  }
});
