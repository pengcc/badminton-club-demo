import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import { defineConfig } from 'vitest/config';
import { PERSISTENCE_TEST_INCLUDES } from './src/__tests__/infrastructure/mongoTestClassification';
import { applyLoadedMongoTestEnvironment } from './src/__tests__/infrastructure/mongoTestConfig';

const root = fileURLToPath(new URL('.', import.meta.url));

const sharedTestConfig = {
  environment: 'node' as const,
  globals: true,
  env: {
    FRONTEND_URL: 'http://localhost:3000',
  },
};

export default defineConfig(() => {
  try {
    applyLoadedMongoTestEnvironment(
      process.env,
      parse(readFileSync(`${root}.env.local`))
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  return {
    resolve: {
      alias: {
        '@': root,
        '@src': `${root}src`,
        '@shared': `${root}../../shared`,
        '@club/shared-types': `${root}../../shared/types/src`,
      },
    },
    test: {
      projects: [
        {
          extends: true,
          test: {
            ...sharedTestConfig,
            name: 'ordinary',
            include: ['src/**/__tests__/**/*.test.ts'],
            exclude: PERSISTENCE_TEST_INCLUDES,
          },
        },
        {
          extends: true,
          test: {
            ...sharedTestConfig,
            name: 'persistence',
            include: PERSISTENCE_TEST_INCLUDES,
            isolate: true,
            globalSetup: [
              './src/__tests__/infrastructure/mongoTestGlobalSetup.ts',
            ],
          },
        },
      ],
    },
  };
});
