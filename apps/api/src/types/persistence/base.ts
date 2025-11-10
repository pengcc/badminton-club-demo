import type { Document, Model, Schema, UpdateQuery, FilterQuery } from 'mongoose';

/**
 * Base timestamp interface with readonly fields
 */
export interface Timestamps {
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Soft delete interface with strict typing and readonly fields
 */
export interface SoftDelete {
  readonly deletedAt?: Date;
  readonly isDeleted: boolean;
}

/**
 * Enhanced base document with validation and readonly fields
 */
export interface BaseDocument extends Document, Timestamps {
  readonly _id: Schema.Types.ObjectId;
  readonly id: string; // Virtual getter for string ID
  validateWithResult(): Promise<ValidationResult>;
}

/**
 * Validation rules interface
 */
export interface ValidationRules {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: unknown) => boolean | Promise<boolean>;
}

/**
 * Field validation metadata
 */
export interface FieldValidation {
  field: string;
  rules: ValidationRules;
  message?: string;
}

/**
 * Validation methods interface
 */
export interface DocumentValidation<T extends BaseDocument> {
  validateDocument(doc: T): Promise<ValidationResult>;
  validateField<K extends keyof T>(field: K, value: T[K]): Promise<ValidationResult>;
  getValidationRules(): Record<keyof T, ValidationRules>;
}

/**
 * Validation result with detailed error information
 */
export interface ValidationResult {
  isValid: boolean;
  errors?: ValidationError[];
  fields?: Record<string, boolean>; // Field-specific validation status
  metadata?: {
    timestamp: Date;
    duration?: number;
    validatedFields: string[];
  };
}

/**
 * Enhanced validation error with source tracking
 */
export interface ValidationError {
  field: string;
  message: string;
  code: string;
  path?: string[]; // Nested field path
  value?: unknown; // Invalid value
  expectedType?: string;
  constraints?: Record<string, boolean>;
}

/**
 * Soft delete document with validation
 */
export interface SoftDeleteDocument extends BaseDocument, SoftDelete {
  softDelete(): Promise<void>;
  restore(): Promise<void>;
}

/**
 * Type-safe query options with pagination
 */
export interface QueryOptions<T extends BaseDocument> {
  filter?: FilterQuery<T>;
  select?: (keyof T)[] | Record<keyof T, 1 | 0>;
  sort?: Partial<Record<keyof T, 1 | -1>>;
  limit?: number;
  offset?: number;
  includeDeleted?: boolean;
  populate?: Array<{
    path: keyof T;
    select?: string;
  }>;
}

/**
 * Enhanced base model methods with type safety
 */
export interface BaseModelMethods<T extends BaseDocument> {
  // Safe creation
  findOneOrCreate(filter: FilterQuery<T>, data: Partial<T>): Promise<T>;
  createWithValidation(data: Partial<T>): Promise<T>;

  // Safe queries
  findOneOrFail(filter: FilterQuery<T>): Promise<T>;
  findWithOptions(options: QueryOptions<T>): Promise<PaginatedResult<T>>;

  // Safe updates
  updateOneOrFail(filter: FilterQuery<T>, update: UpdateQuery<T>): Promise<T>;
  updateManyWithValidation(
    filter: FilterQuery<T>,
    update: UpdateQuery<T>
  ): Promise<{ modified: number; errors?: ValidationError[] }>;

  // Validation
  validateBeforeSave(data: Partial<T>): Promise<ValidationResult>;
  validateUpdate(update: UpdateQuery<T>): Promise<ValidationResult>;

  // Soft delete operations
  softDelete(filter: FilterQuery<T>): Promise<{ deleted: number }>;
  restore(filter: FilterQuery<T>): Promise<{ restored: number }>;
}

/**
 * Base model type with enhanced methods
 */
export type BaseModel<T extends BaseDocument> = Model<T> & BaseModelMethods<T>;

/**
 * Utility types for composition
 */
export type WithTimestamps<T> = Readonly<T & Timestamps>;
export type WithSoftDelete<T> = Readonly<T & SoftDelete>;
export type WithTimestampsAndSoftDelete<T> = WithTimestamps<WithSoftDelete<T>>;

/**
 * Pagination result with proper typing
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  page: number;
  pageSize: number;
}

/**
 * Utility type for partial updates with validation
 */
export type ValidatedUpdate<T> = {
  data: Partial<T>;
  validate(): Promise<ValidationResult>;
}