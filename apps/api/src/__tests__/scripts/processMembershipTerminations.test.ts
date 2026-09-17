import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  processDue: vi.fn(),
  schedule: vi.fn(),
  stop: vi.fn(),
}));

vi.mock('../../services/membershipTerminationService', () => ({
  MembershipTerminationService: { processDue: mocks.processDue },
}));
vi.mock('node-cron', () => ({
  default: { schedule: mocks.schedule },
}));

import {
  initMembershipTerminationCron,
  processDueMembershipTerminations,
} from '../../scripts/processMembershipTerminations';

describe('membership termination scheduled invocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.schedule.mockReturnValue({ stop: mocks.stop });
    mocks.processDue.mockResolvedValue({
      asOfDate: '2026-06-30',
      processedCount: 1,
      replayedCount: 0,
      skippedCount: 0,
      failureCount: 0,
      items: [],
    });
  });

  it('passes one UTC date and processing instant to the callable processor', async () => {
    const now = new Date('2026-06-30T02:15:00.000Z');
    await processDueMembershipTerminations(now);
    expect(mocks.processDue).toHaveBeenCalledWith({
      asOfDate: '2026-06-30',
      processedAt: now,
    });
  });

  it('registers one daily UTC trigger without running immediately', () => {
    initMembershipTerminationCron();
    expect(mocks.schedule).toHaveBeenCalledWith(
      '15 2 * * *',
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
              asOfDate: '2026-06-30',
              processedCount: 1,
              replayedCount: 0,
              skippedCount: 0,
              failureCount: 0,
              items: [],
            });
        })
    );

    const lifecycle = initMembershipTerminationCron();
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
