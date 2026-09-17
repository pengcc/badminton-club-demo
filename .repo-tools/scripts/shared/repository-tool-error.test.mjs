import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RepositoryToolError,
  commandFailure,
} from './repository-tool-error.mjs';

test('generic error preserves type, message and details identity', () => {
  const details = { exitCode: 7 };
  const error = new RepositoryToolError('BLOCKED', 'Stop here', details);
  assert.ok(error instanceof Error);
  assert.equal(error.name, 'RepositoryToolError');
  assert.equal(error.type, 'BLOCKED');
  assert.equal(error.message, 'Stop here');
  assert.equal(error.details, details);
});

test('command failure retains exit status and stderr precedence', () => {
  const result = { exitCode: 7, stderr: ' rejected ', stdout: 'other' };
  const error = commandFailure('Git failed', result);
  assert.equal(error.type, 'COMMAND_FAILED');
  assert.equal(error.message, 'Git failed (exit code 7): rejected');
  assert.equal(error.details.result, result);
});
