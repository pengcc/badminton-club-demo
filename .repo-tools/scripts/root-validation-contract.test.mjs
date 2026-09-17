import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function readPackageScripts(packageJsonUrl) {
  const packageJson = JSON.parse(
    await readFile(new URL(packageJsonUrl, import.meta.url), 'utf8')
  );

  return packageJson.scripts;
}

async function readRootScripts() {
  return readPackageScripts('../../package.json');
}

test('ordinary workspace tests select the API ordinary Vitest project directly', async () => {
  const scripts = await readRootScripts();

  assert.deepEqual(scripts['test:workspace'].split(' && '), [
    'pnpm --filter @club/shared-types test --run',
    'pnpm --filter @club/web test --run',
    'pnpm --filter @club/api test --run --project ordinary',
  ]);
  assert.doesNotMatch(scripts['test:workspace'], /project persistence/u);
});

test('root validation retains the ordinary stages and keeps persistence explicit', async () => {
  const scripts = await readRootScripts();
  const webScripts = await readPackageScripts('../../apps/web/package.json');

  assert.deepEqual(scripts.test.split(' && '), [
    'pnpm test:workspace',
    'pnpm test:repo-tools',
  ]);
  assert.deepEqual(scripts.validate.split(' && '), [
    'pnpm check',
    'pnpm typecheck',
    'pnpm test',
    'FRONTEND_URL=${FRONTEND_URL:-http://localhost:3000} pnpm build',
  ]);
  assert.equal(
    scripts['test:persistence'],
    'MONGO_TEST_SERVER_MODE=${MONGO_TEST_SERVER_MODE:-testcontainers} pnpm --filter @club/api test --run --project persistence'
  );
  assert.doesNotMatch(scripts.validate, /MONGO_TEST_SERVER_MODE/u);
  assert.doesNotMatch(scripts['test:persistence'], /MONGO_TEST_BACKEND/u);
  assert.deepEqual(webScripts.typecheck.split(' && '), [
    'next typegen',
    'tsc --noEmit',
  ]);
});
