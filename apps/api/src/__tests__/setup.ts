import { beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
beforeAll(async () => {
  // Add any global test setup here
});

afterAll(async () => {
  // Add any global test cleanup here
});

// Clear all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});