import { describe, it } from '@jest/globals';
import { z } from 'zod';
import { CommonSchemas, SchemaBuilder } from '../validation';
import { TypeAssert, TestData } from './testUtils';

describe('Core Type System', () => {
  describe('CommonSchemas', () => {
    it('validates ObjectId', () => {
      const validId = '507f1f77bcf86cd799439011'; // Valid 24-char hex string
      TypeAssert.matches(CommonSchemas.objectId, validId);

      TypeAssert.fails(CommonSchemas.objectId, 'invalid-id', 'Invalid ObjectId format');
    });

    it('validates timestamp', () => {
      const validTimestamp = TestData.timestamp();
      TypeAssert.matches(CommonSchemas.timestamp, validTimestamp);

      TypeAssert.fails(CommonSchemas.timestamp, {
        createdAt: 'invalid-date'
      }, 'Invalid input: expected date, received string');
    });

    it('validates pagination', () => {
      const validPagination = TestData.pagination();
      TypeAssert.matches(CommonSchemas.pagination, validPagination);

      TypeAssert.fails(CommonSchemas.pagination, {
        page: 0
      }, 'Too small: expected number to be >=1');
    });
  });

  describe('SchemaBuilder', () => {
    const testSchema = z.object({
      name: z.string(),
      age: z.number()
    });

    it('makes fields optional', () => {
      const optionalSchema = SchemaBuilder.optional(testSchema);
      TypeAssert.matches(optionalSchema, {});
      TypeAssert.matches(optionalSchema, { name: 'test' });
    });

    it('makes fields required', () => {
      const requiredSchema = SchemaBuilder.required(testSchema);
      TypeAssert.matches(requiredSchema, { name: 'test', age: 25 });
      TypeAssert.fails(requiredSchema, { name: 'test' }, 'Invalid input: expected number, received undefined');
    });

    it('adds timestamp fields', () => {
      const withTimestamp = SchemaBuilder.withTimestamp(testSchema);
      TypeAssert.matches(withTimestamp, {
        name: 'test',
        age: 25,
        ...TestData.timestamp()
      });
    });

    it('adds string ID field', () => {
      const withId = SchemaBuilder.withStringId(testSchema);
      TypeAssert.matches(withId, {
        name: 'test',
        age: 25,
        id: 'test-id'
      });
    });
  });
});