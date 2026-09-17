import { randomUUID } from 'node:crypto';
import {
  MongoDBContainer,
  type StartedMongoDBContainer,
} from '@testcontainers/mongodb';
import mongoose from 'mongoose';
import type { TestProject } from 'vitest/node';
import {
  MONGO_TEST_CONTEXT_KEY,
  type MongoTestServerContext,
  type MongoTestServerMode,
  resolveMongoTestServerMode,
  validateNativeMongoServerUri,
} from './mongoTestConfig';

const probeDatabasePattern = /^club_infrastructure_probe_[a-f0-9]{32}$/;

function testcontainersServerUri(container: StartedMongoDBContainer) {
  const uri = new URL(container.getConnectionString());
  uri.searchParams.set('replicaSet', 'rs0');
  uri.searchParams.set('directConnection', 'true');
  return uri.toString();
}

async function verifyServerAndTransactions(
  serverMode: MongoTestServerMode,
  serverUri: string,
  configuredReplicaSet?: string
) {
  const client = new mongoose.mongo.MongoClient(serverUri, {
    serverSelectionTimeoutMS: 10_000,
  });
  let connected = false;
  const probeDatabase = `club_infrastructure_probe_${randomUUID().replaceAll('-', '')}`;
  if (!probeDatabasePattern.test(probeDatabase)) {
    throw new Error(
      'generated transaction-probe database is outside the owned pattern'
    );
  }

  try {
    await client.connect();
    connected = true;
    const hello = await client.db('admin').command({ hello: 1 });
    if (!hello.isWritablePrimary && !hello.ismaster) {
      throw new Error('selected MongoDB target is not a writable primary');
    }
    if (!hello.setName) {
      throw new Error('selected MongoDB target is not a replica set');
    }
    if (configuredReplicaSet && hello.setName !== configuredReplicaSet) {
      throw new Error(
        'configured replicaSet does not match the live MongoDB target'
      );
    }

    const session = client.startSession();
    try {
      await session.withTransaction(async () => {
        await client
          .db(probeDatabase)
          .collection('transaction_probe')
          .insertOne({ serverMode, probe: true }, { session });
      });
      const committedProbe = await client
        .db(probeDatabase)
        .collection('transaction_probe')
        .countDocuments({ serverMode, probe: true });
      if (committedProbe !== 1) {
        throw new Error('transaction probe did not commit exactly one record');
      }
    } finally {
      await session.endSession();
    }
  } finally {
    try {
      if (connected) await client.db(probeDatabase).dropDatabase();
    } finally {
      await client.close();
    }
  }
}

export default async function setup(project: TestProject) {
  const serverMode = resolveMongoTestServerMode();
  console.info(`[mongo-test] selected server mode=${serverMode}`);

  let container: StartedMongoDBContainer | undefined;
  try {
    let serverUri: string;
    let configuredReplicaSet: string | undefined;
    if (serverMode === 'testcontainers') {
      container = await new MongoDBContainer('mongo:8.0').start();
      serverUri = testcontainersServerUri(container);
      configuredReplicaSet = 'rs0';
    } else {
      const native = validateNativeMongoServerUri(
        process.env.MONGO_TEST_NATIVE_URI
      );
      serverUri = native.serverUri;
      configuredReplicaSet = native.replicaSet;
    }

    await verifyServerAndTransactions(
      serverMode,
      serverUri,
      configuredReplicaSet
    );
    const context: MongoTestServerContext = { serverMode, serverUri };
    project.provide(MONGO_TEST_CONTEXT_KEY, context);
  } catch (error) {
    await container?.stop();
    const reason = (error instanceof Error ? error.message : 'unknown failure')
      .replace(/mongodb:\/\/\S+/gi, '[redacted MongoDB URI]')
      .slice(0, 500);
    throw new Error(`Mongo test server mode "${serverMode}" failed: ${reason}`);
  }

  return async () => {
    await container?.stop();
  };
}
