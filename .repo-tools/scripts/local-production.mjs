import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStreamingRunner } from './shared/streaming-runner.mjs';
import { createCommandRunner } from './shared/command-runner.mjs';
import { createGitClient } from './shared/git-client.mjs';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const revisionPattern = /^[a-f0-9]{40}$/u;
const portPattern = /^(?:[1-9][0-9]{3,4})$/u;

export class LocalProductionError extends Error {
  constructor(type, message) {
    super(message);
    this.name = 'LocalProductionError';
    this.type = type;
  }
}

function workspaceIdentity(rootDirectory) {
  return createHash('sha256')
    .update(path.resolve(rootDirectory))
    .digest('hex')
    .slice(0, 12);
}

function resolvePort(name, fallback, environment) {
  const value = environment[name] ?? fallback;
  if (!portPattern.test(value) || Number(value) > 65_535) {
    throw new LocalProductionError(
      'CONFIGURATION_INVALID',
      `${name} must be an explicit local TCP port between 1000 and 65535.`
    );
  }
  return value;
}

export function resolveLocalProductionConfig(
  environment = process.env,
  rootDirectory = repositoryRoot
) {
  const workspaceId = workspaceIdentity(rootDirectory);
  return {
    rootDirectory,
    composePath: path.join(rootDirectory, 'deploy/local/compose.yml'),
    projectName: `badminton-local-${workspaceId}`,
    imageTag: `badminton-club-app:local-${workspaceId}`,
    webPort: resolvePort('BADMINTON_LOCAL_WEB_PORT', '43110', environment),
    apiPort: resolvePort('BADMINTON_LOCAL_API_PORT', '43120', environment),
    mongoPort: resolvePort('BADMINTON_LOCAL_MONGO_PORT', '43130', environment),
  };
}

function requireSuccessful(result, label) {
  if (!result.ok) {
    throw new LocalProductionError(
      'COMMAND_FAILED',
      `${label} failed (exit code ${result.exitCode ?? 'unknown'}).`
    );
  }
  return result.stdout.trim();
}

function composeArguments(config, suffix) {
  return [
    'compose',
    '--project-name',
    config.projectName,
    '-f',
    config.composePath,
    ...suffix,
  ];
}

function composeEnvironment(config, environment) {
  return {
    ...environment,
    BADMINTON_LOCAL_IMAGE: config.imageTag,
    BADMINTON_LOCAL_WEB_PORT: config.webPort,
    BADMINTON_LOCAL_API_PORT: config.apiPort,
    BADMINTON_LOCAL_MONGO_PORT: config.mongoPort,
  };
}

export async function runLocalProduction({
  mode,
  rootDirectory = repositoryRoot,
  environment = process.env,
  commandRunner = createCommandRunner(),
  streamingRunner = createStreamingRunner(),
  gitClient = createGitClient(commandRunner, rootDirectory),
  log = console.log,
  warn = console.warn,
} = {}) {
  if (!['start', 'down'].includes(mode)) {
    throw new LocalProductionError(
      'USAGE',
      'Choose exactly one mode: start or down.'
    );
  }
  const config = resolveLocalProductionConfig(environment, rootDirectory);
  const localEnvironment = composeEnvironment(config, environment);
  const compose = async (suffix, label, timeoutMs = 180_000) =>
    requireSuccessful(
      await commandRunner.run('docker', composeArguments(config, suffix), {
        cwd: rootDirectory,
        env: localEnvironment,
        timeoutMs,
      }),
      label
    );

  if (mode === 'down') {
    await compose(
      ['down', '--volumes', '--remove-orphans'],
      'Local production cleanup'
    );
    log(
      `Removed local production project ${config.projectName} and its disposable state.`
    );
    return { mode, projectName: config.projectName };
  }

  const status = await gitClient.status();
  const revision = await gitClient.head();
  if (!revisionPattern.test(revision)) {
    throw new LocalProductionError(
      'GIT_IDENTITY_INVALID',
      'Local production HEAD did not resolve to a full commit SHA.'
    );
  }
  const sourceRevision = status
    ? `local-dirty-${revision.slice(0, 12)}-${workspaceIdentity(`${rootDirectory}:${status}`)}`
    : revision;
  const identityKind = status
    ? 'dirty debug build (not release evidence)'
    : 'clean commit build';
  log(
    `Local production: ${config.projectName}\nIdentity: ${sourceRevision}\nMode: ${identityKind}`
  );

  try {
    await streamingRunner.run(
      'docker',
      [
        'buildx',
        'build',
        '--platform',
        'linux/amd64',
        '--load',
        '--build-arg',
        `SOURCE_REVISION=${sourceRevision}`,
        '--build-arg',
        `FRONTEND_URL=http://localhost:${config.webPort}`,
        '--build-arg',
        'API_URL=http://api:3003',
        '--tag',
        config.imageTag,
        '.',
      ],
      { cwd: rootDirectory, env: localEnvironment },
      'Local production image build'
    );
  } catch {
    throw new LocalProductionError(
      'COMMAND_FAILED',
      'Local production image build failed.'
    );
  }

  try {
    await compose(
      ['up', '-d', '--wait', '--wait-timeout', '120', 'mongo', 'api', 'web'],
      'Local production startup',
      300_000
    );
    await compose(
      ['--profile', 'operator', 'run', '--rm', 'setup'],
      'Local production disposable setup',
      300_000
    );
    await compose(
      ['--profile', 'operator', 'run', '--rm', 'preflight'],
      'Local production runtime preflight',
      300_000
    );
    requireSuccessful(
      await commandRunner.run(
        'curl',
        [
          '--fail',
          '--silent',
          '--show-error',
          '--output',
          '/dev/null',
          '--max-time',
          '20',
          `http://127.0.0.1:${config.apiPort}/api/ready`,
        ],
        { cwd: rootDirectory }
      ),
      'Local API readiness'
    );
    requireSuccessful(
      await commandRunner.run(
        'curl',
        [
          '--fail',
          '--silent',
          '--show-error',
          '--output',
          '/dev/null',
          '--max-time',
          '20',
          `http://127.0.0.1:${config.webPort}/de`,
        ],
        { cwd: rootDirectory }
      ),
      'Local Web smoke'
    );
  } catch (error) {
    warn(
      `Local production validation failed. The stack was left running for evidence. Logs: docker compose --project-name ${config.projectName} -f deploy/local/compose.yml logs`
    );
    warn('Cleanup when finished: pnpm local:production:down');
    throw error;
  }

  log(`Web: http://127.0.0.1:${config.webPort}/de`);
  log(`API readiness: http://127.0.0.1:${config.apiPort}/api/ready`);
  log(
    `Logs: docker compose --project-name ${config.projectName} -f deploy/local/compose.yml logs`
  );
  log('Cleanup: pnpm local:production:down');
  return {
    mode,
    projectName: config.projectName,
    imageTag: config.imageTag,
    sourceRevision,
    dirty: Boolean(status),
    webPort: config.webPort,
    apiPort: config.apiPort,
  };
}

export async function runCli(
  arguments_ = process.argv.slice(2),
  dependencies = {}
) {
  try {
    if (arguments_.length !== 1) {
      throw new LocalProductionError(
        'USAGE',
        'Choose exactly one mode: start or down.'
      );
    }
    await runLocalProduction({ mode: arguments_[0], ...dependencies });
    return 0;
  } catch (error) {
    const type =
      error instanceof LocalProductionError ? error.type : 'UNEXPECTED_FAILURE';
    const message =
      error instanceof Error
        ? error.message
        : 'Unexpected local production failure.';
    (dependencies.writeError ?? console.error)(`${type}: ${message}`);
    return 1;
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.exitCode = await runCli();
}
