import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertActiveVitestTestTarget,
  assertConnectedDatabase,
  assertConnectedMongoTarget,
  assertDisposableFileTargets,
  assertDisposableMongoTarget,
  sanitizeResetDiagnostic,
} from '../../scripts/destructiveResetSafety';
import { assertRetainedPublicUploadResetAllowed } from '../../scripts/seedData';

const temporaryRoots: string[] = [];

async function temporaryRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true }))
  );
});

describe('destructive MongoDB reset target safety', () => {
  it('accepts only the reserved direct loopback development target', () => {
    expect(
      assertDisposableMongoTarget(
        'mongodb://localhost:27017/badminton-club-demo-dev?directConnection=true',
        { kind: 'operator' },
        'development',
        undefined
      )
    ).toEqual({
      kind: 'operator',
      expectedDatabaseName: 'badminton-club-demo-dev',
      topology: { kind: 'standalone' },
    });
    expect(
      assertDisposableMongoTarget(
        'mongodb://127.0.0.1:27017/badminton-club-demo-dev',
        { kind: 'operator' },
        'development',
        undefined
      )
    ).toEqual({
      kind: 'operator',
      expectedDatabaseName: 'badminton-club-demo-dev',
      topology: { kind: 'standalone' },
    });
  });

  it('accepts only one direct loopback replica-set target shape', () => {
    expect(
      assertDisposableMongoTarget(
        'mongodb://localhost:27017/badminton-club-demo-dev?ReplicaSet=rs0&DirectConnection=true',
        { kind: 'operator' },
        'development',
        undefined
      )
    ).toEqual({
      kind: 'operator',
      expectedDatabaseName: 'badminton-club-demo-dev',
      topology: { kind: 'replica-set', replicaSetName: 'rs0' },
    });
  });

  it.each([
    ['legacy name', 'mongodb://localhost:27017/badminton-club'],
    ['missing name', 'mongodb://localhost:27017/'],
    ['remote host', 'mongodb://db.example.test:27017/badminton-club-demo-dev'],
    ['SRV', 'mongodb+srv://db.example.test/badminton-club-demo-dev'],
    [
      'multiple hosts',
      'mongodb://localhost:27017,127.0.0.1:27018/badminton-club-demo-dev',
    ],
    [
      'replica set without direct connection',
      'mongodb://localhost:27017/badminton-club-demo-dev?replicaSet=rs0',
    ],
    [
      'duplicate replica-set option',
      'mongodb://localhost:27017/badminton-club-demo-dev?replicaSet=rs0&ReplicaSet=rs0&directConnection=true',
    ],
    [
      'conflicting direct-connection option',
      'mongodb://localhost:27017/badminton-club-demo-dev?replicaSet=rs0&directConnection=true&directConnection=false',
    ],
    [
      'load balanced',
      'mongodb://localhost:27017/badminton-club-demo-dev?loadBalanced=true',
    ],
  ])('refuses %s without exposing the target', (_case, uri) => {
    expect(() =>
      assertDisposableMongoTarget(
        uri,
        { kind: 'operator' },
        'development',
        undefined
      )
    ).toThrow('Destructive reset refused');
  });

  it('requires exact active-run test and connected database agreement', () => {
    const target = {
      kind: 'test' as const,
      expectedDatabaseName: 'reset_contract_test_0123456789abcdef',
    };
    expect(
      assertDisposableMongoTarget(
        'mongodb://127.0.0.1:27017/reset_contract_test_0123456789abcdef?directConnection=true',
        target,
        'test',
        'true'
      )
    ).toEqual({
      kind: 'test',
      expectedDatabaseName: target.expectedDatabaseName,
      topology: { kind: 'standalone' },
    });
    expect(() => assertActiveVitestTestTarget(target, undefined)).toThrow(
      'active repository Vitest run'
    );
    expect(() =>
      assertDisposableMongoTarget(
        'mongodb://127.0.0.1:27017/other_test_0123456789abcdef',
        target,
        'test',
        'true'
      )
    ).toThrow('URI database does not match');
    expect(
      assertDisposableMongoTarget(
        'mongodb://127.0.0.1:27017/reset_contract_test_0123456789abcdef?replicaSet=rs0&directConnection=true',
        target,
        'test',
        'true'
      )
    ).toEqual({
      kind: 'test',
      expectedDatabaseName: target.expectedDatabaseName,
      topology: { kind: 'replica-set', replicaSetName: 'rs0' },
    });
    expect(() =>
      assertConnectedDatabase('another_database', target.expectedDatabaseName)
    ).toThrow('connected database does not match');
  });

  it('refuses missing targets and production-mode operator reset', () => {
    expect(() =>
      assertDisposableMongoTarget(
        '',
        { kind: 'operator' },
        'development',
        undefined
      )
    ).toThrow('direct mongodb://');
    expect(() =>
      assertDisposableMongoTarget(
        'mongodb://localhost:27017/badminton-club-demo-dev',
        { kind: 'operator' },
        'production',
        undefined
      )
    ).toThrow('development environment');
  });

  it('requires live standalone topology evidence after URI approval', () => {
    const approvedTarget = assertDisposableMongoTarget(
      'mongodb://localhost:27017/badminton-club-demo-dev?directConnection=true',
      { kind: 'operator' },
      'development',
      undefined
    );

    expect(() =>
      assertConnectedMongoTarget({
        connectedDatabaseName: 'badminton-club-demo-dev',
        approvedTarget,
        hello: { isWritablePrimary: true },
      })
    ).not.toThrow();
    expect(() =>
      assertConnectedMongoTarget({
        connectedDatabaseName: 'badminton-club-demo-dev',
        approvedTarget,
        hello: {
          setName: 'rs0',
          isWritablePrimary: true,
          primary: 'mongo:27017',
          me: 'mongo:27017',
        },
      })
    ).toThrow('standalone target has replica-set evidence');
    expect(() =>
      assertConnectedMongoTarget({
        connectedDatabaseName: 'badminton-club-demo-dev',
        approvedTarget,
        hello: { msg: 'isdbgrid' },
      })
    ).toThrow('not a direct MongoDB server');
  });

  it.each([
    [
      'missing hello evidence',
      undefined,
      {
        config: {
          _id: 'rs0',
          members: [{ host: 'mongo:27017' }],
        },
      },
    ],
    [
      'mismatched hello set name',
      {
        setName: 'other',
        isWritablePrimary: true,
        primary: 'mongo:27017',
        me: 'mongo:27017',
      },
      {
        config: {
          _id: 'rs0',
          members: [{ host: 'mongo:27017' }],
        },
      },
    ],
    [
      'non-writable member',
      {
        setName: 'rs0',
        isWritablePrimary: false,
        primary: 'mongo:27017',
        me: 'mongo:27017',
      },
      {
        config: {
          _id: 'rs0',
          members: [{ host: 'mongo:27017' }],
        },
      },
    ],
    [
      'inconsistent primary and member identity',
      {
        setName: 'rs0',
        isWritablePrimary: true,
        primary: 'primary:27017',
        me: 'member:27017',
      },
      {
        config: {
          _id: 'rs0',
          members: [{ host: 'member:27017' }],
        },
      },
    ],
    [
      'mongos marker',
      {
        setName: 'rs0',
        isWritablePrimary: true,
        primary: 'mongo:27017',
        me: 'mongo:27017',
        msg: 'isdbgrid',
      },
      {
        config: {
          _id: 'rs0',
          members: [{ host: 'mongo:27017' }],
        },
      },
    ],
    [
      'load-balanced marker',
      {
        setName: 'rs0',
        isWritablePrimary: true,
        primary: 'mongo:27017',
        me: 'mongo:27017',
        serviceId: 'service',
      },
      {
        config: {
          _id: 'rs0',
          members: [{ host: 'mongo:27017' }],
        },
      },
    ],
    [
      'missing replica-set configuration',
      {
        setName: 'rs0',
        isWritablePrimary: true,
        primary: 'mongo:27017',
        me: 'mongo:27017',
      },
      undefined,
    ],
    [
      'mismatched configuration set name',
      {
        setName: 'rs0',
        isWritablePrimary: true,
        primary: 'mongo:27017',
        me: 'mongo:27017',
      },
      {
        config: {
          _id: 'other',
          members: [{ host: 'mongo:27017' }],
        },
      },
    ],
    [
      'hidden second member',
      {
        setName: 'rs0',
        isWritablePrimary: true,
        primary: 'mongo:27017',
        me: 'mongo:27017',
      },
      {
        config: {
          _id: 'rs0',
          members: [
            { host: 'mongo:27017' },
            { host: 'hidden:27017', hidden: true },
          ],
        },
      },
    ],
    [
      'hidden sole member',
      {
        setName: 'rs0',
        isWritablePrimary: true,
        primary: 'mongo:27017',
        me: 'mongo:27017',
      },
      {
        config: {
          _id: 'rs0',
          members: [{ host: 'mongo:27017', hidden: true }],
        },
      },
    ],
    [
      'arbiter sole member',
      {
        setName: 'rs0',
        isWritablePrimary: true,
        primary: 'mongo:27017',
        me: 'mongo:27017',
      },
      {
        config: {
          _id: 'rs0',
          members: [{ host: 'mongo:27017', arbiterOnly: true }],
        },
      },
    ],
    [
      'configured member with different identity',
      {
        setName: 'rs0',
        isWritablePrimary: true,
        primary: 'mongo:27017',
        me: 'mongo:27017',
      },
      {
        config: {
          _id: 'rs0',
          members: [{ host: 'other:27017' }],
        },
      },
    ],
  ])('refuses replica-set %s', (_case, hello, replicaSetConfiguration) => {
    const approvedTarget = assertDisposableMongoTarget(
      'mongodb://localhost:27017/badminton-club-demo-dev?replicaSet=rs0&directConnection=true',
      { kind: 'operator' },
      'development',
      undefined
    );

    expect(() =>
      assertConnectedMongoTarget({
        connectedDatabaseName: 'badminton-club-demo-dev',
        approvedTarget,
        hello,
        replicaSetConfiguration,
      })
    ).toThrow('Destructive reset refused');
  });

  it('accepts a fully proven one-member replica-set target', () => {
    const approvedTarget = assertDisposableMongoTarget(
      'mongodb://localhost:27017/badminton-club-demo-dev?replicaSet=rs0&directConnection=true',
      { kind: 'operator' },
      'development',
      undefined
    );

    expect(() =>
      assertConnectedMongoTarget({
        connectedDatabaseName: 'badminton-club-demo-dev',
        approvedTarget,
        hello: {
          setName: 'rs0',
          isWritablePrimary: true,
          primary: 'mongo:27017',
          me: 'mongo:27017',
        },
        replicaSetConfiguration: {
          config: {
            _id: 'rs0',
            members: [
              { host: 'mongo:27017', hidden: false, arbiterOnly: false },
            ],
          },
        },
      })
    ).not.toThrow();
  });

  it('redacts credential-bearing MongoDB targets from diagnostics', () => {
    const credentialBearingTarget = [
      'mongodb',
      '://',
      'user',
      ':',
      'secret',
      '@remote.example/db?',
      'token',
      '=',
      'secret',
    ].join('');
    const diagnostic = sanitizeResetDiagnostic(
      new Error(`failed ${credentialBearingTarget}`)
    );
    expect(diagnostic).not.toContain('user');
    expect(diagnostic).not.toContain('secret');
    expect(diagnostic).toContain('[redacted MongoDB target]');
  });
});

describe('destructive file reset target safety', () => {
  it('accepts the repository-owned operator uploads namespace', async () => {
    const apiDirectory = path.resolve('.');
    await expect(
      assertDisposableFileTargets({
        target: { kind: 'operator' },
        apiDirectory,
        activityUploadsRoot: path.join(apiDirectory, 'uploads'),
        contactUploadsRoot: path.join(apiDirectory, 'uploads'),
        publicDocumentUploadsRoot: path.join(apiDirectory, 'uploads'),
      })
    ).resolves.toBeUndefined();
  });

  it('accepts explicit active-run temporary upload roots', async () => {
    const uploadsRoot = await temporaryRoot(
      'club-reset_contract_test_0123456789abcdef-'
    );
    await expect(
      assertDisposableFileTargets({
        target: {
          kind: 'test',
          expectedDatabaseName: 'reset_contract_test_0123456789abcdef',
        },
        apiDirectory: path.resolve('apps/api'),
        activityUploadsRoot: uploadsRoot,
        contactUploadsRoot: uploadsRoot,
        publicDocumentUploadsRoot: uploadsRoot,
      })
    ).resolves.toBeUndefined();
  });

  it('refuses a linked checkout reset against a sibling shared root', async () => {
    const linkedApiDirectory = path.resolve('linked/apps/api');
    const primaryUploadsRoot = path.resolve('primary/apps/api/uploads');

    await expect(
      assertDisposableFileTargets({
        target: { kind: 'operator' },
        apiDirectory: linkedApiDirectory,
        activityUploadsRoot: primaryUploadsRoot,
        contactUploadsRoot: primaryUploadsRoot,
        publicDocumentUploadsRoot: primaryUploadsRoot,
      })
    ).rejects.toThrow('operator reset may use only the API uploads root');
  });

  it('refuses file-affecting reset in alternate database mode', () => {
    expect(() =>
      assertRetainedPublicUploadResetAllowed({
        resetsFiles: true,
        alternateDevelopmentDatabase: true,
      })
    ).toThrow('retained public uploads are not coherent');
    expect(() =>
      assertRetainedPublicUploadResetAllowed({
        resetsFiles: false,
        alternateDevelopmentDatabase: true,
      })
    ).not.toThrow();
  });

  it('refuses a symlinked owner namespace without changing its target', async () => {
    const uploadsRoot = await temporaryRoot(
      'club-reset_contract_test_0123456789abcdef-symlink-'
    );
    const externalRoot = await temporaryRoot('external-reset-sentinel-');
    const sentinel = path.join(externalRoot, 'sentinel.txt');
    await writeFile(sentinel, 'keep');
    await mkdir(uploadsRoot, { recursive: true });
    await symlink(externalRoot, path.join(uploadsRoot, 'public-documents'));

    await expect(
      assertDisposableFileTargets({
        target: {
          kind: 'test',
          expectedDatabaseName: 'reset_contract_test_0123456789abcdef',
        },
        apiDirectory: path.resolve('apps/api'),
        activityUploadsRoot: uploadsRoot,
        contactUploadsRoot: uploadsRoot,
        publicDocumentUploadsRoot: uploadsRoot,
      })
    ).rejects.toThrow('symbolic link');
    await expect(writeFile(sentinel, 'still-safe')).resolves.toBeUndefined();
  });
});
