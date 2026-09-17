import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { parseEnv } from 'node:util';
import test from 'node:test';
import {
  bootstrapLocalEnvironment,
  validateApiEnvironment,
  validateWebEnvironment,
} from './bootstrap-local-env.mjs';

const execFileAsync = promisify(execFile);
const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));
const scriptPath = path.join(
  repositoryRoot,
  '.repo-tools/scripts/bootstrap-local-env.mjs'
);
const deterministicKey = Buffer.alloc(32, 7).toString('base64');
const runtimeAcceptedUnpaddedKey = deterministicKey.replace(/=+$/u, '');

function validApiContent({
  mongoUri = 'mongodb://localhost:27018/local?replicaSet=rs0',
  uploadsRoot,
  extra = '',
} = {}) {
  return [
    `MONGODB_URI=${mongoUri}`,
    'FRONTEND_URL=http://localhost:3000',
    ...(uploadsRoot ? [`DEVELOPMENT_PUBLIC_UPLOADS_ROOT=${uploadsRoot}`] : []),
    'BANKING_ENCRYPTION_ACTIVE_KEY_VERSION=local-v1',
    `BANKING_ENCRYPTION_KEYS=${JSON.stringify({ 'local-v1': deterministicKey })}`,
    extra,
    '',
  ].join('\n');
}

function validWebContent(extra = '') {
  return ['FRONTEND_URL=http://localhost:3000', extra, ''].join('\n');
}

async function fixture() {
  const rootDirectory = await mkdtemp(
    path.join(os.tmpdir(), 'badminton-local-env-')
  );
  await mkdir(path.join(rootDirectory, 'apps/api'), { recursive: true });
  await mkdir(path.join(rootDirectory, 'apps/web'), { recursive: true });
  await copyFile(
    path.join(repositoryRoot, 'apps/api/.env.example'),
    path.join(rootDirectory, 'apps/api/.env.example')
  );
  await copyFile(
    path.join(repositoryRoot, 'apps/web/.env.example'),
    path.join(rootDirectory, 'apps/web/.env.example')
  );
  await execFileAsync('git', ['init', '--quiet'], { cwd: rootDirectory });
  return {
    rootDirectory,
    apiPath: path.join(rootDirectory, 'apps/api/.env.local'),
    webPath: path.join(rootDirectory, 'apps/web/.env.local'),
  };
}

async function withFixture(run) {
  const testFixture = await fixture();
  try {
    await run(testFixture);
  } finally {
    await rm(testFixture.rootDirectory, { recursive: true, force: true });
  }
}

async function linkedWorktreeFixture({
  primaryApiContent = validApiContent({
    mongoUri: 'mongodb://localhost:27019/linked?replicaSet=rs0',
  }),
  primaryWebContent = validWebContent(),
} = {}) {
  const testFixture = await fixture();
  const { rootDirectory, apiPath, webPath } = testFixture;
  await mkdir(path.join(rootDirectory, '.repo-tools/scripts'), {
    recursive: true,
  });
  await copyFile(
    scriptPath,
    path.join(rootDirectory, '.repo-tools/scripts/bootstrap-local-env.mjs')
  );
  await writeFile(
    path.join(rootDirectory, 'package.json'),
    JSON.stringify({
      private: true,
      type: 'module',
      scripts: {
        'bootstrap:local-env':
          'node .repo-tools/scripts/bootstrap-local-env.mjs',
      },
    })
  );
  await writeFile(
    path.join(rootDirectory, '.gitignore'),
    'apps/api/.env.local\napps/web/.env.local\n'
  );
  await execFileAsync('git', ['add', '.'], { cwd: rootDirectory });
  await execFileAsync(
    'git',
    [
      '-c',
      'user.name=Bootstrap Test',
      '-c',
      'user.email=bootstrap@example.test',
      'commit',
      '--quiet',
      '-m',
      'fixture',
    ],
    { cwd: rootDirectory }
  );
  if (primaryApiContent !== null) {
    await writeFile(apiPath, primaryApiContent, { mode: 0o600 });
  }
  if (primaryWebContent !== null) {
    await writeFile(webPath, primaryWebContent, { mode: 0o600 });
  }

  const targetRoot = `${rootDirectory}-linked`;
  await execFileAsync(
    'git',
    ['worktree', 'add', '--quiet', '-b', 'linked-test', targetRoot],
    { cwd: rootDirectory }
  );
  return {
    ...testFixture,
    targetRoot,
    targetApiPath: path.join(targetRoot, 'apps/api/.env.local'),
    targetWebPath: path.join(targetRoot, 'apps/web/.env.local'),
  };
}

async function withLinkedWorktreeFixture(options, run) {
  const testFixture = await linkedWorktreeFixture(options);
  try {
    await run(testFixture);
  } finally {
    await execFileAsync(
      'git',
      ['worktree', 'remove', '--force', testFixture.targetRoot],
      { cwd: testFixture.rootDirectory }
    );
    await rm(testFixture.rootDirectory, { recursive: true, force: true });
  }
}

test('the root command and package-local examples expose one bootstrap owner', async () => {
  const packageJson = JSON.parse(
    await readFile(path.join(repositoryRoot, 'package.json'), 'utf8')
  );
  const rootExample = await readFile(
    path.join(repositoryRoot, '.env.example'),
    'utf8'
  );
  const apiExample = await readFile(
    path.join(repositoryRoot, 'apps/api/.env.example'),
    'utf8'
  );
  const webExample = await readFile(
    path.join(repositoryRoot, 'apps/web/.env.example'),
    'utf8'
  );

  assert.equal(
    packageJson.scripts['bootstrap:local-env'],
    'node .repo-tools/scripts/bootstrap-local-env.mjs'
  );
  assert.match(rootExample, /apps\/api\/\.env\.example/u);
  assert.match(rootExample, /apps\/web\/\.env\.example/u);
  assert.doesNotMatch(rootExample, /^MONGODB_URI=/mu);
  assert.doesNotMatch(rootExample, /^FRONTEND_URL=/mu);
  assert.equal(parseEnv(apiExample).MONGODB_URI.includes('27018'), true);
  assert.equal(parseEnv(apiExample).FRONTEND_URL, 'http://localhost:3000');
  assert.equal(parseEnv(webExample).FRONTEND_URL, 'http://localhost:3000');
  assert.equal(parseEnv(webExample).API_URL, undefined);
  assert.equal(parseEnv(webExample).NEXT_PUBLIC_API_URL, undefined);
});

test('fresh bootstrap creates only required values with owner-only permissions', async () => {
  await withFixture(async ({ rootDirectory, apiPath, webPath }) => {
    const results = await bootstrapLocalEnvironment({
      rootDirectory,
      randomBytesImpl: () => Buffer.alloc(32, 11),
    });
    const apiContent = await readFile(apiPath, 'utf8');
    const webContent = await readFile(webPath, 'utf8');
    const apiEnvironment = parseEnv(apiContent);

    assert.deepEqual(results, [
      { packageName: 'API', status: 'created' },
      { packageName: 'Web', status: 'created' },
    ]);
    assert.deepEqual(Object.keys(apiEnvironment).sort(), [
      'BANKING_ENCRYPTION_ACTIVE_KEY_VERSION',
      'BANKING_ENCRYPTION_KEYS',
      'DEVELOPMENT_PUBLIC_UPLOADS_ROOT',
      'FRONTEND_URL',
      'MONGODB_URI',
    ]);
    validateApiEnvironment(apiContent);
    validateWebEnvironment(webContent);
    assert.equal(parseEnv(webContent).FRONTEND_URL, 'http://localhost:3000');
    if (process.platform !== 'win32') {
      assert.equal((await stat(apiPath)).mode & 0o777, 0o600);
      assert.equal((await stat(webPath)).mode & 0o777, 0o600);
    }
  });
});

test('the actual CLI creates a fresh fixture and prints only safe statuses', async () => {
  await withFixture(async ({ rootDirectory, apiPath }) => {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [scriptPath],
      {
        cwd: rootDirectory,
      }
    );
    const apiEnvironment = parseEnv(await readFile(apiPath, 'utf8'));
    const serializedKeys = apiEnvironment.BANKING_ENCRYPTION_KEYS;

    assert.equal(stderr, '');
    assert.match(stdout, /^API local environment: created$/mu);
    assert.match(stdout, /^Web local environment: created$/mu);
    assert.doesNotMatch(stdout, /mongodb:\/\//u);
    assert.doesNotMatch(stdout, /localhost:3000/u);
    assert.doesNotMatch(
      stdout,
      new RegExp(serializedKeys.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), 'u')
    );
  });
});

test('idempotent rerun preserves both files byte for byte', async () => {
  await withFixture(async ({ rootDirectory, apiPath, webPath }) => {
    await bootstrapLocalEnvironment({ rootDirectory });
    const originalApi = await readFile(apiPath, 'utf8');
    const originalWeb = await readFile(webPath, 'utf8');
    let generated = false;

    const results = await bootstrapLocalEnvironment({
      rootDirectory,
      randomBytesImpl: () => {
        generated = true;
        return Buffer.alloc(32, 12);
      },
    });

    assert.deepEqual(results, [
      { packageName: 'API', status: 'preserved' },
      { packageName: 'Web', status: 'preserved' },
    ]);
    assert.equal(generated, false);
    assert.equal(await readFile(apiPath, 'utf8'), originalApi);
    assert.equal(await readFile(webPath, 'utf8'), originalWeb);
  });
});

test('runtime-valid unpadded banking key material is preserved', async () => {
  await withFixture(async ({ rootDirectory, apiPath, webPath }) => {
    assert.equal(Buffer.from(runtimeAcceptedUnpaddedKey, 'base64').length, 32);
    const apiContent = validApiContent().replace(
      deterministicKey,
      runtimeAcceptedUnpaddedKey
    );
    const webContent = validWebContent();
    await writeFile(apiPath, apiContent);
    await writeFile(webPath, webContent);

    const results = await bootstrapLocalEnvironment({ rootDirectory });

    assert.deepEqual(results, [
      { packageName: 'API', status: 'upgraded' },
      { packageName: 'Web', status: 'preserved' },
    ]);
    assert.equal(
      parseEnv(await readFile(apiPath, 'utf8')).BANKING_ENCRYPTION_KEYS,
      parseEnv(apiContent).BANKING_ENCRYPTION_KEYS
    );
  });
});

test('one missing file is created while its valid sibling is preserved', async () => {
  await withFixture(async ({ rootDirectory, apiPath, webPath }) => {
    const existingApi = validApiContent({
      extra: 'SMTP_FROM=local@example.test',
    });
    await writeFile(apiPath, existingApi, { mode: 0o600 });

    await bootstrapLocalEnvironment({ rootDirectory });

    const upgradedApi = parseEnv(await readFile(apiPath, 'utf8'));
    assert.equal(upgradedApi.MONGODB_URI, parseEnv(existingApi).MONGODB_URI);
    assert.equal(upgradedApi.SMTP_FROM, 'local@example.test');
    assert.equal(
      upgradedApi.DEVELOPMENT_PUBLIC_UPLOADS_ROOT,
      path.join(await realpath(rootDirectory), 'apps/api/uploads')
    );
    validateWebEnvironment(await readFile(webPath, 'utf8'));
  });
});

test('committed example preflight completes before either missing file is written', async () => {
  await withFixture(async ({ rootDirectory, apiPath, webPath }) => {
    await writeFile(
      path.join(rootDirectory, 'apps/web/.env.example'),
      'FRONTEND_URL=not-an-origin\n'
    );

    await assert.rejects(
      bootstrapLocalEnvironment({ rootDirectory }),
      /Web local environment is blocked/u
    );
    await assert.rejects(readFile(apiPath), { code: 'ENOENT' });
    await assert.rejects(readFile(webPath), { code: 'ENOENT' });
  });
});

for (const [name, apiContent] of [
  ['missing MONGODB_URI', validApiContent().replace(/^MONGODB_URI=.*\n/mu, '')],
  [
    'missing banking configuration',
    'MONGODB_URI=mongodb://localhost/local\nFRONTEND_URL=http://localhost:3000\n',
  ],
  [
    'malformed banking JSON',
    validApiContent().replace(
      /^BANKING_ENCRYPTION_KEYS=.*$/mu,
      'BANKING_ENCRYPTION_KEYS={broken'
    ),
  ],
  [
    'invalid banking key length',
    validApiContent().replace(
      deterministicKey,
      Buffer.alloc(31, 7).toString('base64')
    ),
  ],
]) {
  test(`invalid existing API (${name}) blocks before writing a missing Web sibling`, async () => {
    await withFixture(async ({ rootDirectory, apiPath, webPath }) => {
      await writeFile(apiPath, apiContent);

      await assert.rejects(
        bootstrapLocalEnvironment({ rootDirectory }),
        /API local environment is blocked/u
      );
      assert.equal(await readFile(apiPath, 'utf8'), apiContent);
      await assert.rejects(readFile(webPath), { code: 'ENOENT' });
    });
  });
}

for (const [name, webContent] of [
  ['missing FRONTEND_URL', 'API_URL=http://localhost:3003\n'],
  ['non-HTTP origin', 'FRONTEND_URL=ftp://localhost\n'],
  ['origin with a path', 'FRONTEND_URL=http://localhost:3000/path\n'],
]) {
  test(`invalid existing Web (${name}) blocks before writing a missing API sibling`, async () => {
    await withFixture(async ({ rootDirectory, apiPath, webPath }) => {
      await writeFile(webPath, webContent);

      await assert.rejects(
        bootstrapLocalEnvironment({ rootDirectory }),
        /Web local environment is blocked/u
      );
      assert.equal(await readFile(webPath, 'utf8'), webContent);
      await assert.rejects(readFile(apiPath), { code: 'ENOENT' });
    });
  });
}

test('intentional provider selection and unrelated optional values are preserved', async () => {
  await withFixture(async ({ rootDirectory, apiPath, webPath }) => {
    const apiContent = validApiContent({
      mongoUri: 'mongodb://localhost:27019/local?replicaSet=rs0',
      extra: 'SMTP_FROM=local@example.test\nMEMBERSHIP_AUDIT_SALT=local-only',
    });
    const webContent = validWebContent(
      'NEXT_PUBLIC_API_URL=http://localhost:3999/api'
    );
    await writeFile(apiPath, apiContent);
    await writeFile(webPath, webContent);

    await bootstrapLocalEnvironment({ rootDirectory });

    const upgradedApi = parseEnv(await readFile(apiPath, 'utf8'));
    assert.equal(upgradedApi.MONGODB_URI, parseEnv(apiContent).MONGODB_URI);
    assert.equal(upgradedApi.SMTP_FROM, 'local@example.test');
    assert.equal(upgradedApi.MEMBERSHIP_AUDIT_SALT, 'local-only');
    assert.equal(
      upgradedApi.DEVELOPMENT_PUBLIC_UPLOADS_ROOT,
      path.join(await realpath(rootDirectory), 'apps/api/uploads')
    );
    assert.equal(await readFile(webPath, 'utf8'), webContent);
  });
});

test('a valid create race is re-read and preserved without replacement', async () => {
  await withFixture(async ({ rootDirectory, apiPath }) => {
    const racedApiContent = validApiContent({
      mongoUri: 'mongodb://localhost:27019/raced?replicaSet=rs0',
      uploadsRoot: path.join(await realpath(rootDirectory), 'apps/api/uploads'),
    });
    const writeFileImpl = async (filePath, content, options) => {
      if (filePath === apiPath) {
        await writeFile(filePath, racedApiContent, { mode: 0o600 });
        const error = new Error('simulated race');
        error.code = 'EEXIST';
        throw error;
      }
      return writeFile(filePath, content, options);
    };

    const results = await bootstrapLocalEnvironment({
      rootDirectory,
      writeFileImpl,
    });

    assert.deepEqual(results[0], {
      packageName: 'API',
      status: 'preserved',
    });
    assert.equal(await readFile(apiPath, 'utf8'), racedApiContent);
  });
});

test('an invalid create race blocks without replacing raced content', async () => {
  await withFixture(async ({ rootDirectory, apiPath, webPath }) => {
    const racedApiContent = 'MONGODB_URI=partial\n';
    const writeFileImpl = async (filePath, content, options) => {
      if (filePath === apiPath) {
        await writeFile(filePath, racedApiContent, { mode: 0o600 });
        const error = new Error('simulated race');
        error.code = 'EEXIST';
        throw error;
      }
      return writeFile(filePath, content, options);
    };

    await assert.rejects(
      bootstrapLocalEnvironment({ rootDirectory, writeFileImpl }),
      /API local environment is blocked/u
    );
    assert.equal(await readFile(apiPath, 'utf8'), racedApiContent);
    await assert.rejects(readFile(webPath), { code: 'ENOENT' });
  });
});

test('real linked-worktree bootstrap reuses primary identity and establishes the shared root', async () => {
  const primaryApiContent = validApiContent({
    mongoUri: 'mongodb://localhost:27019/linked?replicaSet=rs0',
  });
  const primaryWebContent = validWebContent(
    'NEXT_PUBLIC_API_URL=http://localhost:3999/api'
  );
  await withLinkedWorktreeFixture(
    { primaryApiContent, primaryWebContent },
    async ({ rootDirectory, targetRoot, targetApiPath, targetWebPath }) => {
      const { stdout, stderr } = await execFileAsync(
        'pnpm',
        ['bootstrap:local-env'],
        { cwd: targetRoot }
      );

      const targetApi = parseEnv(await readFile(targetApiPath, 'utf8'));
      assert.equal(
        targetApi.MONGODB_URI,
        parseEnv(primaryApiContent).MONGODB_URI
      );
      assert.equal(
        targetApi.BANKING_ENCRYPTION_KEYS,
        parseEnv(primaryApiContent).BANKING_ENCRYPTION_KEYS
      );
      assert.equal(
        targetApi.DEVELOPMENT_PUBLIC_UPLOADS_ROOT,
        path.join(await realpath(rootDirectory), 'apps/api/uploads')
      );
      assert.equal(await readFile(targetWebPath, 'utf8'), primaryWebContent);
      assert.equal(stderr, '');
      assert.match(stdout, /^API local environment: copied$/mu);
      assert.match(stdout, /^Web local environment: copied$/mu);
      assert.doesNotMatch(stdout, /mongodb:\/\//u);
      assert.doesNotMatch(stdout, /localhost:3999/u);
      assert.doesNotMatch(stdout, new RegExp(deterministicKey, 'u'));
      assert.equal(
        parseEnv(await readFile(targetApiPath, 'utf8')).MONGODB_URI.includes(
          '27019'
        ),
        true
      );
    }
  );
});

test('linked bootstrap preserves a different configured database and blocks before copying its sibling', async () => {
  await withLinkedWorktreeFixture(
    {},
    async ({ targetRoot, targetApiPath, targetWebPath, webPath }) => {
      const intentionalTargetApi = validApiContent({
        mongoUri: 'mongodb://localhost:27018/intentional?replicaSet=rs0',
        extra: 'SMTP_FROM=target@example.test',
      });
      await writeFile(targetApiPath, intentionalTargetApi, { mode: 0o600 });

      await assert.rejects(
        execFileAsync('pnpm', ['bootstrap:local-env'], { cwd: targetRoot }),
        /configured MONGODB_URI differs from the primary local environment/u
      );

      assert.equal(await readFile(targetApiPath, 'utf8'), intentionalTargetApi);
      await assert.rejects(readFile(targetWebPath), { code: 'ENOENT' });
      assert.equal(typeof (await readFile(webPath, 'utf8')), 'string');
    }
  );
});

test('a missing primary prerequisite blocks linked bootstrap before any target write', async () => {
  await withLinkedWorktreeFixture(
    { primaryWebContent: null },
    async ({ targetRoot, targetApiPath, targetWebPath }) => {
      await assert.rejects(
        execFileAsync('pnpm', ['bootstrap:local-env'], { cwd: targetRoot }),
        (error) => {
          assert.equal(error.code, 1);
          assert.match(
            error.stderr,
            /configured primary source apps\/web\/\.env\.local is missing/u
          );
          assert.match(error.stderr, /separate explicit authorization/u);
          assert.doesNotMatch(error.stderr, /mongodb:\/\//u);
          return true;
        }
      );
      await assert.rejects(readFile(targetApiPath), { code: 'ENOENT' });
      await assert.rejects(readFile(targetWebPath), { code: 'ENOENT' });
    }
  );
});

test('an invalid primary prerequisite blocks linked bootstrap without changing source or target', async () => {
  const invalidPrimaryApi = 'MONGODB_URI=partial\n';
  await withLinkedWorktreeFixture(
    { primaryApiContent: invalidPrimaryApi },
    async ({ apiPath, targetRoot, targetApiPath, targetWebPath }) => {
      await assert.rejects(
        execFileAsync('pnpm', ['bootstrap:local-env'], { cwd: targetRoot }),
        /configured primary source apps\/api\/\.env\.local is invalid/u
      );
      assert.equal(await readFile(apiPath, 'utf8'), invalidPrimaryApi);
      await assert.rejects(readFile(targetApiPath), { code: 'ENOENT' });
      await assert.rejects(readFile(targetWebPath), { code: 'ENOENT' });
    }
  );
});

test('an invalid existing linked target blocks before copying a missing sibling', async () => {
  await withLinkedWorktreeFixture(
    {},
    async ({ targetRoot, targetApiPath, targetWebPath }) => {
      const invalidTargetApi = 'MONGODB_URI=partial\n';
      await writeFile(targetApiPath, invalidTargetApi);

      await assert.rejects(
        execFileAsync('pnpm', ['bootstrap:local-env'], { cwd: targetRoot }),
        /API local environment is blocked/u
      );
      assert.equal(await readFile(targetApiPath, 'utf8'), invalidTargetApi);
      await assert.rejects(readFile(targetWebPath), { code: 'ENOENT' });
    }
  );
});

test('validation-only remains target-local and non-mutating in a linked worktree', async () => {
  await withLinkedWorktreeFixture(
    {},
    async ({ targetRoot, targetApiPath, targetWebPath }) => {
      await assert.rejects(
        execFileAsync('pnpm', ['bootstrap:local-env', '--validate-only'], {
          cwd: targetRoot,
        }),
        (error) => {
          assert.equal(error.code, 1);
          assert.match(error.stderr, /missing \.env\.local/u);
          assert.match(error.stderr, /--validate-only/u);
          return true;
        }
      );
      await assert.rejects(readFile(targetApiPath), { code: 'ENOENT' });
      await assert.rejects(readFile(targetWebPath), { code: 'ENOENT' });
    }
  );
});

test('an established primary upload root is preserved byte for byte', async () => {
  await withFixture(async ({ rootDirectory, apiPath, webPath }) => {
    const apiContent = validApiContent({
      uploadsRoot: path.join(await realpath(rootDirectory), 'apps/api/uploads'),
      extra: 'SMTP_FROM=local@example.test',
    });
    await writeFile(apiPath, apiContent, { mode: 0o600 });
    await writeFile(webPath, validWebContent(), { mode: 0o600 });

    const results = await bootstrapLocalEnvironment({ rootDirectory });

    assert.deepEqual(results, [
      { packageName: 'API', status: 'preserved' },
      { packageName: 'Web', status: 'preserved' },
    ]);
    assert.equal(await readFile(apiPath, 'utf8'), apiContent);
  });
});

test('a same-database linked API receives only the missing shared root', async () => {
  await withLinkedWorktreeFixture(
    {},
    async ({ rootDirectory, targetRoot, targetApiPath, targetWebPath }) => {
      const targetApi = validApiContent({
        mongoUri: 'mongodb://localhost:27019/linked?replicaSet=rs0',
        extra: 'SMTP_FROM=target@example.test',
      });
      await writeFile(targetApiPath, targetApi, { mode: 0o600 });
      await writeFile(targetWebPath, validWebContent(), { mode: 0o600 });

      const results = await bootstrapLocalEnvironment({
        rootDirectory: targetRoot,
      });
      const upgraded = parseEnv(await readFile(targetApiPath, 'utf8'));

      assert.deepEqual(results, [
        { packageName: 'API', status: 'upgraded' },
        { packageName: 'Web', status: 'preserved' },
      ]);
      assert.equal(upgraded.MONGODB_URI, parseEnv(targetApi).MONGODB_URI);
      assert.equal(upgraded.SMTP_FROM, 'target@example.test');
      assert.equal(
        upgraded.DEVELOPMENT_PUBLIC_UPLOADS_ROOT,
        path.join(await realpath(rootDirectory), 'apps/api/uploads')
      );
      if (process.platform !== 'win32') {
        assert.equal((await stat(targetApiPath)).mode & 0o777, 0o600);
      }
    }
  );
});

test('a conflicting linked upload root is preserved and blocks before sibling writes', async () => {
  await withLinkedWorktreeFixture(
    {},
    async ({ targetRoot, targetApiPath, targetWebPath }) => {
      const targetApi = validApiContent({
        mongoUri: 'mongodb://localhost:27019/linked?replicaSet=rs0',
        uploadsRoot: '/tmp/unrelated-uploads',
      });
      await writeFile(targetApiPath, targetApi, { mode: 0o600 });

      await assert.rejects(
        bootstrapLocalEnvironment({ rootDirectory: targetRoot }),
        /DEVELOPMENT_PUBLIC_UPLOADS_ROOT is invalid or conflicts/u
      );
      assert.equal(await readFile(targetApiPath, 'utf8'), targetApi);
      await assert.rejects(readFile(targetWebPath), { code: 'ENOENT' });
    }
  );
});

test('the bounded root upgrade refuses a concurrent file change', async () => {
  await withFixture(async ({ rootDirectory, apiPath, webPath }) => {
    const originalApi = validApiContent();
    const changedApi = validApiContent({
      extra: 'SMTP_FROM=changed@example.test',
    });
    await writeFile(apiPath, originalApi, { mode: 0o600 });
    await writeFile(webPath, validWebContent(), { mode: 0o600 });
    let apiReads = 0;
    const readFileImpl = async (...args) => {
      if (args[0] === apiPath && ++apiReads === 2) return changedApi;
      return readFile(...args);
    };

    await assert.rejects(
      bootstrapLocalEnvironment({ rootDirectory, readFileImpl }),
      /changed concurrently before the shared-root upgrade/u
    );
    assert.equal(await readFile(apiPath, 'utf8'), originalApi);
  });
});

test('linked managed upload content blocks root conversion without mutation', async () => {
  await withLinkedWorktreeFixture(
    {},
    async ({ targetRoot, targetApiPath, targetWebPath }) => {
      const retainedFile = path.join(
        targetRoot,
        'apps/api/uploads/.staging/contact-qr/owner/file.png'
      );
      await mkdir(path.dirname(retainedFile), { recursive: true });
      await writeFile(retainedFile, 'retained');

      await assert.rejects(
        bootstrapLocalEnvironment({ rootDirectory: targetRoot }),
        /retained public uploads would be hidden/u
      );
      assert.equal(await readFile(retainedFile, 'utf8'), 'retained');
      await assert.rejects(readFile(targetApiPath), { code: 'ENOENT' });
      await assert.rejects(readFile(targetWebPath), { code: 'ENOENT' });
    }
  );
});

test('validation-only checks linked database and shared-root identity without writes', async () => {
  await withLinkedWorktreeFixture(
    {},
    async ({ rootDirectory, targetRoot, targetApiPath, targetWebPath }) => {
      const targetApi = validApiContent({
        mongoUri: 'mongodb://localhost:27019/linked?replicaSet=rs0',
        uploadsRoot: path.join(
          await realpath(rootDirectory),
          'apps/api/uploads'
        ),
      });
      const targetWeb = validWebContent();
      await writeFile(targetApiPath, targetApi, { mode: 0o600 });
      await writeFile(targetWebPath, targetWeb, { mode: 0o600 });

      const results = await bootstrapLocalEnvironment({
        rootDirectory: targetRoot,
        validateOnly: true,
      });

      assert.deepEqual(results, [
        { packageName: 'API', status: 'preserved' },
        { packageName: 'Web', status: 'preserved' },
      ]);
      assert.equal(await readFile(targetApiPath, 'utf8'), targetApi);
      assert.equal(await readFile(targetWebPath, 'utf8'), targetWeb);
    }
  );
});
