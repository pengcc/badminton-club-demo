import { globSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PERSISTENCE_TEST_INCLUDES } from './mongoTestClassification';

describe('Mongo persistence-project classification', () => {
  it('routes every current Mongo infrastructure consumer exactly once', () => {
    const configuredFiles = new Set(
      PERSISTENCE_TEST_INCLUDES.flatMap((pattern) => globSync(pattern))
    );
    const currentConsumers = [
      ...globSync('src/__tests__/integration/**/*.test.ts'),
      ...globSync('src/__tests__/services/**/*.test.ts'),
    ].filter((file) => {
      const source = readFileSync(file, 'utf8');
      return (
        source.includes('acquireMongoTestDatabase') ||
        file.endsWith('destructiveResetSafetyPersistence.test.ts')
      );
    });

    expect([...configuredFiles].sort()).toEqual(currentConsumers.sort());
    expect(configuredFiles.size).toBe(currentConsumers.length);
  });
});
