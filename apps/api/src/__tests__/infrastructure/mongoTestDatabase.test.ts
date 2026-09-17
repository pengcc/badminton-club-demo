import { describe, expect, it, vi } from 'vitest';
import {
  acquireMongoTestDatabaseForContext,
  type MongoTestDatabaseConnection,
} from './mongoTestDatabase';

const context = {
  serverMode: 'native' as const,
  serverUri: 'mongodb://127.0.0.1:27018/?replicaSet=rs0&directConnection=true',
};

function fakeConnection(): MongoTestDatabaseConnection & {
  databaseName?: string;
} {
  return {
    databaseName: undefined,
    connectedDatabaseName() {
      return this.databaseName;
    },
    connect: vi.fn(async function (this: { databaseName?: string }, uri) {
      this.databaseName = new URL(uri).pathname.slice(1);
    }),
    dropDatabase: vi.fn(async () => undefined),
    disconnect: vi.fn(async () => undefined),
  };
}

describe('Mongo test database lease lifecycle', () => {
  it('drops and disconnects exactly once across repeated successful release', async () => {
    const connection = fakeConnection();
    const lease = await acquireMongoTestDatabaseForContext(
      'repeated release',
      context,
      connection
    );

    await lease.release();
    await lease.release();

    expect(connection.dropDatabase).toHaveBeenCalledTimes(1);
    expect(connection.disconnect).toHaveBeenCalledTimes(1);
  });

  it('keeps a failed drop retryable and disconnects only after cleanup succeeds', async () => {
    const connection = fakeConnection();
    vi.mocked(connection.dropDatabase)
      .mockRejectedValueOnce(new Error('temporary drop failure'))
      .mockResolvedValueOnce(undefined);
    const lease = await acquireMongoTestDatabaseForContext(
      'drop retry',
      context,
      connection
    );

    await expect(lease.release()).rejects.toThrow('temporary drop failure');
    expect(connection.disconnect).not.toHaveBeenCalled();

    await lease.release();
    await lease.release();
    expect(connection.dropDatabase).toHaveBeenCalledTimes(2);
    expect(connection.disconnect).toHaveBeenCalledTimes(1);
  });

  it('cleans an exactly owned database after partial acquisition failure', async () => {
    const connection = fakeConnection();
    vi.mocked(connection.connect).mockImplementationOnce(async (uri) => {
      connection.databaseName = new URL(uri).pathname.slice(1);
      throw new Error('connect failed after selecting database');
    });

    await expect(
      acquireMongoTestDatabaseForContext(
        'partial acquisition',
        context,
        connection
      )
    ).rejects.toThrow('connect failed after selecting database');
    expect(connection.dropDatabase).toHaveBeenCalledTimes(1);
    expect(connection.disconnect).toHaveBeenCalledTimes(1);
  });
});
