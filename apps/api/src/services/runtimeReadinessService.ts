export const runtimeDegradationReasonCodes = [
  'MEMBERSHIP_TERMINATION_SCHEDULER_UNAVAILABLE',
  'MEMBERSHIP_APPLICATION_RETENTION_SCHEDULER_UNAVAILABLE',
] as const;

export type RuntimeDegradationReasonCode =
  (typeof runtimeDegradationReasonCodes)[number];

export class RuntimeReadinessService {
  private listening = false;
  private readonly degradationReasonCodes =
    new Set<RuntimeDegradationReasonCode>();

  markListening(): void {
    this.listening = true;
  }

  recordDegradation(reasonCode: RuntimeDegradationReasonCode): void {
    this.degradationReasonCodes.add(reasonCode);
  }

  snapshot(): {
    listening: boolean;
    degradationReasonCodes: RuntimeDegradationReasonCode[];
  } {
    return {
      listening: this.listening,
      degradationReasonCodes: runtimeDegradationReasonCodes.filter(
        (reasonCode) => this.degradationReasonCodes.has(reasonCode)
      ),
    };
  }
}

export const runtimeReadinessService = new RuntimeReadinessService();
