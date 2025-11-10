import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  dir: './',
});

const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@app/(.*)$': '<rootDir>/app/$1',
    '^@messages/(.*)$': '<rootDir>/messages/$1',
    '^@ui/(.*)$': '<rootDir>/app/components/ui/$1',
    '^@club/shared-types/(.*)$': '<rootDir>/../../shared/types/src/$1'
  },
  testMatch: ['**/__tests__/**/*.test.ts?(x)'],
  verbose: true
};

export default createJestConfig(config);
