/**
 * Root ESLint Configuration
 *
 * Base rules for the entire monorepo. Individual packages can extend
 * or override these rules in their own eslint.config.mjs files.
 */

export default {
  root: true,
  env: {
    es2022: true,
    node: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    '.next/',
    'coverage/',
    '*.config.js',
    '*.config.mjs',
  ],
  rules: {
    // Possible Problems
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'no-debugger': 'warn',
    'no-duplicate-imports': 'error',
    'no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],

    // Suggestions
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-arrow-callback': 'error',
    'prefer-template': 'error',
    'prefer-destructuring': ['error', { array: false, object: true }],

    // Stylistic
    eqeqeq: ['error', 'always', { null: 'ignore' }],
    curly: ['error', 'all'],
    'brace-style': ['error', '1tbs', { allowSingleLine: true }],
  },
};
