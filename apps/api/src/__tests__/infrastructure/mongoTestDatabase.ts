import mongoose from 'mongoose';
import { inject } from 'vitest';
import {
  assertMongoTestDatabaseOwnership,
  buildMongoTestDatabaseUri,
  createMongoTestDatabaseName,
  MONGO_TEST_CONTEXT_KEY,
  type MongoTestServerContext,
  type MongoTestServerMode,
} from './mongoTestConfig';

export interface MongoTestDatabaseLease {
  serverMode: MongoTestServerMode;
  databaseName: string;
  uri: string;
  assertOwnedDatabase(): void;
  release(): Promise<void>;
}

export interface MongoTestDatabaseConnection {
  connectedDatabaseName(): string | undefined;
  connect(uri: string): Promise<void>;
  dropDatabase(): Promise<void>;
  disconnect(): Promise<void>;
}

const mongooseMongoTestConnection: MongoTestDatabaseConnection = {
  connectedDatabaseName: () => mongoose.connection.name,
  async connect(uri) {
    await mongoose.connect(uri, {
      autoIndex: false,
      serverSelectionTimeoutMS: 5_000,
    });
  },
  async dropDatabase() {
    await mongoose.connection.dropDatabase();
  },
  async disconnect() {
    await mongoose.disconnect();
  },
};

export async function acquireMongoTestDatabaseForContext(
  suiteIdentifier: string,
  context: MongoTestServerContext,
  connection: MongoTestDatabaseConnection
): Promise<MongoTestDatabaseLease> {
  const databaseName = createMongoTestDatabaseName(suiteIdentifier);
  const uri = buildMongoTestDatabaseUri(context.serverUri, databaseName);
  let databaseDropped = false;
  let released = false;

  const assertOwnedDatabase = () =>
    assertMongoTestDatabaseOwnership(
      databaseName,
      connection.connectedDatabaseName()
    );

  try {
    await connection.connect(uri);
    assertOwnedDatabase();
  } catch (error) {
    try {
      if (connection.connectedDatabaseName() === databaseName) {
        await connection.dropDatabase();
      }
    } finally {
      await connection.disconnect();
    }
    throw error;
  }

  console.info(
    `[mongo-test] server mode=${context.serverMode} database=${databaseName} acquired`
  );

  return {
    serverMode: context.serverMode,
    databaseName,
    uri,
    assertOwnedDatabase,
    async release() {
      if (released) return;
      if (!databaseDropped) {
        assertOwnedDatabase();
        await connection.dropDatabase();
        databaseDropped = true;
      }
      await connection.disconnect();
      released = true;
    },
  };
}

export async function acquireMongoTestDatabase(
  suiteIdentifier: string
): Promise<MongoTestDatabaseLease> {
  return acquireMongoTestDatabaseForContext(
    suiteIdentifier,
    inject(MONGO_TEST_CONTEXT_KEY),
    mongooseMongoTestConnection
  );
}
