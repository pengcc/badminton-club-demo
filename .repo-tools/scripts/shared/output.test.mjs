import assert from 'node:assert/strict';
import test from 'node:test';
import { createOutput } from './output.mjs';

function capture(isTTY, env = {}) {
  const stdout = {
    isTTY,
    text: '',
    write(value) {
      this.text += value;
    },
  };
  const stderr = {
    isTTY,
    text: '',
    write(value) {
      this.text += value;
    },
  };
  return { stdout, stderr, output: createOutput({ stdout, stderr, env }) };
}

for (const [name, isTTY, env] of [
  ['redirected', false, {}],
  ['NO_COLOR', true, { NO_COLOR: '' }],
]) {
  test(`${name} output stays plain and keeps blockers outside step indentation`, () => {
    const { output, stdout, stderr } = capture(isTTY, env);
    output.step('Inspect');
    output.info('Detail');
    output.command('Next:', 'pnpm safety:guard');
    output.debug('hidden');
    for (const level of ['error', 'danger', 'warning'])
      output[level]('Blocked\nNext action');
    assert.equal(
      stdout.text,
      '[STEP] Inspect\n  [INFO] Detail\n  [INFO] Next: pnpm safety:guard\n'
    );
    assert.equal(
      stderr.text,
      '[ERROR] Blocked\nNext action\n[DANGER] Blocked\nNext action\n[WARNING] Blocked\nNext action\n'
    );
  });
}

test('TTY output preserves default color and command emphasis with primary blockers', () => {
  const { output, stdout, stderr } = capture(true);
  output.step('Inspect');
  output.command('Next:', 'pnpm safety:guard');
  output.error('Blocked');
  assert.match(stdout.text, /\u001b\[1;94m\[STEP\]/);
  assert.match(
    stdout.text,
    /\u001b\[38;2;28;112;230mpnpm safety:guard\u001b\[0m/
  );
  assert.match(stderr.text, /^\u001b\[1;91m\[ERROR\]/);
});

test('verbose diagnostics remain supported', () => {
  let text = '';
  const stream = {
    isTTY: false,
    write(value) {
      text += value;
    },
  };
  const output = createOutput({
    stdout: stream,
    stderr: stream,
    verbose: true,
    env: {},
  });
  output.debug('diagnostic');
  assert.equal(text, '[DEBUG] diagnostic\n');
});
