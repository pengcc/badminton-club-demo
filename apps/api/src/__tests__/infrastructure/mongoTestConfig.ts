import { randomUUID } from 'node:crypto';

export type MongoTestServerMode = 'native' | 'testcontainers';

export interface MongoTestServerContext {
  serverMode: MongoTestServerMode;
  serverUri: string;
}

export const MONGO_TEST_CONTEXT_KEY = 'mongoTestServer';
export const MONGO_TEST_DATABASE_PATTERN =
  /^club_[a-z0-9_]+_test_[a-f0-9]{32}$/;
const MAX_MONGO_DATABASE_NAME_LENGTH = 63;
const DATABASE_NAME_FIXED_LENGTH = 'club__test_'.length + 32;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const MONGO_TEST_ENVIRONMENT_KEYS = [
  'MONGO_TEST_SERVER_MODE',
  'MONGO_TEST_NATIVE_URI',
] as const;

export function applyLoadedMongoTestEnvironment(
  environment: NodeJS.ProcessEnv,
  loadedEnvironment: Record<string, string>
) {
  for (const key of MONGO_TEST_ENVIRONMENT_KEYS) {
    if (
      environment[key] === undefined &&
      loadedEnvironment[key] !== undefined
    ) {
      environment[key] = loadedEnvironment[key];
    }
  }
}

export function resolveMongoTestServerMode(
  environment: NodeJS.ProcessEnv = process.env
): MongoTestServerMode {
  const serverMode = environment.MONGO_TEST_SERVER_MODE;
  if (serverMode === 'native' || serverMode === 'testcontainers') {
    return serverMode;
  }

  throw new Error(
    'MONGO_TEST_SERVER_MODE must be set explicitly to "testcontainers" or "native"'
  );
}

function getSingleCaseInsensitiveParameter(url: URL, expectedName: string) {
  const values = [...url.searchParams.entries()].filter(
    ([name]) => name.toLowerCase() === expectedName.toLowerCase()
  );
  if (values.length !== 1 || values[0]?.[0] !== expectedName) return undefined;
  return values[0][1];
}

export function validateNativeMongoServerUri(rawUri: string | undefined) {
  if (!rawUri) {
    throw new Error(
      'MONGO_TEST_NATIVE_URI is required for native Mongo test server mode'
    );
  }

  let uri: URL;
  try {
    uri = new URL(rawUri);
  } catch {
    throw new Error('MONGO_TEST_NATIVE_URI is not a valid MongoDB URI');
  }

  if (uri.protocol !== 'mongodb:') {
    throw new Error(
      'native MongoDB URI must use the direct mongodb:// protocol'
    );
  }
  if (uri.host.includes(',') || !LOOPBACK_HOSTS.has(uri.hostname)) {
    throw new Error(
      'native MongoDB URI must contain exactly one loopback host'
    );
  }
  if (uri.pathname !== '' && uri.pathname !== '/') {
    throw new Error(
      'native MongoDB URI must be server-level and name no database'
    );
  }
  if (getSingleCaseInsensitiveParameter(uri, 'directConnection') !== 'true') {
    throw new Error(
      'native MongoDB URI must set directConnection=true exactly once'
    );
  }
  const replicaSet = getSingleCaseInsensitiveParameter(uri, 'replicaSet');
  if (!replicaSet) {
    throw new Error('native MongoDB URI must name one replicaSet exactly once');
  }
  if (getSingleCaseInsensitiveParameter(uri, 'loadBalanced') !== undefined) {
    throw new Error('native MongoDB URI must not enable loadBalanced mode');
  }

  return { replicaSet, serverUri: uri.toString() };
}

export function createMongoTestDatabaseName(suiteIdentifier: string) {
  const suite = suiteIdentifier
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!suite) throw new Error('Mongo test suite identifier must not be empty');

  const boundedSuite = suite.slice(
    0,
    MAX_MONGO_DATABASE_NAME_LENGTH - DATABASE_NAME_FIXED_LENGTH
  );
  const databaseName = `club_${boundedSuite}_test_${randomUUID().replaceAll('-', '')}`;
  if (!MONGO_TEST_DATABASE_PATTERN.test(databaseName)) {
    throw new Error(
      'Generated Mongo test database name is outside the owned pattern'
    );
  }
  return databaseName;
}

export function buildMongoTestDatabaseUri(
  verifiedServerUri: string,
  databaseName: string
) {
  if (!MONGO_TEST_DATABASE_PATTERN.test(databaseName)) {
    throw new Error(
      `Refusing unowned Mongo test database name: ${databaseName}`
    );
  }
  const uri = new URL(verifiedServerUri);
  uri.pathname = `/${databaseName}`;
  return uri.toString();
}

export function assertMongoTestDatabaseOwnership(
  expectedDatabaseName: string,
  connectedDatabaseName: string | undefined
) {
  if (
    !MONGO_TEST_DATABASE_PATTERN.test(expectedDatabaseName) ||
    connectedDatabaseName !== expectedDatabaseName
  ) {
    throw new Error(
      `Refusing destructive Mongo test work: expected owned database ${expectedDatabaseName}, connected to ${connectedDatabaseName ?? 'none'}`
    );
  }
}
