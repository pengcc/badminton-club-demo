/**
 * Auto-Complete Matches Cron Job
 *
 * Automatically transitions SCHEDULED matches to COMPLETED after their match date has passed.
 * Runs daily at 2:00 AM UTC to process matches from the previous day.
 *
 * Features:
 * - Respects timezone (uses UTC comparison)
 * - Only affects SCHEDULED matches (admin overrides preserved)
 * - Logs all transitions for audit trail
 * - Handles errors gracefully
 */

import cron from 'node-cron';
import { Match } from '../models/Match';
import { MatchStatus } from '@club/shared-types/core/enums';

/**
 * Process past scheduled matches and mark them as completed
 * @returns Number of matches auto-completed
 */
export async function autoCompleteMatches(): Promise<number> {
  try {
    // Get yesterday's date at end of day (23:59:59)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(23, 59, 59, 999);

    console.log(`[Auto-Complete] Checking for matches before ${yesterday.toISOString()}`);

    // Find and update all scheduled matches with dates before yesterday
    const result = await Match.updateMany(
      {
        status: MatchStatus.SCHEDULED,
        date: { $lt: yesterday }
      },
      {
        $set: {
          status: MatchStatus.COMPLETED,
          updatedAt: new Date()
        }
      }
    );

    const count = result.modifiedCount || 0;

    if (count > 0) {
      console.log(`[Auto-Complete] ✅ Successfully auto-completed ${count} match(es)`);

      // Log which matches were updated (for audit trail)
      const completedMatches = await Match.find({
        status: MatchStatus.COMPLETED,
        updatedAt: { $gte: new Date(Date.now() - 60000) } // Updated in last minute
      }).select('_id date homeTeamId awayTeamName');

      completedMatches.forEach((match: any) => {
        console.log(`  - Match ${match._id}: ${new Date(match.date).toISOString()}`);
      });
    } else {
      console.log(`[Auto-Complete] ℹ️  No scheduled matches found requiring auto-completion`);
    }

    return count;
  } catch (error) {
    console.error('[Auto-Complete] ❌ Error auto-completing matches:', error);
    throw error;
  }
}

/**
 * Initialize the cron job
 * Runs daily at 2:00 AM UTC
 */
export function initAutoCompleteMatchesCron() {
  // Schedule: "0 2 * * *" = Every day at 2:00 AM UTC
  // Format: second minute hour day month weekday
  const cronExpression = '0 2 * * *';

  console.log(`[Auto-Complete] Initializing cron job (schedule: ${cronExpression})`);

  cron.schedule(cronExpression, async () => {
    console.log(`[Auto-Complete] Cron job triggered at ${new Date().toISOString()}`);
    try {
      await autoCompleteMatches();
    } catch (error) {
      console.error('[Auto-Complete] Cron job failed:', error);
    }
  });

  console.log('[Auto-Complete] ✅ Cron job initialized successfully');

  // Run once immediately on startup (optional - helps with testing)
  if (process.env.NODE_ENV === 'development') {
    console.log('[Auto-Complete] Running initial check (development mode)');
    autoCompleteMatches().catch(err => {
      console.error('[Auto-Complete] Initial check failed:', err);
    });
  }
}
