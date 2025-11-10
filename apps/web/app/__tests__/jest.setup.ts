import React from 'react';

// Declare the global type for React 19 test environment
declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

// Tell React 19 this is a test environment
global.IS_REACT_ACT_ENVIRONMENT = true;

// ---- Mock Next.js app-router internals that use Suspense ----
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// ---- Mock next-intl to disable its Suspense ----
jest.mock('next-intl', () => ({
  __esModule: true,
  NextIntlClientProvider: ({ children }: any) =>
    React.createElement(React.Fragment, null, children),
  useTranslations: () => (key: string) => key,
}));

// ---- Suppress React 19 Suspense act() warnings ----
const originalError = console.error;
beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((...args) => {
    const msg = args[0];
    // Suppress React 19 Suspense act() warnings
    if (
      typeof msg === 'string' &&
      (msg.includes('A suspended resource finished loading') ||
        msg.includes('wrapped in act(...)'))
    ) {
      return;
    }
    // Call the original console.error for all other errors
    originalError.call(console, ...args);
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});