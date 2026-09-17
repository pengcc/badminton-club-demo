import cron from 'node-cron';
import { MembershipTerminationService } from '../services/membershipTerminationService';
import { berlinDateOnly } from '../services/membershipTerminationPolicy';
import {
  createScheduledProcessorLifecycle,
  type ScheduledProcessorLifecycle,
} from './scheduledProcessorLifecycle';

export async function processDueMembershipTerminations(now = new Date()) {
  const result = await MembershipTerminationService.processDue({
    asOfDate: berlinDateOnly(now),
    processedAt: now,
  });
  console.log('[Membership Terminations] Processing result', {
    asOfDate: result.asOfDate,
    processedCount: result.processedCount,
    replayedCount: result.replayedCount,
    skippedCount: result.skippedCount,
    failureCount: result.failureCount,
  });
  if (result.failureCount > 0) {
    console.error('[Membership Terminations] Some items failed', {
      failureCount: result.failureCount,
      failedTerminationIds: result.items
        .filter((item) => item.outcome === 'failed')
        .map((item) => item.terminationId),
    });
  }
  return result;
}

export function initMembershipTerminationCron(): ScheduledProcessorLifecycle {
  const cronExpression = '15 2 * * *';
  console.log(
    `[Membership Terminations] Initializing daily UTC processor (${cronExpression})`
  );
  let scheduledTask: { stop(): void | Promise<void> } | undefined;
  const lifecycle = createScheduledProcessorLifecycle(() =>
    scheduledTask?.stop()
  );
  scheduledTask = cron.schedule(
    cronExpression,
    () =>
      lifecycle.run(async () => {
        try {
          await processDueMembershipTerminations();
        } catch (error) {
          console.error(
            '[Membership Terminations] Processor invocation failed',
            {
              message: error instanceof Error ? error.message : 'Unknown error',
            }
          );
        }
      }),
    { timezone: 'UTC' }
  );
  return lifecycle;
}
