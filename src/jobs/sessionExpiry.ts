import { Markup } from 'telegraf';
import { bot } from '../bot/index.js';
import {
  getSessionsNeedingReminder,
  getExpiredSessions,
  expireSessions,
  type SessionForNotification,
} from '../db/repositories/sessionRepository.js';
import { EMOJI } from '../bot/constants/emoji.js';

// Poll every 30 seconds
const POLL_INTERVAL_MS = 30 * 1000;

// Max age for reminder tracking (2 hours in ms)
const REMINDER_MAX_AGE_MS = 2 * 60 * 60 * 1000;

// Max concurrent Telegram API calls to avoid rate limiting
const MAX_CONCURRENT_NOTIFICATIONS = 5;

/**
 * Execute promises with concurrency limit
 * Processes items in batches to avoid overwhelming Telegram API
 */
async function processWithConcurrency<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }

  return results;
}

// Track sent reminders with timestamps to avoid duplicates and enable cleanup
// Map: session ID -> timestamp when reminder was sent
const sentReminders = new Map<number, number>();

// Job state
let intervalId: NodeJS.Timeout | null = null;

/**
 * Clean up old reminder tracking entries to prevent memory leaks
 * Removes entries older than REMINDER_MAX_AGE_MS
 */
function cleanupOldReminders(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [sessionId, timestamp] of sentReminders) {
    if (now - timestamp > REMINDER_MAX_AGE_MS) {
      sentReminders.delete(sessionId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} old reminder tracking entries`);
  }
}

/**
 * Format reminder message - casual & friendly per CONTEXT.md
 */
function formatReminderMessage(session: SessionForNotification): string {
  const minutesLeft = Math.max(
    1,
    Math.round((session.expiresAt.getTime() - Date.now()) / 60000)
  );
  const dogNamesText = session.dogNames.join(', ');

  return (
    `${EMOJI.reminder} ${minutesLeft} minutes left!\n` +
    `${session.locationName} • ${dogNamesText}\n\n` +
    `Want to stay longer?`
  );
}

/**
 * Format expiry message with session summary
 */
function formatExpiryMessage(session: SessionForNotification): string {
  const durationMinutes = Math.round(
    (session.expiresAt.getTime() - session.checkedInAt.getTime()) / 60000
  );
  const dogNamesText = session.dogNames.join(', ');

  return (
    `${EMOJI.checkedOut} Session ended\n\n` +
    `${EMOJI.location} ${session.locationName}\n` +
    `${EMOJI.dogs} ${dogNamesText}\n` +
    `${EMOJI.timer} ${durationMinutes} minutes\n\n` +
    `See you next time!`
  );
}

/**
 * Build inline keyboard with extend options and checkout button
 */
function buildExtendKeyboard(sessionId: number) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(`${EMOJI.extend} 15 min`, `extend_${sessionId}_15`),
      Markup.button.callback(`${EMOJI.extend} 30 min`, `extend_${sessionId}_30`),
      Markup.button.callback(`${EMOJI.extend} 60 min`, `extend_${sessionId}_60`),
    ],
    [Markup.button.callback(`${EMOJI.checkout} Checkout now`, `checkout_${sessionId}`)],
  ]);
}

/**
 * Send reminder notification to user
 */
async function sendExpiryReminder(session: SessionForNotification): Promise<void> {
  const message = formatReminderMessage(session);
  const keyboard = buildExtendKeyboard(session.id);

  try {
    await bot.telegram.sendMessage(session.telegramId, message, keyboard);
  } catch (error) {
    // User may have blocked the bot - log and continue
    console.error(
      `Failed to send reminder to user ${session.telegramId}:`,
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Send expiry notification to user (no keyboard - session ended)
 */
async function sendExpiryNotification(session: SessionForNotification): Promise<void> {
  const message = formatExpiryMessage(session);

  try {
    await bot.telegram.sendMessage(session.telegramId, message);
  } catch (error) {
    // User may have blocked the bot - log and continue
    console.error(
      `Failed to send expiry notification to user ${session.telegramId}:`,
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Process session expiry - send reminders and handle expired sessions
 * This is the main polling function called every 30 seconds
 */
export async function processSessionExpiry(): Promise<void> {
  try {
    // Clean up old reminder entries to prevent memory leaks
    cleanupOldReminders();

    // 1. Handle sessions needing reminder (expiring within 6 minutes)
    const sessionsNeedingReminder = await getSessionsNeedingReminder();

    // Filter out sessions we've already sent reminders for
    const sessionsToRemind = sessionsNeedingReminder.filter(
      session => !sentReminders.has(session.id)
    );

    // Send reminders in parallel with concurrency limit
    if (sessionsToRemind.length > 0) {
      await processWithConcurrency(
        sessionsToRemind,
        async (session) => {
          await sendExpiryReminder(session);
          sentReminders.set(session.id, Date.now());
        },
        MAX_CONCURRENT_NOTIFICATIONS
      );
    }

    // 2. Handle expired sessions
    const expiredSessions = await getExpiredSessions();

    if (expiredSessions.length > 0) {
      // Send expiry notifications in parallel with concurrency limit
      await processWithConcurrency(
        expiredSessions,
        async (session) => {
          await sendExpiryNotification(session);
          sentReminders.delete(session.id);
        },
        MAX_CONCURRENT_NOTIFICATIONS
      );

      // Batch update all expired sessions in database (more efficient)
      const expiredIds = expiredSessions.map(s => s.id);
      await expireSessions(expiredIds);
    }
  } catch (error) {
    // Log error but don't crash the job
    console.error(
      'Error processing session expiry:',
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Start the session expiry background job
 */
export function startSessionExpiryJob(): void {
  if (intervalId !== null) {
    console.warn('Session expiry job already running');
    return;
  }

  console.log('Starting session expiry job (30s interval)');

  // Run immediately on startup for catch-up (missed expiries during downtime)
  processSessionExpiry().catch((error) => {
    console.error('Error in catch-up session expiry processing:', error);
  });

  // Then run on interval
  intervalId = setInterval(() => {
    processSessionExpiry().catch((error) => {
      console.error('Error in scheduled session expiry processing:', error);
    });
  }, POLL_INTERVAL_MS);
}

/**
 * Stop the session expiry background job
 */
export function stopSessionExpiryJob(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('Session expiry job stopped');
  }
}

/**
 * Clear reminder tracking for a session (called when session is extended)
 * This allows the extended session to receive a new reminder
 */
export function clearReminderTracking(sessionId: number): void {
  sentReminders.delete(sessionId);
}
