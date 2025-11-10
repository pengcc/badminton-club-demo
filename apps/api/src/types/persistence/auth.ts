import type { Document, Types } from 'mongoose';
import type { Domain } from '@club/shared-types/domain/auth';

/**
 * Persistence layer types for authentication data
 */
export namespace Persistence {
  export interface AuthDocument extends Omit<Domain.AuthenticatedUser, 'id'>, Document {
    _id: Types.ObjectId;
    password: string;
    metadata: Domain.AuthMetadata;
    comparePassword(candidatePassword: string): Promise<boolean>;
  }

  export interface AuthModel {
    findByCredentials(email: string, password: string): Promise<AuthDocument | null>;
    generateAuthToken(userId: Types.ObjectId): string;
    validateToken(token: string): Promise<Domain.TokenPayload | null>;
  }

  export interface AuthSession extends Document {
    _id: Types.ObjectId;
    userId: Types.ObjectId;
    token: string;
    expiresAt: Date;
    issuedAt: Date;
    isRevoked: boolean;
    createdAt: Date;
    updatedAt: Date;
  }
}
