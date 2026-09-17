import { describe, expect, it } from 'vitest';
import {
  applyLoadedMongoTestEnvironment,
  assertMongoTestDatabaseOwnership,
  buildMongoTestDatabaseUri,
  createMongoTestDatabaseName,
  MONGO_TEST_DATABASE_PATTERN,
  resolveMongoTestServerMode,
  validateNativeMongoServerUri,
} from './mongoTestConfig';

describe('Mongo persistence-test configuration', () => {
  it('loads only dedicated test settings without overriding process values', () => {
    const environment: NodeJS.ProcessEnv = {
      MONGO_TEST_SERVER_MODE: 'native',
    };
    applyLoadedMongoTestEnvironment(environment, {
      MONGO_TEST_SERVER_MODE: 'testcontainers',
      MONGO_TEST_BACKEND: 'testcontainers',
      MONGO_TEST_NATIVE_URI: 'mongodb://loaded.example.test/',
      MONGODB_URI: 'mongodb://must-not-be-loaded.example.test/application',
    });

    expect(environment).toEqual({
      MONGO_TEST_SERVER_MODE: 'native',
      MONGO_TEST_NATIVE_URI: 'mongodb://loaded.example.test/',
    });
  });

  it('requires an explicit supported server mode without fallback', () => {
    expect(() => resolveMongoTestServerMode({})).toThrow(
      'must be set explicitly'
    );
    expect(() =>
      resolveMongoTestServerMode({ MONGO_TEST_SERVER_MODE: 'automatic' })
    ).toThrow('must be set explicitly');
    expect(
      resolveMongoTestServerMode({ MONGO_TEST_SERVER_MODE: 'native' })
    ).toBe('native');
    expect(() =>
      resolveMongoTestServerMode({ MONGO_TEST_BACKEND: 'native' })
    ).toThrow('MONGO_TEST_SERVER_MODE');
    expect(() =>
      resolveMongoTestServerMode({
        MONGODB_URI: 'mongodb://localhost:27018/application',
      })
    ).toThrow('MONGO_TEST_SERVER_MODE');
  });

  it.each([
    [
      'remote',
      'mongodb://db.example.test:27017/?replicaSet=rs0&directConnection=true',
    ],
    [
      'multiple hosts',
      'mongodb://localhost:27017,127.0.0.1:27018/?replicaSet=rs0&directConnection=true',
    ],
    [
      'database',
      'mongodb://localhost:27017/badminton-club-demo-dev?replicaSet=rs0&directConnection=true',
    ],
    ['missing replica set', 'mongodb://localhost:27017/?directConnection=true'],
    ['not direct', 'mongodb://localhost:27017/?replicaSet=rs0'],
    [
      'load balanced',
      'mongodb://localhost:27017/?replicaSet=rs0&directConnection=true&loadBalanced=true',
    ],
  ])('rejects an unsafe native target: %s', (_case, uri) => {
    expect(() => validateNativeMongoServerUri(uri)).toThrow();
  });

  it('accepts a direct loopback server-level replica-set target', () => {
    expect(
      validateNativeMongoServerUri(
        'mongodb://localhost:27018/?replicaSet=rs0&directConnection=true'
      )
    ).toMatchObject({ replicaSet: 'rs0' });
  });

  it('creates unique owned database names independent of worker state', () => {
    const first = createMongoTestDatabaseName('membership lifecycle');
    const second = createMongoTestDatabaseName('membership lifecycle');
    expect(first).toMatch(MONGO_TEST_DATABASE_PATTERN);
    expect(second).toMatch(MONGO_TEST_DATABASE_PATTERN);
    expect(first).not.toBe(second);
  });

  it('bounds long suite identifiers to MongoDB database-name limits', () => {
    const databaseName = createMongoTestDatabaseName(
      'membership application banking cutover persistence'
    );
    expect(databaseName).toMatch(MONGO_TEST_DATABASE_PATTERN);
    expect(databaseName.length).toBeLessThanOrEqual(63);
  });

  it('builds a database URI only for an owned database name', () => {
    const databaseName = createMongoTestDatabaseName('uri');
    const uri = buildMongoTestDatabaseUri(
      'mongodb://localhost:27018/?replicaSet=rs0&directConnection=true',
      databaseName
    );
    expect(new URL(uri).pathname).toBe(`/${databaseName}`);
    expect(() =>
      buildMongoTestDatabaseUri(
        'mongodb://localhost:27018/',
        'badminton-club-demo-dev'
      )
    ).toThrow('Refusing unowned');
  });

  it('blocks cleanup when the connected database does not match the lease', () => {
    const databaseName = createMongoTestDatabaseName('ownership');
    expect(() =>
      assertMongoTestDatabaseOwnership(databaseName, 'badminton-club-demo-dev')
    ).toThrow('Refusing destructive');
    expect(() =>
      assertMongoTestDatabaseOwnership(databaseName, databaseName)
    ).not.toThrow();
  });
});
