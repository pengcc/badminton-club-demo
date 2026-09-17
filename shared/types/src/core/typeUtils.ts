/**
 * Timestamp fields required for all entities
 */
export interface WithTimestamp {
  createdAt: Date;
  updatedAt: Date;
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
export type AddStringId<T> = T & WithStringId;

/**
 * Make specific fields readonly
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};
