import type { MongoTestServerContext } from './mongoTestConfig';

declare module 'vitest' {
  export interface ProvidedContext {
    mongoTestServer: MongoTestServerContext;
  }
}
