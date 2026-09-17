export const DEMO_EDITING_MUTATION_LIMIT = 20;
export const DEMO_EDITING_DURATION_MINUTES = 30;

export type DemoEditingMode =
  | 'read-only'
  | 'active'
  | 'in-use'
  | 'cleanup-blocked';

export interface DemoEditingStatus {
  enabled: boolean;
  mode: DemoEditingMode;
  expiresAt?: string;
  remainingMutations: number;
}
