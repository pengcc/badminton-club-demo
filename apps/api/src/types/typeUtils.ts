import { Types } from 'mongoose';

/**
 * Timestamp fields required for all entities
 */
export interface WithTimestamp {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * MongoDB ObjectId field
 */
export interface WithObjectId {
  _id: Types.ObjectId;
}

/**
 * String ID field for API layer
 */
export interface WithStringId {
  id: string;
}

/**
 * Type utilities for layer transformations
 */
export type AddTimestamp<T> = T & WithTimestamp;
export type AddObjectId<T> = T & WithObjectId;
export type AddStringId<T> = T & WithStringId;

/**
 * Make specific fields readonly
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/**
 * Convert MongoDB ObjectId to string ID
 */
export const toStringId = (objId: Types.ObjectId | string): string =>
  objId.toString();

/**
 * Convert string to MongoDB ObjectId
 */
export const toObjectId = (id: string): Types.ObjectId =>
  new Types.ObjectId(id);

/**
 * Add timestamp fields to an entity
 */
export const withTimestamp = <T extends object>(entity: T): AddTimestamp<T> => ({
  ...entity,
  createdAt: new Date(),
  updatedAt: new Date()
});