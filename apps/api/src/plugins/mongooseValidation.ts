import type { Document, Schema} from 'mongoose';
import { Error as MongooseError } from 'mongoose';
import type { ValidationResult, ValidationError } from '../types/persistence/base';

type MongooseErrorType = {
  path: string;
  message: string;
  kind?: string;
};

/**
 * Custom validation plugin for mongoose
 */
export function validationPlugin(schema: Schema) {
  schema.methods.validateWithResult = async function(this: Document): Promise<ValidationResult> {
    try {
      await this.validate();
      return { isValid: true };
    } catch (error) {
      if (error instanceof MongooseError.ValidationError && error.errors) {
        const errors: ValidationError[] = Object.values(error.errors).map((err) => {
          const mongooseError = err as unknown as MongooseErrorType;
          return {
            field: mongooseError.path,
            message: mongooseError.message,
            code: mongooseError.kind || 'VALIDATION_ERROR'
          };
        });
        return {
          isValid: false,
          errors
        };
      }
      // Handle unexpected errors
      return {
        isValid: false,
        errors: [{
          field: 'unknown',
          message: 'An unexpected error occurred',
          code: 'INTERNAL_ERROR'
        }]
      };
    }
  };
}
