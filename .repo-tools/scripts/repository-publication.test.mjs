import assert from 'node:assert/strict';
import test from 'node:test';
import { selectPublicationFlow } from './repository-publication.mjs';

test('dispatcher selects every retained public publication flow', () => {
  const flows = {
    'pr-open-or-update': Symbol('pr-open-or-update'),
    'pr-merge': Symbol('pr-merge'),
  };
  for (const [mode, flow] of Object.entries(flows)) {
    assert.equal(selectPublicationFlow(mode, flows), flow);
  }
});

test('public command wiring uses distinct executable owners', async () => {
  const { readFile } = await import('node:fs/promises');
  const { spawnSync } = await import('node:child_process');
  const { scripts } = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url), 'utf8')
  );
  const commands = {
    'pr:open-or-update': 'repository-publication.mjs --mode pr-open-or-update',
    'pr:merge': 'repository-publication.mjs --mode pr-merge',
    'safety:guard': 'safety-guard.mjs',
  };
  for (const [command, entry] of Object.entries(commands)) {
    assert.equal(scripts[command], `node .repo-tools/scripts/${entry}`);
    const result = spawnSync(
      process.execPath,
      [
        `.repo-tools/scripts/${entry.split(' ')[0]}`,
        ...entry.split(' ').slice(1),
        '--help',
      ],
      { encoding: 'utf8' }
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Usage:/);
    assert.doesNotMatch(result.stdout + result.stderr, /Theme|theme config/);
  }
});

test('publication rejects removed safety and housekeeping modes', async () => {
  const { parseCliOptions } = await import(
    './repository-publication/cli-options.mjs'
  );
  for (const mode of [
    'safety-guard',
    'refresh-local-default',
    'change-pr',
    'change-merge',
  ]) {
    assert.throws(() => parseCliOptions(['--mode', mode]), {
      type: 'INVALID_ARGUMENT',
    });
  }
});
