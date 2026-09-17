import type { ScheduledProcessorLifecycle } from './scripts/scheduledProcessorLifecycle';

interface ClosableHttpServer {
  close(callback: (error?: Error) => void): void;
}

export interface ApiRuntime {
  shutdown(): Promise<void>;
}

interface ApiStartupDependencies {
  connectToMongo: () => Promise<unknown>;
  disconnectFromMongo: () => Promise<unknown>;
  initializeMembershipTerminationCron: () => ScheduledProcessorLifecycle;
  initializeMembershipApplicationRetentionCron: () => ScheduledProcessorLifecycle;
  startListener: (onListening: () => void) => ClosableHttpServer;
  reportMongoReady: () => void;
  reportInitialMongoFailure: () => void;
  reportSchedulerDegradation: (
    reasonCode:
      | 'MEMBERSHIP_TERMINATION_SCHEDULER_UNAVAILABLE'
      | 'MEMBERSHIP_APPLICATION_RETENTION_SCHEDULER_UNAVAILABLE'
  ) => void;
  recordSchedulerDegradation: (
    reasonCode:
      | 'MEMBERSHIP_TERMINATION_SCHEDULER_UNAVAILABLE'
      | 'MEMBERSHIP_APPLICATION_RETENTION_SCHEDULER_UNAVAILABLE'
  ) => void;
  markRuntimeReady: () => void;
  markStartupFailed: () => void;
  initializeSchedulers?: boolean;
}

function waitForServerClose(server: ClosableHttpServer): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export function createApiShutdownCoordinator({
  server,
  scheduledProcessors,
  disconnectFromMongo,
}: {
  server: ClosableHttpServer;
  scheduledProcessors: ScheduledProcessorLifecycle[];
  disconnectFromMongo: () => Promise<unknown>;
}): ApiRuntime {
  let shutdownPromise: Promise<void> | undefined;

  return {
    shutdown() {
      shutdownPromise ??= (async () => {
        const serverClosed = waitForServerClose(server);
        await Promise.all(
          scheduledProcessors.map((processor) => processor.stop())
        );

        await Promise.all([
          serverClosed,
          ...scheduledProcessors.map((processor) => processor.waitForIdle()),
        ]);
        await disconnectFromMongo();
      })();
      return shutdownPromise;
    },
  };
}

export async function startApi({
  connectToMongo,
  disconnectFromMongo,
  initializeMembershipTerminationCron,
  initializeMembershipApplicationRetentionCron,
  startListener,
  reportMongoReady,
  reportInitialMongoFailure,
  reportSchedulerDegradation,
  recordSchedulerDegradation,
  markRuntimeReady,
  markStartupFailed,
  initializeSchedulers = true,
}: ApiStartupDependencies): Promise<ApiRuntime | false> {
  try {
    await connectToMongo();
  } catch {
    reportInitialMongoFailure();
    markStartupFailed();
    return false;
  }

  reportMongoReady();

  const scheduledProcessors: ScheduledProcessorLifecycle[] = [];

  if (initializeSchedulers) {
    try {
      scheduledProcessors.push(initializeMembershipTerminationCron());
    } catch {
      const reasonCode = 'MEMBERSHIP_TERMINATION_SCHEDULER_UNAVAILABLE';
      recordSchedulerDegradation(reasonCode);
      reportSchedulerDegradation(reasonCode);
    }

    try {
      scheduledProcessors.push(initializeMembershipApplicationRetentionCron());
    } catch {
      const reasonCode =
        'MEMBERSHIP_APPLICATION_RETENTION_SCHEDULER_UNAVAILABLE';
      recordSchedulerDegradation(reasonCode);
      reportSchedulerDegradation(reasonCode);
    }
  }

  const server = startListener(markRuntimeReady);
  return createApiShutdownCoordinator({
    server,
    scheduledProcessors,
    disconnectFromMongo,
  });
}
