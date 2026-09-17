import { describe, expect, it, vi } from 'vitest';
import {
  connectInitialMongo,
  DEVELOPMENT_INITIAL_MONGO_SERVER_SELECTION_TIMEOUT_MS,
} from '../../services/initialMongoConnectionService';

describe('initial Mongo connection', () => {
  it('bounds server selection to five seconds in development', async () => {
    const connect = vi.fn(async () => undefined);

    expect(DEVELOPMENT_INITIAL_MONGO_SERVER_SELECTION_TIMEOUT_MS).toBe(5_000);

    await connectInitialMongo(
      { connect },
      'mongodb://example.test/development',
      'development'
    );

    expect(connect).toHaveBeenCalledWith('mongodb://example.test/development', {
      serverSelectionTimeoutMS:
        DEVELOPMENT_INITIAL_MONGO_SERVER_SELECTION_TIMEOUT_MS,
    });
  });

  it.each([
    'production',
    'test',
  ])('preserves default Mongo timeout behavior in %s', async (nodeEnv) => {
    const connect = vi.fn(async () => undefined);

    await connectInitialMongo(
      { connect },
      'mongodb://example.test/runtime',
      nodeEnv
    );

    expect(connect).toHaveBeenCalledWith('mongodb://example.test/runtime');
    expect(connect.mock.calls[0]).toHaveLength(1);
  });
});
