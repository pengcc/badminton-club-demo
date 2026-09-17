import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  processDue: vi.fn(),
  schedule: vi.fn(),
  stop: vi.fn(),
}));
vi.mock('../../services/membershipApplicationRetentionService', () => ({
  membershipApplicationRetentionService: { processDue: mocks.processDue },
}));
vi.mock('node-cron', () => ({ default: { schedule: mocks.schedule } }));

import {
  initMembershipApplicationRetentionCron,
  processMembershipApplicationRetention,
} from '../../scripts/processMembershipApplicationRetention';

describe('Membership Application retention scheduled invocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.schedule.mockReturnValue({ stop: mocks.stop });
    mocks.processDue.mockResolvedValue({
      deletedCount: 1,
      skippedCount: 0,
      failureCount: 0,
      expiredTokenCount: 1,
      expiredSessionCount: 1,
      items: [],
      proofOperationDeletedCount: 0,
      proofOperationFailureCount: 0,
      proofOperations: [],
    });
  });

  it('passes one processing instant to the callable processor', async () => {
    const now = new Date('2026-08-07T02:45:00.000Z');
    await processMembershipApplicationRetention(now);
    expect(mocks.processDue).toHaveBeenCalledWith(now);
  });

  it('registers one daily UTC trigger without running immediately', () => {
    initMembershipApplicationRetentionCron();
    expect(mocks.schedule).toHaveBeenCalledWith(
      '45 2 * * *',
      expect.any(Function),
      { timezone: 'UTC' }
    );
    expect(mocks.processDue).not.toHaveBeenCalled();
  });

  it('stops future triggers and waits for an active invocation to finish', async () => {
    let runScheduled: (() => Promise<void>) | undefined;
    let finishProcessing: (() => void) | undefined;
    mocks.schedule.mockImplementation((_expression, callback) => {
      runScheduled = callback;
      return { stop: mocks.stop };
    });
    mocks.processDue.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishProcessing = () =>
            resolve({
              deletedCount: 1,
              skippedCount: 0,
              failureCount: 0,
              expiredTokenCount: 1,
              expiredSessionCount: 1,
              items: [],
              proofOperationDeletedCount: 0,
              proofOperationFailureCount: 0,
              proofOperations: [],
            });
        })
    );

    const lifecycle = initMembershipApplicationRetentionCron();
    const invocation = runScheduled?.();
    await lifecycle.stop();
    const idle = lifecycle.waitForIdle();

    expect(mocks.stop).toHaveBeenCalledOnce();
    expect(mocks.processDue).toHaveBeenCalledOnce();
    let idleResolved = false;
    void idle.then(() => {
      idleResolved = true;
    });
    await Promise.resolve();
    expect(idleResolved).toBe(false);

    finishProcessing?.();
    await invocation;
    await idle;
    expect(idleResolved).toBe(true);
  });
});
