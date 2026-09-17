import type { ConnectOptions } from 'mongoose';

export const DEVELOPMENT_INITIAL_MONGO_SERVER_SELECTION_TIMEOUT_MS = 5_000;

interface MongoConnector {
  connect(uri: string, options?: ConnectOptions): Promise<unknown>;
}

export function connectInitialMongo(
  mongo: MongoConnector,
  uri: string,
  nodeEnv: string
): Promise<unknown> {
  if (nodeEnv === 'development') {
    return mongo.connect(uri, {
      serverSelectionTimeoutMS:
        DEVELOPMENT_INITIAL_MONGO_SERVER_SELECTION_TIMEOUT_MS,
    });
  }

  return mongo.connect(uri);
}
