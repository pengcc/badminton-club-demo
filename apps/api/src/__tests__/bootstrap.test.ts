import { describe, expect, it, vi } from 'vitest';
import { startApi } from '../bootstrap';

function createDependencies() {
  const server = {
    close: vi.fn<(callback: (error?: Error) => void) => void>(),
  };
  const terminationScheduler = {
    stop: vi.fn<() => Promise<void>>().mockResolvedValue(),
    waitForIdle: vi.fn<() => Promise<void>>().mockResolvedValue(),
  };
  const retentionScheduler = {
    stop: vi.fn<() => Promise<void>>().mockResolvedValue(),
    waitForIdle: vi.fn<() => Promise<void>>().mockResolvedValue(),
  };

  return {
    connectToMongo: vi.fn<() => Promise<unknown>>(),
    disconnectFromMongo: vi.fn<() => Promise<unknown>>(),
    initializeMembershipTerminationCron: vi
      .fn()
      .mockReturnValue(terminationScheduler),
    initializeMembershipApplicationRetentionCron: vi
      .fn()
      .mockReturnValue(retentionScheduler),
    startListener: vi
      .fn<(onListening: () => void) => typeof server>()
      .mockReturnValue(server),
    reportMongoReady: vi.fn(),
    reportInitialMongoFailure: vi.fn(),
    reportSchedulerDegradation: vi.fn(),
    recordSchedulerDegradation: vi.fn(),
    markRuntimeReady: vi.fn(),
    markStartupFailed: vi.fn(),
    server,
    terminationScheduler,
    retentionScheduler,
  };
}

describe('API startup', () => {
  it('suppresses both schedulers when the runtime disables scheduled work', async () => {
    const dependencies = createDependencies();

    await expect(
      startApi({ ...dependencies, initializeSchedulers: false })
    ).resolves.toBeTruthy();

    expect(
      dependencies.initializeMembershipTerminationCron
    ).not.toHaveBeenCalled();
    expect(
      dependencies.initializeMembershipApplicationRetentionCron
    ).not.toHaveBeenCalled();
    expect(dependencies.startListener).toHaveBeenCalledOnce();
  });

  it('waits for MongoDB before initializing the cron and listener once', async () => {
    const events: string[] = [];
    let resolveConnection: (() => void) | undefined;
    const connection = new Promise<void>((resolve) => {
      resolveConnection = resolve;
    });
    const dependencies = createDependencies();
    dependencies.connectToMongo.mockImplementation(async () => {
      events.push('connect-started');
      await connection;
      events.push('connect-resolved');
    });
    dependencies.reportMongoReady.mockImplementation(() => {
      events.push('mongo-ready');
    });
    dependencies.initializeMembershipTerminationCron.mockImplementation(() => {
      events.push('cron');
      return dependencies.terminationScheduler;
    });
    dependencies.initializeMembershipApplicationRetentionCron.mockImplementation(
      () => {
        events.push('retention-cron');
        return dependencies.retentionScheduler;
      }
    );
    dependencies.startListener.mockImplementation(() => {
      events.push('listener');
      return dependencies.server;
    });

    const startup = startApi(dependencies);

    expect(events).toEqual(['connect-started']);
    expect(
      dependencies.initializeMembershipTerminationCron
    ).not.toHaveBeenCalled();
    expect(dependencies.startListener).not.toHaveBeenCalled();

    resolveConnection?.();

    await expect(startup).resolves.toBeTruthy();
    expect(events).toEqual([
      'connect-started',
      'connect-resolved',
      'mongo-ready',
      'cron',
      'retention-cron',
      'listener',
    ]);
    expect(
      dependencies.initializeMembershipTerminationCron
    ).toHaveBeenCalledOnce();
    expect(
      dependencies.initializeMembershipApplicationRetentionCron
    ).toHaveBeenCalledOnce();
    expect(dependencies.startListener).toHaveBeenCalledOnce();
    expect(dependencies.markRuntimeReady).not.toHaveBeenCalled();
    expect(dependencies.markStartupFailed).not.toHaveBeenCalled();
  });

  it('marks runtime ready only when the listener reports that it is listening', async () => {
    const dependencies = createDependencies();
    let onListening: (() => void) | undefined;
    dependencies.startListener.mockImplementation((callback) => {
      onListening = callback;
      return dependencies.server;
    });

    await expect(startApi(dependencies)).resolves.toBeTruthy();
    expect(dependencies.markRuntimeReady).not.toHaveBeenCalled();

    onListening?.();
    expect(dependencies.markRuntimeReady).toHaveBeenCalledOnce();
  });

  it('fails non-zero without initializing the cron or listener when MongoDB rejects', async () => {
    const dependencies = createDependencies();
    dependencies.connectToMongo.mockRejectedValue(
      new Error('connection details must stay private')
    );

    await expect(startApi(dependencies)).resolves.toBe(false);

    expect(dependencies.reportMongoReady).not.toHaveBeenCalled();
    expect(
      dependencies.initializeMembershipTerminationCron
    ).not.toHaveBeenCalled();
    expect(
      dependencies.initializeMembershipApplicationRetentionCron
    ).not.toHaveBeenCalled();
    expect(dependencies.startListener).not.toHaveBeenCalled();
    expect(dependencies.reportInitialMongoFailure).toHaveBeenCalledOnce();
    expect(dependencies.markStartupFailed).toHaveBeenCalledOnce();
  });

  it('records each scheduler failure as degradation and still starts the listener', async () => {
    const dependencies = createDependencies();
    dependencies.initializeMembershipTerminationCron.mockImplementation(() => {
      throw new Error('private scheduler details');
    });
    dependencies.initializeMembershipApplicationRetentionCron.mockImplementation(
      () => {
        throw new Error('other private scheduler details');
      }
    );

    await expect(startApi(dependencies)).resolves.toBeTruthy();

    expect(dependencies.connectToMongo).toHaveBeenCalledOnce();
    expect(dependencies.reportMongoReady).toHaveBeenCalledOnce();
    expect(dependencies.recordSchedulerDegradation).toHaveBeenNthCalledWith(
      1,
      'MEMBERSHIP_TERMINATION_SCHEDULER_UNAVAILABLE'
    );
    expect(dependencies.recordSchedulerDegradation).toHaveBeenNthCalledWith(
      2,
      'MEMBERSHIP_APPLICATION_RETENTION_SCHEDULER_UNAVAILABLE'
    );
    expect(dependencies.reportSchedulerDegradation).toHaveBeenCalledTimes(2);
    expect(dependencies.startListener).toHaveBeenCalledOnce();
    expect(dependencies.markStartupFailed).not.toHaveBeenCalled();
  });

  it('stops new work and waits for HTTP and scheduled work before disconnecting Mongo', async () => {
    const events: string[] = [];
    let finishHttpDrain: (() => void) | undefined;
    let finishScheduledWork: (() => void) | undefined;
    const scheduledWorkDrain = new Promise<void>((resolve) => {
      finishScheduledWork = () => {
        events.push('scheduled-work-drained');
        resolve();
      };
    });
    const dependencies = createDependencies();
    dependencies.server.close.mockImplementation((callback) => {
      events.push('http-close-started');
      finishHttpDrain = () => {
        events.push('http-drained');
        callback();
      };
    });
    dependencies.terminationScheduler.stop.mockImplementation(async () => {
      events.push('termination-stopped');
    });
    dependencies.retentionScheduler.stop.mockImplementation(async () => {
      events.push('retention-stopped');
    });
    dependencies.terminationScheduler.waitForIdle.mockImplementation(
      () => scheduledWorkDrain
    );
    dependencies.disconnectFromMongo.mockImplementation(async () => {
      events.push('mongo-disconnected');
    });

    const runtime = await startApi(dependencies);
    expect(runtime).not.toBe(false);
    if (!runtime) throw new Error('Expected API runtime');

    const firstShutdown = runtime.shutdown();
    const overlappingShutdown = runtime.shutdown();

    expect(overlappingShutdown).toBe(firstShutdown);
    expect(events).toEqual([
      'http-close-started',
      'termination-stopped',
      'retention-stopped',
    ]);
    expect(dependencies.disconnectFromMongo).not.toHaveBeenCalled();

    finishHttpDrain?.();
    await Promise.resolve();
    expect(dependencies.disconnectFromMongo).not.toHaveBeenCalled();

    finishScheduledWork?.();
    await firstShutdown;

    expect(events).toEqual([
      'http-close-started',
      'termination-stopped',
      'retention-stopped',
      'http-drained',
      'scheduled-work-drained',
      'mongo-disconnected',
    ]);
    expect(dependencies.server.close).toHaveBeenCalledOnce();
    expect(dependencies.terminationScheduler.stop).toHaveBeenCalledOnce();
    expect(dependencies.retentionScheduler.stop).toHaveBeenCalledOnce();
    expect(dependencies.disconnectFromMongo).toHaveBeenCalledOnce();
  });
});
