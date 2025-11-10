/**
 * ESLint Configuration - Backend API
 *
 * TypeScript + Node.js + Express API rules
 */

import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  {
    ignores: ['node_modules/', 'dist/', 'coverage/', '*.config.js', '*.config.ts'],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        global: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // TypeScript specific
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
      }],
      'no-unused-vars': 'off',
      'no-console': 'off',
      'no-process-exit': 'error',
    },
  },
  {
    // Scripts - allow process.exit and floating promises
    files: ['src/scripts/**/*.ts'],
    rules: {
      'no-process-exit': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
  {
    // Middleware - Express requires specific signatures, allow unused params and async
    files: ['src/middleware/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        args: 'none', // Allow all unused function parameters
      }],
      '@typescript-eslint/no-misused-promises': ['error', {
        checksVoidReturn: {
          arguments: false,
          attributes: false,
          properties: false,
          returns: false,
          variables: false,
        },
      }],
    },
  },
  {
    // Routes - Express route handlers with async functions are safe
    files: ['src/routes/**/*.ts'],
    rules: {
      '@typescript-eslint/no-misused-promises': ['error', {
        checksVoidReturn: {
          arguments: false, // Allow async functions as Express route handlers
        },
      }],
    },
  },
  {
    // Utils - Helper functions that wrap async handlers
    files: ['src/utils/**/*.ts'],
    rules: {
      '@typescript-eslint/no-misused-promises': ['error', {
        checksVoidReturn: {
          returns: false, // Allow returning async functions
        },
      }],
    },
  },
];