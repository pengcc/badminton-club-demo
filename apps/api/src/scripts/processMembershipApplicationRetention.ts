import cron from 'node-cron';
import { membershipApplicationRetentionService } from '../services/membershipApplicationRetentionService';
import {
  createScheduledProcessorLifecycle,
  type ScheduledProcessorLifecycle,
} from './scheduledProcessorLifecycle';

export async function processMembershipApplicationRetention(now = new Date()) {
  const result = await membershipApplicationRetentionService.processDue(now);
  console.log('[Membership Application Retention] Processing result', {
    deletedCount: result.deletedCount,
    skippedCount: result.skippedCount,
    failureCount: result.failureCount,
    expiredTokenCount: result.expiredTokenCount,
    expiredSessionCount: result.expiredSessionCount,
    proofOperationDeletedCount: result.proofOperationDeletedCount,
    proofOperationFailureCount: result.proofOperationFailureCount,
  });
  if (result.failureCount > 0) {
    console.error('[Membership Application Retention] Some items failed', {
      items: result.items
        .filter((item) => item.outcome === 'failed')
        .map(({ applicationId, reasonCode }) => ({
          applicationId,
          reasonCode,
        })),
    });
  }
  if (result.proofOperationFailureCount > 0) {
    console.error(
      '[Membership Application Retention] Proof cleanup operations failed',
      {
        operations: result.proofOperations
          .filter((operation) => operation.outcome === 'failed')
          .map(({ applicationId, phase, reasonCode }) => ({
            applicationId,
            phase,
            reasonCode,
          })),
      }
    );
  }
  if (result.skippedCount > 0) {
    console.log('[Membership Application Retention] Items skipped', {
      items: result.items
        .filter((item) => item.outcome === 'skipped')
        .map(({ applicationId, reasonCode }) => ({
          applicationId,
          reasonCode,
        })),
    });
  }
  return result;
}

export function initMembershipApplicationRetentionCron(): ScheduledProcessorLifecycle {
  const cronExpression = '45 2 * * *';
  console.log(
    `[Membership Application Retention] Initializing daily UTC processor (${cronExpression})`
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
          await processMembershipApplicationRetention();
        } catch {
          console.error(
            '[Membership Application Retention] Processor invocation failed',
            {
              reasonCode: 'INVOCATION_FAILED',
            }
          );
        }
      }),
    { timezone: 'UTC' }
  );
  return lifecycle;
}
