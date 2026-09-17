import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv, promisify } from 'node:util';

const LOCAL_KEY_VERSION = 'local-v1';
const FILE_MODE = 0o600;
const execFileAsync = promisify(execFile);

class LocalEnvironmentError extends Error {
  constructor(
    packageName,
    reason,
    recovery = "Repair or replace that package's local-only .env.local file explicitly, then rerun pnpm bootstrap:local-env."
  ) {
    super(
      `${packageName} local environment is blocked: ${reason}. ` + recovery
    );
    this.name = 'LocalEnvironmentError';
    this.packageName = packageName;
    this.reason = reason;
  }

  forValidationOnly() {
    return new LocalEnvironmentError(
      this.packageName,
      this.reason,
      "Repair or replace that package's local-only .env.local file explicitly, then rerun pnpm bootstrap:local-env --validate-only."
    );
  }
}

class WorktreeContextError extends Error {
  constructor(reason) {
    super(
      `Local environment bootstrap could not establish the Git worktree context: ${reason}. ` +
        'Verify the repository worktree state explicitly, then rerun pnpm bootstrap:local-env.'
    );
    this.name = 'WorktreeContextError';
  }
}

function parseWorktreeList(output) {
  const records = [];
  let currentRecord = {};

  for (const field of output.split('\0')) {
    if (field === '') {
      if (Object.keys(currentRecord).length > 0) {
        records.push(currentRecord);
        currentRecord = {};
      }
      continue;
    }

    const separator = field.indexOf(' ');
    const key = separator === -1 ? field : field.slice(0, separator);
    const value = separator === -1 ? true : field.slice(separator + 1);
    if (Object.hasOwn(currentRecord, key)) {
      throw new WorktreeContextError(
        `git worktree list returned a duplicate ${key} field`
      );
    }
    currentRecord[key] = value;
  }

  if (Object.keys(currentRecord).length > 0) records.push(currentRecord);
  if (records.length === 0 || typeof records[0].worktree !== 'string') {
    throw new WorktreeContextError(
      'git worktree list did not identify a primary worktree'
    );
  }
  if (records.some((record) => typeof record.worktree !== 'string')) {
    throw new WorktreeContextError(
      'git worktree list returned a malformed worktree record'
    );
  }

  return records;
}

async function resolveWorktreeContext(
  rootDirectory,
  { execFileImpl = execFileAsync, realpathImpl = realpath } = {}
) {
  let currentTopLevel;
  let worktreeOutput;
  try {
    ({ stdout: currentTopLevel } = await execFileImpl(
      'git',
      ['rev-parse', '--show-toplevel'],
      { cwd: rootDirectory, encoding: 'utf8' }
    ));
    ({ stdout: worktreeOutput } = await execFileImpl(
      'git',
      ['worktree', 'list', '--porcelain', '-z'],
      { cwd: rootDirectory, encoding: 'utf8' }
    ));
  } catch {
    throw new WorktreeContextError(
      'the current directory is not a readable Git worktree'
    );
  }

  const records = parseWorktreeList(worktreeOutput);
  let currentDirectory;
  let requestedDirectory;
  let primaryDirectory;
  try {
    currentDirectory = await realpathImpl(currentTopLevel.trim());
    requestedDirectory = await realpathImpl(rootDirectory);
    primaryDirectory = await realpathImpl(records[0].worktree);
  } catch {
    throw new WorktreeContextError(
      'the current or primary worktree path is inaccessible'
    );
  }

  if (currentDirectory !== requestedDirectory) {
    throw new WorktreeContextError(
      'pnpm bootstrap:local-env must run from the Git worktree root'
    );
  }

  const representedPaths = [];
  for (const record of records) {
    try {
      representedPaths.push(await realpathImpl(record.worktree));
    } catch {
      // An unrelated stale linked-worktree path does not make the current
      // worktree ambiguous. Git remains the owner of pruning that record.
    }
  }
  if (!representedPaths.includes(currentDirectory)) {
    throw new WorktreeContextError(
      'the current worktree is absent from git worktree list'
    );
  }

  return { currentDirectory, primaryDirectory };
}

function parseEnvironment(packageName, content) {
  try {
    return parseEnv(content);
  } catch {
    throw new LocalEnvironmentError(
      packageName,
      'the file is not valid dotenv syntax'
    );
  }
}

function requireValue(environment, key, packageName) {
  const value = environment[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new LocalEnvironmentError(packageName, `missing ${key}`);
  }
  return value;
}

function validateBankingKeys(environment, packageName) {
  const activeVersion = requireValue(
    environment,
    'BANKING_ENCRYPTION_ACTIVE_KEY_VERSION',
    packageName
  );
  const serializedKeys = requireValue(
    environment,
    'BANKING_ENCRYPTION_KEYS',
    packageName
  );

  let keys;
  try {
    keys = JSON.parse(serializedKeys);
  } catch {
    throw new LocalEnvironmentError(
      packageName,
      'BANKING_ENCRYPTION_KEYS must be a JSON object'
    );
  }

  if (!keys || Array.isArray(keys) || typeof keys !== 'object') {
    throw new LocalEnvironmentError(
      packageName,
      'BANKING_ENCRYPTION_KEYS must be a JSON object'
    );
  }
  if (typeof keys[activeVersion] !== 'string') {
    throw new LocalEnvironmentError(
      packageName,
      'the active banking key version is absent from BANKING_ENCRYPTION_KEYS'
    );
  }

  for (const [version, encodedKey] of Object.entries(keys)) {
    if (
      version === '' ||
      typeof encodedKey !== 'string' ||
      Buffer.from(encodedKey, 'base64').length !== 32
    ) {
      throw new LocalEnvironmentError(
        packageName,
        'every banking key must decode to 32 bytes'
      );
    }
  }
}

export function validateApiEnvironment(
  content,
  { expectedUploadsRoot, expectedMongoUri } = {}
) {
  const packageName = 'API';
  const environment = parseEnvironment(packageName, content);
  const mongoUri = requireValue(environment, 'MONGODB_URI', packageName);
  requireValue(environment, 'FRONTEND_URL', packageName);
  validateBankingKeys(environment, packageName);
  if (expectedMongoUri !== undefined && mongoUri !== expectedMongoUri) {
    throw new LocalEnvironmentError(
      packageName,
      'configured MONGODB_URI differs from the primary local environment',
      'Align this worktree with the primary configured development database, then rerun pnpm bootstrap:local-env.'
    );
  }
  if (expectedUploadsRoot !== undefined) {
    const configuredRoot = requireValue(
      environment,
      'DEVELOPMENT_PUBLIC_UPLOADS_ROOT',
      packageName
    );
    if (
      !path.isAbsolute(configuredRoot) ||
      path.resolve(configuredRoot) !== expectedUploadsRoot
    ) {
      throw new LocalEnvironmentError(
        packageName,
        'DEVELOPMENT_PUBLIC_UPLOADS_ROOT is invalid or conflicts with the primary retained upload root'
      );
    }
  }
}

export function validateWebEnvironment(content) {
  const packageName = 'Web';
  const environment = parseEnvironment(packageName, content);
  const rawOrigin = requireValue(environment, 'FRONTEND_URL', packageName);

  let origin;
  try {
    origin = new URL(rawOrigin);
  } catch {
    throw new LocalEnvironmentError(
      packageName,
      'FRONTEND_URL must be an HTTP(S) origin'
    );
  }
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    (origin.pathname !== '' && origin.pathname !== '/')
  ) {
    throw new LocalEnvironmentError(
      packageName,
      'FRONTEND_URL must be an HTTP(S) origin without credentials, query, hash, or path'
    );
  }
}

function apiContentFromExample(
  exampleContent,
  randomBytesImpl,
  developmentPublicUploadsRoot
) {
  const environment = parseEnvironment('API example', exampleContent);
  const mongoUri = requireValue(environment, 'MONGODB_URI', 'API example');
  const frontendUrl = requireValue(environment, 'FRONTEND_URL', 'API example');
  const encodedKey = randomBytesImpl(32).toString('base64');

  const content = [
    `MONGODB_URI=${mongoUri}`,
    `FRONTEND_URL=${frontendUrl}`,
    `DEVELOPMENT_PUBLIC_UPLOADS_ROOT=${developmentPublicUploadsRoot}`,
    `BANKING_ENCRYPTION_ACTIVE_KEY_VERSION=${LOCAL_KEY_VERSION}`,
    `BANKING_ENCRYPTION_KEYS=${JSON.stringify({ [LOCAL_KEY_VERSION]: encodedKey })}`,
    '',
  ].join('\n');
  validateApiEnvironment(content, {
    expectedUploadsRoot: developmentPublicUploadsRoot,
  });
  return content;
}

function webContentFromExample(exampleContent) {
  const environment = parseEnvironment('Web example', exampleContent);
  const frontendUrl = requireValue(environment, 'FRONTEND_URL', 'Web example');
  const content = `FRONTEND_URL=${frontendUrl}\n`;
  validateWebEnvironment(content);
  return content;
}

async function readIfPresent(filePath, readFileImpl) {
  try {
    return await readFileImpl(filePath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw error;
  }
}

function appendDevelopmentPublicUploadsRoot(content, uploadsRoot) {
  return `${content.endsWith('\n') ? content : `${content}\n`}DEVELOPMENT_PUBLIC_UPLOADS_ROOT=${uploadsRoot}\n`;
}

async function directoryContainsContent(directory, readdirImpl) {
  let entries;
  try {
    entries = await readdirImpl(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) return true;
    if (
      await directoryContainsContent(
        path.join(directory, entry.name),
        readdirImpl
      )
    ) {
      return true;
    }
  }
  return false;
}

async function assertNoLinkedManagedUploadContent(rootDirectory, readdirImpl) {
  const uploadsRoot = path.join(rootDirectory, 'apps/api/uploads');
  const managedDirectories = [
    ...['activities', 'contact-qr', 'public-documents'].map((namespace) =>
      path.join(uploadsRoot, namespace)
    ),
    ...['activities', 'contact-qr', 'public-documents'].map((namespace) =>
      path.join(uploadsRoot, '.staging', namespace)
    ),
  ];
  for (const directory of managedDirectories) {
    if (await directoryContainsContent(directory, readdirImpl)) {
      throw new LocalEnvironmentError(
        'API',
        'linked-worktree retained public uploads would be hidden by the shared-root upgrade',
        'Reconcile the retained files explicitly before rerunning pnpm bootstrap:local-env; no files were copied, moved, or deleted.'
      );
    }
  }
}

async function createOrValidate({
  packageName,
  filePath,
  content,
  validate,
  readFileImpl,
  writeFileImpl,
  createdStatus = 'created',
}) {
  try {
    await writeFileImpl(filePath, content, {
      encoding: 'utf8',
      flag: 'wx',
      mode: FILE_MODE,
    });
    return createdStatus;
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const racedContent = await readIfPresent(filePath, readFileImpl);
    if (racedContent === undefined) {
      throw new LocalEnvironmentError(
        packageName,
        'the file changed concurrently and could not be verified'
      );
    }
    validate(racedContent);
    return 'preserved';
  }
}

export async function bootstrapLocalEnvironment({
  rootDirectory = process.cwd(),
  readFileImpl = readFile,
  writeFileImpl = writeFile,
  readdirImpl = readdir,
  randomBytesImpl = randomBytes,
  resolveWorktreeContextImpl = resolveWorktreeContext,
  validateOnly = false,
} = {}) {
  const worktreeContext = await resolveWorktreeContextImpl(rootDirectory);
  const isLinkedWorktree =
    worktreeContext.currentDirectory !== worktreeContext.primaryDirectory;
  const developmentPublicUploadsRoot = path.resolve(
    worktreeContext.primaryDirectory,
    'apps/api/uploads'
  );
  const primaryApiPath = path.join(
    worktreeContext.primaryDirectory,
    'apps/api/.env.local'
  );
  const primaryApiContent = isLinkedWorktree
    ? await readIfPresent(primaryApiPath, readFileImpl)
    : undefined;
  let primaryMongoUri;
  if (isLinkedWorktree) {
    if (primaryApiContent === undefined) {
      throw new LocalEnvironmentError(
        'API',
        'the configured primary source apps/api/.env.local is missing',
        'Establish or repair that primary source only with separate explicit authorization, then rerun pnpm bootstrap:local-env in this linked worktree.'
      );
    }
    try {
      validateApiEnvironment(primaryApiContent);
      const primaryEnvironment = parseEnvironment('API', primaryApiContent);
      primaryMongoUri = requireValue(primaryEnvironment, 'MONGODB_URI', 'API');
      const primaryRoot = primaryEnvironment.DEVELOPMENT_PUBLIC_UPLOADS_ROOT;
      if (
        primaryRoot !== undefined &&
        (!path.isAbsolute(primaryRoot) ||
          path.resolve(primaryRoot) !== developmentPublicUploadsRoot)
      ) {
        throw new LocalEnvironmentError(
          'API',
          'the configured primary source apps/api/.env.local has a conflicting DEVELOPMENT_PUBLIC_UPLOADS_ROOT'
        );
      }
    } catch (error) {
      if (!(error instanceof LocalEnvironmentError)) throw error;
      throw new LocalEnvironmentError(
        'API',
        `the configured primary source apps/api/.env.local is invalid (${error.reason})`,
        'Repair that primary source only with separate explicit authorization, then rerun pnpm bootstrap:local-env in this linked worktree.'
      );
    }
  }
  const packages = [
    {
      packageName: 'API',
      localPath: path.join(rootDirectory, 'apps/api/.env.local'),
      relativeLocalPath: 'apps/api/.env.local',
      examplePath: path.join(rootDirectory, 'apps/api/.env.example'),
      validate: (content) =>
        validateApiEnvironment(content, {
          expectedUploadsRoot: developmentPublicUploadsRoot,
          ...(isLinkedWorktree ? { expectedMongoUri: primaryMongoUri } : {}),
        }),
      validateBase: validateApiEnvironment,
      buildContent: (example) =>
        apiContentFromExample(
          example,
          randomBytesImpl,
          developmentPublicUploadsRoot
        ),
    },
    {
      packageName: 'Web',
      localPath: path.join(rootDirectory, 'apps/web/.env.local'),
      relativeLocalPath: 'apps/web/.env.local',
      examplePath: path.join(rootDirectory, 'apps/web/.env.example'),
      validate: validateWebEnvironment,
      validateBase: validateWebEnvironment,
      buildContent: webContentFromExample,
    },
  ];

  const state = [];
  for (const packageConfig of packages) {
    const existingContent = await readIfPresent(
      packageConfig.localPath,
      readFileImpl
    );
    let newContent;
    let upgradedContent;
    if (existingContent !== undefined) {
      try {
        packageConfig.validateBase(existingContent);
        if (packageConfig.packageName === 'API') {
          const environment = parseEnvironment('API', existingContent);
          if (!environment.DEVELOPMENT_PUBLIC_UPLOADS_ROOT) {
            if (validateOnly) {
              throw new LocalEnvironmentError(
                'API',
                'missing DEVELOPMENT_PUBLIC_UPLOADS_ROOT'
              );
            }
            if (isLinkedWorktree) {
              validateApiEnvironment(existingContent, {
                expectedMongoUri: primaryMongoUri,
              });
              await assertNoLinkedManagedUploadContent(
                rootDirectory,
                readdirImpl
              );
            }
            upgradedContent = appendDevelopmentPublicUploadsRoot(
              existingContent,
              developmentPublicUploadsRoot
            );
            packageConfig.validate(upgradedContent);
          } else {
            packageConfig.validate(existingContent);
          }
        } else {
          packageConfig.validate(existingContent);
        }
      } catch (error) {
        if (validateOnly && error instanceof LocalEnvironmentError) {
          throw error.forValidationOnly();
        }
        throw error;
      }
    } else if (validateOnly) {
      throw new LocalEnvironmentError(
        packageConfig.packageName,
        'missing .env.local',
        'Create or exact-copy that package file explicitly, then rerun pnpm bootstrap:local-env --validate-only.'
      );
    } else if (isLinkedWorktree) {
      const primaryPath = path.join(
        worktreeContext.primaryDirectory,
        packageConfig.relativeLocalPath
      );
      let primaryContent;
      try {
        primaryContent = await readIfPresent(primaryPath, readFileImpl);
      } catch {
        throw new LocalEnvironmentError(
          packageConfig.packageName,
          `the configured primary source ${packageConfig.relativeLocalPath} is inaccessible`,
          'Restore access to that primary source only with separate explicit authorization, then rerun pnpm bootstrap:local-env in this linked worktree.'
        );
      }
      if (primaryContent === undefined) {
        throw new LocalEnvironmentError(
          packageConfig.packageName,
          `the configured primary source ${packageConfig.relativeLocalPath} is missing`,
          'Establish or repair that primary source only with separate explicit authorization, then rerun pnpm bootstrap:local-env in this linked worktree.'
        );
      }
      try {
        packageConfig.validateBase(primaryContent);
        if (
          packageConfig.packageName === 'API' &&
          parseEnvironment('API', primaryContent)
            .DEVELOPMENT_PUBLIC_UPLOADS_ROOT
        ) {
          packageConfig.validate(primaryContent);
        }
      } catch (error) {
        if (!(error instanceof LocalEnvironmentError)) throw error;
        throw new LocalEnvironmentError(
          packageConfig.packageName,
          `the configured primary source ${packageConfig.relativeLocalPath} is invalid (${error.reason})`,
          'Repair that primary source only with separate explicit authorization, then rerun pnpm bootstrap:local-env in this linked worktree.'
        );
      }
      newContent =
        packageConfig.packageName === 'API' &&
        !parseEnvironment('API', primaryContent).DEVELOPMENT_PUBLIC_UPLOADS_ROOT
          ? appendDevelopmentPublicUploadsRoot(
              primaryContent,
              developmentPublicUploadsRoot
            )
          : primaryContent;
      if (packageConfig.packageName === 'API') {
        await assertNoLinkedManagedUploadContent(rootDirectory, readdirImpl);
        packageConfig.validate(newContent);
      }
    } else {
      const exampleContent = await readFileImpl(
        packageConfig.examplePath,
        'utf8'
      );
      newContent = packageConfig.buildContent(exampleContent);
    }
    state.push({ packageConfig, existingContent, newContent, upgradedContent });
  }

  const results = [];
  for (const {
    packageConfig,
    existingContent,
    newContent,
    upgradedContent,
  } of state) {
    if (existingContent !== undefined) {
      if (upgradedContent !== undefined) {
        const currentContent = await readIfPresent(
          packageConfig.localPath,
          readFileImpl
        );
        if (currentContent !== existingContent) {
          throw new LocalEnvironmentError(
            packageConfig.packageName,
            'the file changed concurrently before the shared-root upgrade'
          );
        }
        await writeFileImpl(packageConfig.localPath, upgradedContent, {
          encoding: 'utf8',
          flag: 'r+',
        });
        results.push({
          packageName: packageConfig.packageName,
          status: 'upgraded',
        });
        continue;
      }
      results.push({
        packageName: packageConfig.packageName,
        status: 'preserved',
      });
      continue;
    }
    const status = await createOrValidate({
      packageName: packageConfig.packageName,
      filePath: packageConfig.localPath,
      content: newContent,
      validate: packageConfig.validate,
      readFileImpl,
      writeFileImpl,
      createdStatus: isLinkedWorktree ? 'copied' : 'created',
    });
    results.push({ packageName: packageConfig.packageName, status });
  }

  for (const packageConfig of packages) {
    const finalContent = await readIfPresent(
      packageConfig.localPath,
      readFileImpl
    );
    if (finalContent === undefined) {
      throw new LocalEnvironmentError(
        packageConfig.packageName,
        'the file was absent after bootstrap completed'
      );
    }
    packageConfig.validate(finalContent);
  }

  return results;
}

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  try {
    const cliArguments = process.argv.slice(2);
    const validateOnly =
      cliArguments.length === 1 && cliArguments[0] === '--validate-only';
    if (cliArguments.length > 0 && !validateOnly) {
      throw new Error('unsupported bootstrap arguments');
    }
    const results = await bootstrapLocalEnvironment({ validateOnly });
    for (const result of results) {
      process.stdout.write(
        `${result.packageName} local environment: ${result.status}\n`
      );
    }
  } catch (error) {
    const message =
      error instanceof LocalEnvironmentError ||
      error instanceof WorktreeContextError
        ? error.message
        : 'Local environment bootstrap failed before readiness could be established.';
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
