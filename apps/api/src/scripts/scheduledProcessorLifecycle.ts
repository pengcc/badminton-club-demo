export interface ScheduledProcessorLifecycle {
  stop(): Promise<void>;
  waitForIdle(): Promise<void>;
}

export function createScheduledProcessorLifecycle(
  stopScheduling: () => void | Promise<void>
): ScheduledProcessorLifecycle & {
  run(invocation: () => Promise<void>): Promise<void>;
} {
  const activeInvocations = new Set<Promise<void>>();

  return {
    async stop() {
      await stopScheduling();
    },
    async waitForIdle() {
      while (activeInvocations.size > 0) {
        await Promise.allSettled([...activeInvocations]);
      }
    },
    async run(invocation) {
      const activeInvocation = Promise.resolve().then(invocation);
      activeInvocations.add(activeInvocation);
      try {
        await activeInvocation;
      } finally {
        activeInvocations.delete(activeInvocation);
      }
    },
  };
}
