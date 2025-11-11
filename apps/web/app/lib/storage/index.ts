/**
 * Storage Module Exports
 *
 * Phase 1: Foundation complete
 * - StorageAdapter interface ✓
 * - ServerAdapter implementation ✓
 * - StorageProvider context ✓
 * - Seed data generator ✓
 *
 * Phase 2: LocalAdapter (not yet implemented)
 */

export { ServerAdapter } from './ServerAdapter';
export { StorageProvider, useStorage, useStorageAdapter } from './StorageProvider';
export { generateSeedData } from './seedData';
export type { StorageAdapter } from './StorageAdapter';
export type { StorageMode } from './StorageProvider';
export type { SeedData } from './seedData';
