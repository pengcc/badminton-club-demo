import { isIP } from 'node:net';
import { lstat, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DEVELOPMENT_DATABASE = 'badminton-club-demo-dev';
const TEST_DATABASE_PATTERN = /^[a-z][a-z0-9_]*_test_[a-f0-9]{8,}$/;
const RESET_NAMESPACES = [
  'activities',
  'contact-qr',
  'public-documents',
  path.join('.staging', 'activities'),
  path.join('.staging', 'contact-qr'),
  path.join('.staging', 'public-documents'),
] as const;

export type DestructiveResetTarget =
  | { kind: 'operator' }
  | { kind: 'test'; expectedDatabaseName: string };

type OperatorMongoTopology =
  | { kind: 'standalone' }
  | { kind: 'replica-set'; replicaSetName: string };

export type ApprovedMongoResetTarget =
  | {
      kind: 'operator';
      expectedDatabaseName: string;
      topology: OperatorMongoTopology;
    }
  | {
      kind: 'test';
      expectedDatabaseName: string;
      topology: OperatorMongoTopology;
    };

interface ParsedMongoTarget {
  databaseName: string;
  topology: OperatorMongoTopology;
}

export function assertActiveVitestTestTarget(
  target: Extract<DestructiveResetTarget, { kind: 'test' }>,
  vitestRun: string | undefined
): void {
  if (vitestRun !== 'true') {
    throw safetyError('test reset requires an active repository Vitest run');
  }
  if (!TEST_DATABASE_PATTERN.test(target.expectedDatabaseName)) {
    throw safetyError(
      'the expected test database is not active-run disposable'
    );
  }
}

function safetyError(reason: string): Error {
  return new Error(`Destructive reset refused: ${reason}`);
}

function getSingleTopologyOption(
  query: URLSearchParams,
  optionName: string
): string | undefined {
  const values = [...query.entries()]
    .filter(([key]) => key.toLowerCase() === optionName.toLowerCase())
    .map(([, value]) => value);

  if (values.length > 1) {
    throw safetyError(`${optionName} must appear exactly once`);
  }
  if (values[0] !== undefined && !values[0].trim()) {
    throw safetyError(`${optionName} cannot be empty`);
  }
  return values[0];
}

function parseDirectMongoTarget(uri: string): ParsedMongoTarget {
  if (!uri.startsWith('mongodb://')) {
    throw safetyError('the target must use a direct mongodb:// connection');
  }

  const remainder = uri.slice('mongodb://'.length);
  const slashIndex = remainder.indexOf('/');
  if (slashIndex < 0) {
    throw safetyError('the target must include an explicit database name');
  }
  const authority = remainder.slice(0, slashIndex);
  const pathAndQuery = remainder.slice(slashIndex + 1);
  const hostList = authority.slice(authority.lastIndexOf('@') + 1);
  if (!hostList || hostList.includes(',')) {
    throw safetyError('exactly one direct loopback host is required');
  }

  const queryIndex = pathAndQuery.indexOf('?');
  const databasePart =
    queryIndex < 0 ? pathAndQuery : pathAndQuery.slice(0, queryIndex);
  let databaseName: string;
  try {
    databaseName = decodeURIComponent(databasePart);
  } catch {
    throw safetyError('the database name is invalid');
  }
  if (!databaseName || databaseName.includes('/')) {
    throw safetyError('the target must include one explicit database name');
  }

  const query = new URLSearchParams(
    queryIndex < 0 ? '' : pathAndQuery.slice(queryIndex + 1)
  );
  const replicaSetName = getSingleTopologyOption(query, 'replicaSet');
  const loadBalanced = getSingleTopologyOption(query, 'loadBalanced');
  const directConnection = getSingleTopologyOption(query, 'directConnection');
  if (loadBalanced !== undefined) {
    throw safetyError('load-balanced targets are not allowed');
  }
  if (directConnection && directConnection.toLowerCase() !== 'true') {
    throw safetyError('directConnection cannot be disabled');
  }
  if (replicaSetName && directConnection?.toLowerCase() !== 'true') {
    throw safetyError(
      'replica-set targets require explicit directConnection=true'
    );
  }

  const bracketedIpv6 = hostList.match(/^\[([^\]]+)](?::\d+)?$/);
  const host = bracketedIpv6 ? bracketedIpv6[1] : hostList.replace(/:\d+$/, '');
  const ipVersion = isIP(host);
  const loopback =
    host.toLowerCase() === 'localhost' ||
    (ipVersion === 4 && host.startsWith('127.')) ||
    (ipVersion === 6 && host === '::1');
  if (!loopback) {
    throw safetyError('the target host is not loopback');
  }

  return {
    databaseName,
    topology: replicaSetName
      ? { kind: 'replica-set', replicaSetName }
      : { kind: 'standalone' },
  };
}

export function assertDisposableMongoTarget(
  uri: string,
  target: DestructiveResetTarget,
  nodeEnvironment: string | undefined,
  vitestRun: string | undefined
): ApprovedMongoResetTarget {
  const parsed = parseDirectMongoTarget(uri);
  if (target.kind === 'operator') {
    if (nodeEnvironment !== 'development') {
      throw safetyError('operator reset requires the development environment');
    }
    if (parsed.databaseName !== DEVELOPMENT_DATABASE) {
      throw safetyError(
        `operator reset requires database ${DEVELOPMENT_DATABASE}`
      );
    }
    return {
      kind: 'operator',
      expectedDatabaseName: DEVELOPMENT_DATABASE,
      topology: parsed.topology,
    };
  }

  if (nodeEnvironment !== 'test') {
    throw safetyError('test reset requires an active repository Vitest run');
  }
  assertActiveVitestTestTarget(target, vitestRun);
  if (parsed.databaseName !== target.expectedDatabaseName) {
    throw safetyError(
      'the URI database does not match the active-run test target'
    );
  }
  return {
    kind: 'test',
    expectedDatabaseName: target.expectedDatabaseName,
    topology: parsed.topology,
  };
}

export function assertConnectedDatabase(
  connectedDatabaseName: string | undefined,
  expectedDatabaseName: string
): void {
  if (connectedDatabaseName !== expectedDatabaseName) {
    throw safetyError(
      'the connected database does not match the approved target'
    );
  }
}

function asRecord(value: unknown, reason: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw safetyError(reason);
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, reason: string): string {
  if (typeof value !== 'string' || !value) {
    throw safetyError(reason);
  }
  return value;
}

function assertNoRouterOrLoadBalancedEvidence(
  hello: Record<string, unknown>
): void {
  if (
    hello.isdbgrid === true ||
    hello.msg === 'isdbgrid' ||
    hello.loadBalanced === true ||
    Object.hasOwn(hello, 'serviceId')
  ) {
    throw safetyError('the connected target is not a direct MongoDB server');
  }
}

function assertStandaloneHello(hello: unknown): void {
  const evidence = asRecord(hello, 'live MongoDB topology evidence is missing');
  assertNoRouterOrLoadBalancedEvidence(evidence);
  if (Object.hasOwn(evidence, 'setName')) {
    throw safetyError('standalone target has replica-set evidence');
  }
}

function assertReplicaSetHelloAndConfiguration(input: {
  topology: Extract<OperatorMongoTopology, { kind: 'replica-set' }>;
  hello: unknown;
  replicaSetConfiguration: unknown;
}): void {
  const hello = asRecord(
    input.hello,
    'live MongoDB topology evidence is missing'
  );
  assertNoRouterOrLoadBalancedEvidence(hello);

  const liveSetName = requiredString(
    hello.setName,
    'the live replica-set name is missing'
  );
  if (liveSetName !== input.topology.replicaSetName) {
    throw safetyError('the live replica-set name does not match the URI');
  }
  if (hello.isWritablePrimary !== true) {
    throw safetyError(
      'the connected replica-set member is not writable primary'
    );
  }

  const primary = requiredString(
    hello.primary,
    'the live replica-set primary identity is missing'
  );
  const self = requiredString(
    hello.me,
    'the live replica-set member identity is missing'
  );
  if (primary !== self) {
    throw safetyError(
      'the connected replica-set member does not match primary'
    );
  }

  const configurationResponse = asRecord(
    input.replicaSetConfiguration,
    'the replica-set configuration is unavailable'
  );
  const configuration = asRecord(
    configurationResponse.config,
    'the replica-set configuration is unavailable'
  );
  const configurationSetName = requiredString(
    configuration._id,
    'the replica-set configuration name is missing'
  );
  if (configurationSetName !== input.topology.replicaSetName) {
    throw safetyError(
      'the replica-set configuration name does not match the URI'
    );
  }
  if (
    !Array.isArray(configuration.members) ||
    configuration.members.length !== 1
  ) {
    throw safetyError(
      'the replica-set must contain exactly one configured member'
    );
  }

  const member = asRecord(
    configuration.members[0],
    'the replica-set member configuration is invalid'
  );
  if (
    (member.hidden !== undefined && member.hidden !== false) ||
    (member.arbiterOnly !== undefined && member.arbiterOnly !== false)
  ) {
    throw safetyError('the configured replica-set member is not writable');
  }
  const memberHost = requiredString(
    member.host,
    'the configured replica-set member identity is missing'
  );
  if (memberHost !== primary || memberHost !== self) {
    throw safetyError(
      'the configured replica-set member does not match live identity'
    );
  }
}

export function assertConnectedMongoTarget(input: {
  connectedDatabaseName: string | undefined;
  approvedTarget: ApprovedMongoResetTarget;
  hello?: unknown;
  replicaSetConfiguration?: unknown;
}): void {
  assertConnectedDatabase(
    input.connectedDatabaseName,
    input.approvedTarget.expectedDatabaseName
  );
  if (input.approvedTarget.topology.kind === 'standalone') {
    assertStandaloneHello(input.hello);
    return;
  }

  assertReplicaSetHelloAndConfiguration({
    topology: input.approvedTarget.topology,
    hello: input.hello,
    replicaSetConfiguration: input.replicaSetConfiguration,
  });
}

function isContained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (!relative.startsWith('..') && !path.isAbsolute(relative))
  );
}

async function assertNonLinkingPath(
  anchor: string,
  candidate: string
): Promise<void> {
  const resolvedAnchor = path.resolve(anchor);
  const resolvedCandidate = path.resolve(candidate);
  if (!isContained(resolvedAnchor, resolvedCandidate)) {
    throw safetyError('a reset-owned file target is outside its approved root');
  }

  const realAnchor = await realpath(resolvedAnchor);
  const relative = path.relative(resolvedAnchor, resolvedCandidate);
  let current = resolvedAnchor;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    try {
      const status = await lstat(current);
      if (status.isSymbolicLink()) {
        throw safetyError(
          'a reset-owned file target traverses a symbolic link'
        );
      }
      const canonical = await realpath(current);
      if (!isContained(realAnchor, canonical)) {
        throw safetyError(
          'a reset-owned file target escapes its approved root'
        );
      }
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
  }
}

export async function assertDisposableFileTargets(input: {
  target: DestructiveResetTarget;
  apiDirectory: string;
  activityUploadsRoot: string;
  contactUploadsRoot: string;
  publicDocumentUploadsRoot: string;
}): Promise<void> {
  const roots = [
    input.activityUploadsRoot,
    input.contactUploadsRoot,
    input.publicDocumentUploadsRoot,
  ];
  const anchor =
    input.target.kind === 'operator'
      ? input.apiDirectory
      : path.resolve(tmpdir());
  const expectedOperatorRoot = path.resolve(input.apiDirectory, 'uploads');

  for (const root of new Set(
    roots.map((candidate) => path.resolve(candidate))
  )) {
    if (input.target.kind === 'operator' && root !== expectedOperatorRoot) {
      throw safetyError('operator reset may use only the API uploads root');
    }
    if (
      input.target.kind === 'test' &&
      (!isContained(anchor, root) ||
        !path.basename(root).startsWith('club-') ||
        !path.basename(root).includes(input.target.expectedDatabaseName))
    ) {
      throw safetyError(
        'test upload roots must be active-run temporary directories'
      );
    }

    await assertNonLinkingPath(anchor, root);
    for (const namespace of RESET_NAMESPACES) {
      await assertNonLinkingPath(anchor, path.join(root, namespace));
    }
  }
}

export function sanitizeResetDiagnostic(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown failure';
  return message.replace(
    /mongodb(?:\+srv)?:\/\/\S+/gi,
    '[redacted MongoDB target]'
  );
}
