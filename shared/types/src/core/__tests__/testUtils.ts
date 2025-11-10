import { z } from 'zod';
import { ValidationError, validateSchema } from '../validation';

/**
 * Type assertion utilities for tests
 */
export const TypeAssert = {
  /**
   * Assert that a type matches the schema
   */
  matches: <T extends z.ZodType>(
    schema: T,
    data: unknown
  ): void => {
    validateSchema(schema, data);
  },

  /**
   * Assert that validation fails
   */
  fails: (
    schema: z.ZodType,
    data: unknown,
    expectedError?: string
  ) => {
    try {
      validateSchema(schema, data);
      throw new Error('Validation should have failed');
    } catch (error) {
      if (!(error instanceof ValidationError)) {
        throw error;
      }
      if (expectedError && error instanceof ValidationError) {
        expect(error.errors.issues[0]?.message).toBe(expectedError);
      }
    }
  }
};

/**
 * Test data generators
 */
export const TestData = {
  /**
   * Create a random ObjectId string
   */
  objectId: () => Math.random().toString(36).substring(2, 15),

  /**
   * Create timestamp fields
   */
  timestamp: () => ({
    createdAt: new Date(),
    updatedAt: new Date()
  }),

  /**
   * Create pagination params
   */
  pagination: (page = 1, limit = 10) => ({
    page,
    limit
  })
};