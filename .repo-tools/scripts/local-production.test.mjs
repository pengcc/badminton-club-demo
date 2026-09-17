import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  LocalProductionError,
  resolveLocalProductionConfig,
  runLocalProduction,
} from './local-production.mjs';

const rootDirectory = fileURLToPath(new URL('../..', import.meta.url));
const revision = '1'.repeat(40);

function fakeDependencies({ status = '', failAt = '' } = {}) {
  const commandCalls = [];
  const streamCalls = [];
  const logs = [];
  const warnings = [];
  return {
    commandCalls,
    streamCalls,
    logs,
    warnings,
    dependencies: {
      gitClient: {
        status: async () => status,
        head: async () => revision,
      },
      commandRunner: {
        run: async (command, args, options) => {
          commandCalls.push({ command, args, options });
          const joined = `${command} ${args.join(' ')}`;
          return {
            ok: !failAt || !joined.includes(failAt),
            exitCode: !failAt || !joined.includes(failAt) ? 0 : 1,
            stdout: '',
            stderr: '',
          };
        },
      },
      streamingRunner: {
        run: async (...args) => streamCalls.push(args),
      },
      log: (message) => logs.push(message),
      warn: (message) => warnings.push(message),
    },
  };
}

test('local start builds production artifacts and validates the independent disposable stack', async () => {
  const { dependencies, commandCalls, streamCalls } = fakeDependencies();
  const result = await runLocalProduction({
    mode: 'start',
    rootDirectory,
    ...dependencies,
  });
  assert.equal(result.dirty, false);
  assert.equal(result.sourceRevision, revision);
  assert.equal(streamCalls.length, 1);
  const buildArgs = streamCalls[0][1];
  assert.deepEqual(buildArgs.slice(0, 5), [
    'buildx',
    'build',
    '--platform',
    'linux/amd64',
    '--load',
  ]);
  assert.equal(buildArgs.includes(`SOURCE_REVISION=${revision}`), true);
  const commands = commandCalls.map(
    ({ command, args }) => `${command} ${args.join(' ')}`
  );
  assert.equal(
    commands.some((command) => command.includes(' up -d --wait')),
    true
  );
  assert.equal(
    commands.some((command) => command.includes(' run --rm setup')),
    true
  );
  assert.equal(
    commands.some((command) => command.includes(' run --rm preflight')),
    true
  );
  assert.equal(
    commands.some((command) => command.includes('/api/ready')),
    true
  );
  assert.equal(
    commands.some((command) => command.endsWith('/de')),
    true
  );
  assert.equal(
    commands.some((command) => command.includes('ssh')),
    false
  );
});

test('dirty local start uses an unmistakable non-release image revision', async () => {
  const { dependencies, streamCalls, logs } = fakeDependencies({
    status: ' M apps/web/page.tsx',
  });
  const result = await runLocalProduction({
    mode: 'start',
    rootDirectory,
    ...dependencies,
  });
  assert.equal(result.dirty, true);
  assert.match(
    result.sourceRevision,
    /^local-dirty-111111111111-[a-f0-9]{12}$/u
  );
  assert.equal(result.sourceRevision.length === 40, false);
  assert.equal(
    streamCalls[0][1].includes(`SOURCE_REVISION=${result.sourceRevision}`),
    true
  );
  assert.match(logs[0], /not release evidence/u);
});

test('local down removes only the exact workspace-owned project and volumes', async () => {
  const { dependencies, commandCalls, streamCalls } = fakeDependencies();
  const result = await runLocalProduction({
    mode: 'down',
    rootDirectory,
    ...dependencies,
  });
  assert.equal(streamCalls.length, 0);
  assert.equal(commandCalls.length, 1);
  assert.deepEqual(commandCalls[0].args, [
    'compose',
    '--project-name',
    result.projectName,
    '-f',
    path.join(rootDirectory, 'deploy/local/compose.yml'),
    'down',
    '--volumes',
    '--remove-orphans',
  ]);
});

test('different workspace paths receive different Compose ownership', () => {
  const first = resolveLocalProductionConfig({}, rootDirectory);
  const second = resolveLocalProductionConfig(
    {},
    `${rootDirectory}-another-worktree`
  );
  assert.notEqual(first.projectName, second.projectName);
  assert.notEqual(first.imageTag, second.imageTag);
});

test('occupied or invalid explicit ports fail without automatic selection', () => {
  assert.throws(
    () =>
      resolveLocalProductionConfig(
        { BADMINTON_LOCAL_WEB_PORT: '0' },
        rootDirectory
      ),
    (error) =>
      error instanceof LocalProductionError &&
      error.type === 'CONFIGURATION_INVALID'
  );
  const config = resolveLocalProductionConfig(
    {
      BADMINTON_LOCAL_WEB_PORT: '45110',
      BADMINTON_LOCAL_API_PORT: '45120',
      BADMINTON_LOCAL_MONGO_PORT: '45130',
    },
    rootDirectory
  );
  assert.deepEqual(
    [config.webPort, config.apiPort, config.mongoPort],
    ['45110', '45120', '45130']
  );
});

test('failed local validation leaves the stack available for logs', async () => {
  const { dependencies, commandCalls, warnings } = fakeDependencies({
    failAt: '/api/ready',
  });
  await assert.rejects(
    runLocalProduction({ mode: 'start', rootDirectory, ...dependencies }),
    (error) =>
      error instanceof LocalProductionError && error.type === 'COMMAND_FAILED'
  );
  assert.equal(
    commandCalls.some(({ args }) => args.includes('down')),
    false
  );
  assert.match(warnings.join('\n'), /left running for evidence/u);
  assert.match(warnings.join('\n'), /pnpm local:production:down/u);
});

test('occupied default ports fail truthfully without retrying another port', async () => {
  const { dependencies, commandCalls } = fakeDependencies({
    failAt: 'up -d --wait',
  });
  await assert.rejects(
    runLocalProduction({ mode: 'start', rootDirectory, ...dependencies }),
    (error) =>
      error instanceof LocalProductionError && error.type === 'COMMAND_FAILED'
  );
  const startupCalls = commandCalls.filter(({ args }) => args.includes('up'));
  assert.equal(startupCalls.length, 1);
  assert.equal(startupCalls[0].options.env.BADMINTON_LOCAL_WEB_PORT, '43110');
  assert.equal(startupCalls[0].options.env.BADMINTON_LOCAL_API_PORT, '43120');
  assert.equal(startupCalls[0].options.env.BADMINTON_LOCAL_MONGO_PORT, '43130');
});

test('local Compose uses only synthetic local resources and no production boundary', async () => {
  const source = await readFile(
    path.join(rootDirectory, 'deploy/local/compose.yml'),
    'utf8'
  );
  assert.match(source, /mongo:8\.0\.14/u);
  assert.match(source, /replicaSet=rs0/u);
  assert.match(source, /local-production-synthetic/u);
  assert.doesNotMatch(
    source,
    /\/etc\/badminton-club|\/srv\/badminton-club|club\.dcbev\.de/u
  );
  assert.doesNotMatch(source, /type:\s*bind/u);
});

test('showcase keeps local production without exposing production deployment', async () => {
  const packageJson = JSON.parse(
    await readFile(path.join(rootDirectory, 'package.json'), 'utf8')
  );
  assert.equal(
    packageJson.scripts['local:production'].includes(
      'local-production.mjs start'
    ),
    true
  );
  assert.equal(
    packageJson.scripts['local:production:down'].includes(
      'local-production.mjs down'
    ),
    true
  );
  assert.equal(packageJson.scripts['deploy:production'], undefined);
  assert.equal(
    packageJson.scripts['local:production'].includes('deploy:production'),
    false
  );
});
