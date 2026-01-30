# Phase 4: Session Automation - Research

**Researched:** 2026-01-30
**Domain:** Background job scheduling, Telegram proactive messaging, inline keyboard callbacks for session extension
**Confidence:** HIGH

## Summary

Phase 4 implements session auto-expiration with user notifications and extension capabilities. The standard approach uses in-process polling with `setInterval` for background jobs (acceptable given the ~1 minute accuracy requirement), `bot.telegram.sendMessage()` for proactive notifications to users, and inline keyboard callbacks with session ID parameters for extend/checkout actions.

The architecture requires: (1) a background job that polls the database for sessions approaching expiry or already expired, (2) database queries to find sessions needing reminders (5 min before expiry) and expired sessions, (3) proactive messaging using stored `telegram_id` from users table, (4) inline keyboards with callback data patterns like `extend_session_123_15` for session extension, and (5) database operations to update `expires_at` when extending or mark sessions as expired.

Key decisions from CONTEXT.md constrain the approach: unlimited extensions allowed, offer 15/30/60 minute extension options (matching check-in), best-effort ~1 minute accuracy, in-memory reminder tracking, and catch-up processing on bot restart. The tone should be casual and friendly for notifications.

**Primary recommendation:** Use `setInterval` with 30-60 second polling interval for background job (in-process, no external dependencies), track sent reminders in a `Set<number>` (session IDs), use `bot.telegram.sendMessage(telegramId, message, { reply_markup })` for proactive notifications, and implement extend/checkout as inline keyboard callbacks with session validation.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| telegraf | 4.16.3+ | Proactive messaging via `bot.telegram.sendMessage()` | Already in stack; provides direct Telegram API access outside of update handlers |
| pg (node-postgres) | 8.x | Session queries with timestamp comparisons | Already in stack; efficient TIMESTAMPTZ queries for expiry detection |
| Node.js built-in | `setInterval` | Background polling | Zero dependencies; sufficient for ~1 min accuracy; restarts with bot |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None required | - | - | In-process polling sufficient for this use case |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| setInterval | node-schedule | Overkill for simple interval polling; adds dependency; no cron syntax needed |
| setInterval | BullMQ/Agenda | Requires Redis/MongoDB; persistence unnecessary given catch-up-on-restart design |
| In-process polling | External cron + HTTP endpoint | More complex deployment; unnecessary for single-instance bot |
| In-memory reminder tracking | PostgreSQL reminder_sent_at column | Database column would be more reliable but adds schema change; in-memory acceptable per CONTEXT.md |

**Installation:**
```bash
# No new packages required - all functionality available in existing stack
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── bot/
│   ├── handlers/
│   │   ├── checkout.ts          # Existing - manual checkout
│   │   └── sessionCallbacks.ts  # NEW - extend/checkout button handlers
│   └── index.ts                 # Register callback handlers
├── jobs/                        # NEW directory
│   ├── sessionExpiry.ts         # Background job for expiry processing
│   └── index.ts                 # Job initialization and cleanup
├── db/
│   └── repositories/
│       └── sessionRepository.ts # Add expiry queries + extend function
└── index.ts                     # Initialize jobs on startup
```

### Pattern 1: In-Process Background Job with setInterval
**What:** Polling loop that checks for sessions needing reminders or expiration
**When to use:** Bot startup; runs continuously until shutdown
**Example:**
```typescript
// Source: Node.js best practices + CONTEXT.md constraints
// src/jobs/sessionExpiry.ts
import { bot } from '../bot/index.js';
import {
  getSessionsNeedingReminder,
  getExpiredSessions,
  expireSessions,
  getSessionWithDetails
} from '../db/repositories/sessionRepository.js';
import { Markup } from 'telegraf';

// In-memory tracking of sent reminders (best-effort, per CONTEXT.md)
const sentReminders = new Set<number>();

// Polling interval: 30 seconds provides ~1 min accuracy with buffer
const POLL_INTERVAL_MS = 30 * 1000;

let intervalId: NodeJS.Timeout | null = null;

export async function processSessionExpiry(): Promise<void> {
  try {
    // 1. Send reminders for sessions expiring in ~5 minutes
    const reminderSessions = await getSessionsNeedingReminder();

    for (const session of reminderSessions) {
      // Skip if already sent (best-effort deduplication)
      if (sentReminders.has(session.id)) {
        continue;
      }

      await sendExpiryReminder(session);
      sentReminders.add(session.id);
    }

    // 2. Process expired sessions
    const expiredSessions = await getExpiredSessions();

    for (const session of expiredSessions) {
      await sendExpiryNotification(session);
      await expireSessions([session.id]);

      // Clean up reminder tracking
      sentReminders.delete(session.id);
    }
  } catch (error) {
    console.error('Error in session expiry job:', error);
    // Job continues on next interval
  }
}

export function startSessionExpiryJob(): void {
  if (intervalId) {
    console.warn('Session expiry job already running');
    return;
  }

  console.log('Starting session expiry job (30s interval)');

  // Run immediately on startup to catch up
  processSessionExpiry().catch(console.error);

  // Then run on interval
  intervalId = setInterval(() => {
    processSessionExpiry().catch(console.error);
  }, POLL_INTERVAL_MS);
}

export function stopSessionExpiryJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('Session expiry job stopped');
  }
}
```

### Pattern 2: Proactive Messaging to Users
**What:** Send messages to users without them initiating contact
**When to use:** Reminder and expiry notifications
**Example:**
```typescript
// Source: Telegram Bot API + Telegraf documentation
// Requires: user's telegram_id (stored in users table)
import { bot } from '../bot/index.js';
import { Markup } from 'telegraf';

interface SessionWithDetails {
  id: number;
  telegramId: number;  // From users table join
  locationName: string;
  dogNames: string[];
  expiresAt: Date;
  checkedInAt: Date;
}

async function sendExpiryReminder(session: SessionWithDetails): Promise<void> {
  const minutesLeft = Math.round(
    (session.expiresAt.getTime() - Date.now()) / 60000
  );

  const dogList = session.dogNames.join(', ');

  const message =
    `Hey! Your session at ${session.locationName} ends in ${minutesLeft} mins.\n\n` +
    `Dog(s): ${dogList}\n\n` +
    `Want to stay longer?`;

  // Inline keyboard with extend options (matching check-in durations)
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('15 min', `extend_${session.id}_15`),
      Markup.button.callback('30 min', `extend_${session.id}_30`),
      Markup.button.callback('60 min', `extend_${session.id}_60`)
    ],
    [Markup.button.callback('Checkout now', `checkout_${session.id}`)]
  ]);

  try {
    await bot.telegram.sendMessage(session.telegramId, message, keyboard);
  } catch (error) {
    // User may have blocked bot or deleted account
    console.error(`Failed to send reminder to user ${session.telegramId}:`, error);
  }
}

async function sendExpiryNotification(session: SessionWithDetails): Promise<void> {
  const durationMinutes = Math.round(
    (Date.now() - session.checkedInAt.getTime()) / 60000
  );

  const dogList = session.dogNames.join(', ');

  const message =
    `Your session at ${session.locationName} has ended.\n\n` +
    `Dog(s): ${dogList}\n` +
    `Duration: ${durationMinutes} minutes\n\n` +
    `See you next time!`;

  try {
    await bot.telegram.sendMessage(session.telegramId, message);
  } catch (error) {
    console.error(`Failed to send expiry notification to user ${session.telegramId}:`, error);
  }
}
```

### Pattern 3: Inline Keyboard Callbacks for Extend/Checkout
**What:** Handle button presses from reminder notifications
**When to use:** User taps extend or checkout button from notification
**Example:**
```typescript
// Source: Telegraf callback patterns + existing codebase
// src/bot/handlers/sessionCallbacks.ts
import { Markup } from 'telegraf';
import type { BotContext } from '../../types/session.js';
import {
  extendSession,
  checkoutSession,
  findSessionById,
  getDogsBySessionId
} from '../../db/repositories/sessionRepository.js';
import { getLocationById } from '../../db/locations.js';

// Handle extend button: extend_123_15 (sessionId_minutes)
export async function handleExtendCallback(ctx: BotContext): Promise<void> {
  await ctx.answerCbQuery();

  const match = ctx.match as RegExpMatchArray;
  const sessionId = parseInt(match[1] ?? '0', 10);
  const minutes = parseInt(match[2] ?? '15', 10);

  // Validate session exists and is still active
  const session = await findSessionById(sessionId);

  if (!session) {
    await ctx.editMessageText(
      'This session no longer exists.'
    );
    return;
  }

  if (session.status !== 'active') {
    // Session already expired - offer fresh check-in
    await ctx.editMessageText(
      'This session has already ended.\n\n' +
      'Want to start a new session? Use /checkin at a dog run!'
    );
    return;
  }

  // Extend the session
  const extended = await extendSession(sessionId, minutes);

  if (!extended) {
    await ctx.editMessageText(
      'Could not extend session. Please try /checkin to start a new session.'
    );
    return;
  }

  const newExpiryTime = extended.expiresAt.toLocaleTimeString('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const location = await getLocationById(extended.locationId);

  await ctx.editMessageText(
    `Session extended by ${minutes} minutes!\n\n` +
    `Location: ${location?.name}\n` +
    `New end time: ${newExpiryTime}\n\n` +
    `I'll remind you again before it expires.`
  );
}

// Handle checkout button: checkout_123 (sessionId)
export async function handleCheckoutCallback(ctx: BotContext): Promise<void> {
  await ctx.answerCbQuery();

  const match = ctx.match as RegExpMatchArray;
  const sessionId = parseInt(match[1] ?? '0', 10);

  const session = await findSessionById(sessionId);

  if (!session || session.status !== 'active') {
    await ctx.editMessageText(
      'This session has already ended.'
    );
    return;
  }

  // Get session details before checkout
  const location = await getLocationById(session.locationId);
  const dogs = await getDogsBySessionId(session.id);

  // Checkout the session
  await checkoutSession(sessionId);

  const durationMinutes = Math.round(
    (Date.now() - session.checkedInAt.getTime()) / 60000
  );

  await ctx.editMessageText(
    `Checked out successfully!\n\n` +
    `Location: ${location?.name}\n` +
    `Dog(s): ${dogs.map(d => d.name).join(', ')}\n` +
    `Duration: ${durationMinutes} minutes\n\n` +
    `See you next time!`
  );
}
```

### Pattern 4: Database Queries for Expiry Processing
**What:** Efficient queries to find sessions needing action
**When to use:** Background job polling
**Example:**
```typescript
// Source: PostgreSQL timestamp patterns
// Add to src/db/repositories/sessionRepository.ts

interface SessionForNotification {
  id: number;
  userId: number;
  telegramId: number;
  locationId: number;
  locationName: string;
  checkedInAt: Date;
  expiresAt: Date;
  dogNames: string[];
}

/**
 * Get active sessions expiring within 5-6 minutes
 * Window accounts for polling interval variance
 */
export async function getSessionsNeedingReminder(): Promise<SessionForNotification[]> {
  const result = await pool.query<{
    id: number;
    user_id: number;
    telegram_id: string;
    location_id: number;
    location_name: string;
    checked_in_at: Date;
    expires_at: Date;
    dog_names: string[];
  }>(
    `SELECT
       s.id,
       s.user_id,
       u.telegram_id,
       s.location_id,
       l.name as location_name,
       s.checked_in_at,
       s.expires_at,
       ARRAY_AGG(d.name ORDER BY d.name) as dog_names
     FROM sessions s
     INNER JOIN users u ON s.user_id = u.id
     INNER JOIN locations l ON s.location_id = l.id
     INNER JOIN session_dogs sd ON s.id = sd.session_id
     INNER JOIN dogs d ON sd.dog_id = d.id
     WHERE s.status = 'active'
       AND s.expires_at > NOW()
       AND s.expires_at <= NOW() + INTERVAL '6 minutes'
     GROUP BY s.id, u.telegram_id, l.name
     ORDER BY s.expires_at ASC`,
    []
  );

  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    telegramId: parseInt(row.telegram_id, 10),
    locationId: row.location_id,
    locationName: row.location_name,
    checkedInAt: row.checked_in_at,
    expiresAt: row.expires_at,
    dogNames: row.dog_names
  }));
}

/**
 * Get sessions that have expired but not yet processed
 */
export async function getExpiredSessions(): Promise<SessionForNotification[]> {
  const result = await pool.query<{
    id: number;
    user_id: number;
    telegram_id: string;
    location_id: number;
    location_name: string;
    checked_in_at: Date;
    expires_at: Date;
    dog_names: string[];
  }>(
    `SELECT
       s.id,
       s.user_id,
       u.telegram_id,
       s.location_id,
       l.name as location_name,
       s.checked_in_at,
       s.expires_at,
       ARRAY_AGG(d.name ORDER BY d.name) as dog_names
     FROM sessions s
     INNER JOIN users u ON s.user_id = u.id
     INNER JOIN locations l ON s.location_id = l.id
     INNER JOIN session_dogs sd ON s.id = sd.session_id
     INNER JOIN dogs d ON sd.dog_id = d.id
     WHERE s.status = 'active'
       AND s.expires_at <= NOW()
     GROUP BY s.id, u.telegram_id, l.name
     ORDER BY s.expires_at ASC`,
    []
  );

  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    telegramId: parseInt(row.telegram_id, 10),
    locationId: row.location_id,
    locationName: row.location_name,
    checkedInAt: row.checked_in_at,
    expiresAt: row.expires_at,
    dogNames: row.dog_names
  }));
}

/**
 * Mark sessions as expired (batch operation)
 */
export async function expireSessions(sessionIds: number[]): Promise<void> {
  if (sessionIds.length === 0) return;

  await pool.query(
    `UPDATE sessions
     SET status = 'expired',
         updated_at = NOW()
     WHERE id = ANY($1)`,
    [sessionIds]
  );
}

/**
 * Extend a session by adding minutes to expires_at
 */
export async function extendSession(
  sessionId: number,
  additionalMinutes: number
): Promise<Session | null> {
  const result = await pool.query<SessionRow>(
    `UPDATE sessions
     SET expires_at = expires_at + ($2 || ' minutes')::INTERVAL,
         updated_at = NOW()
     WHERE id = $1 AND status = 'active'
     RETURNING *`,
    [sessionId, additionalMinutes]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRowToSession(result.rows[0]!);
}
```

### Pattern 5: Graceful Startup and Shutdown
**What:** Initialize background job on bot start, clean up on shutdown
**When to use:** Application lifecycle
**Example:**
```typescript
// Source: Node.js process handling patterns
// src/index.ts modifications
import { bot } from './bot/index.js';
import { closePool, checkConnection } from './db/client.js';
import { startSessionExpiryJob, stopSessionExpiryJob } from './jobs/sessionExpiry.js';

async function main(): Promise<void> {
  console.log('Starting PawPals SG bot...');

  // Verify database connection
  const dbConnected = await checkConnection();
  if (!dbConnected) {
    console.error('Failed to connect to database. Exiting.');
    process.exit(1);
  }
  console.log('Database connected');

  // Start background jobs
  startSessionExpiryJob();

  // Launch bot in polling mode
  await bot.launch();
  console.log('Bot is running!');
}

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  try {
    // Stop background jobs first
    stopSessionExpiryJob();
    console.log('Background jobs stopped');

    bot.stop(signal);
    console.log('Bot stopped');

    await closePool();
    console.log('Database pool closed');

    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

main().catch((err) => {
  console.error('Failed to start bot:', err);
  process.exit(1);
});
```

### Anti-Patterns to Avoid
- **Don't use setTimeout for each session** - Creates unbounded timers; memory leak risk; lost on restart
- **Don't store reminder state in database** - CONTEXT.md specifies in-memory; adds schema complexity
- **Don't poll every second** - Wastes resources; 30s interval provides ~1 min accuracy
- **Don't block on failed notifications** - User may have blocked bot; log and continue
- **Don't forget to clear reminder tracking on extend** - Extended sessions need new reminder
- **Don't assume callback messages exist** - User may have deleted message; handle gracefully

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scheduling | Custom timer management | `setInterval` for simple polling | Node.js built-in; reliable for in-process jobs; no dependencies |
| Proactive messaging | Context-based `ctx.reply()` | `bot.telegram.sendMessage(chatId, ...)` | Works outside update handlers; uses stored telegram_id |
| Time calculations | Manual date math | PostgreSQL `INTERVAL` syntax | Database handles timezone; `expires_at + '15 minutes'::INTERVAL` |
| Button data parsing | Complex JSON encoding | Simple pattern `extend_123_15` | Callback data limited to 64 bytes; string patterns sufficient |
| Batch updates | Looping single updates | PostgreSQL `ANY($1)` with array | Single query for multiple IDs; better performance |

**Key insight:** The session automation pattern is a polling loop with proactive messaging. Keep it simple with `setInterval` rather than adding external scheduler dependencies, since ~1 minute accuracy is acceptable and catch-up-on-restart is explicitly allowed.

## Common Pitfalls

### Pitfall 1: Lost Timers on Bot Restart
**What goes wrong:** Sessions don't get expiry notifications if bot restarts during their active period
**Why it happens:** In-memory state (setTimeout/setInterval) lost on process termination
**How to avoid:**
- Run catch-up query on startup (process any missed expiries immediately)
- Store expiry time in database, not in-memory timers
- Poll database for expired sessions, don't rely on scheduled callbacks
**Warning signs:** Users report "my session never expired" after bot restarts

### Pitfall 2: Duplicate Notifications
**What goes wrong:** User receives multiple reminders for same session
**Why it happens:** Polling interval overlaps with reminder window; no deduplication
**How to avoid:**
- Track sent reminders in `Set<number>` (session IDs)
- Clear tracking when session expires or extends
- Use reminder window slightly larger than poll interval (6 min window, 30s poll)
**Warning signs:** Users complain about spam, multiple identical messages

### Pitfall 3: Stale Inline Keyboard Buttons
**What goes wrong:** User taps "Extend" on expired session, gets error or unexpected behavior
**Why it happens:** Notification sent before expiry; user taps button after expiry
**How to avoid:**
- Always validate session status in callback handler
- Provide helpful message if session already expired (offer fresh check-in)
- Use `ctx.editMessageText()` to update the notification message
**Warning signs:** Users confused by "session not found" after tapping button

### Pitfall 4: Bot Blocked by User
**What goes wrong:** `sendMessage` throws error, job crashes or hangs
**Why it happens:** User blocked bot, deleted account, or privacy settings
**How to avoid:**
- Wrap `sendMessage` in try/catch
- Log error but continue processing other sessions
- Consider marking user as unreachable after repeated failures
**Warning signs:** Error logs show Telegram API errors 403 (blocked) or 400 (chat not found)

### Pitfall 5: Timezone Confusion in Notifications
**What goes wrong:** "Expires at 3:00 PM" shows wrong time for user
**Why it happens:** Server timezone differs from user's timezone (Singapore)
**How to avoid:**
- Use `toLocaleTimeString('en-SG', ...)` for Singapore timezone
- Store all times as TIMESTAMPTZ in database
- Let PostgreSQL handle timezone-aware comparisons
**Warning signs:** Users say expiry time doesn't match their clock

### Pitfall 6: Callback Data Overflow
**What goes wrong:** Inline keyboard button doesn't work
**Why it happens:** Telegram callback_data has 64-byte limit; complex data exceeds it
**How to avoid:**
- Use simple patterns: `extend_123_15` (16 bytes max)
- Never serialize objects to callback_data
- Store complex state in database, reference by ID
**Warning signs:** Buttons silently fail, no callback received

## Code Examples

Verified patterns from official sources:

### Complete Job Initialization
```typescript
// Source: Node.js setInterval patterns + existing codebase structure
// src/jobs/index.ts
import { startSessionExpiryJob, stopSessionExpiryJob } from './sessionExpiry.js';

export function startAllJobs(): void {
  console.log('Initializing background jobs...');
  startSessionExpiryJob();
  console.log('Background jobs started');
}

export function stopAllJobs(): void {
  console.log('Stopping background jobs...');
  stopSessionExpiryJob();
  console.log('Background jobs stopped');
}
```

### Registering Callback Handlers
```typescript
// Source: Telegraf action patterns + existing bot/index.ts structure
// Add to src/bot/index.ts

import { handleExtendCallback, handleCheckoutCallback } from './handlers/sessionCallbacks.js';

// ... existing code ...

// Session automation callback handlers
bot.action(/^extend_(\d+)_(\d+)$/, handleExtendCallback);
bot.action(/^checkout_(\d+)$/, handleCheckoutCallback);
```

### Expiry Reminder Message Format
```typescript
// Source: CONTEXT.md tone requirements
function formatReminderMessage(session: SessionForNotification): string {
  const minutesLeft = Math.max(1, Math.round(
    (session.expiresAt.getTime() - Date.now()) / 60000
  ));

  const dogList = session.dogNames.join(', ');

  return (
    `Hey! Your session at ${session.locationName} ends in ${minutesLeft} min${minutesLeft > 1 ? 's' : ''}.\n\n` +
    `Dog(s): ${dogList}\n\n` +
    `Want to stay longer?`
  );
}

function formatExpiryMessage(session: SessionForNotification): string {
  const durationMinutes = Math.round(
    (session.expiresAt.getTime() - session.checkedInAt.getTime()) / 60000
  );

  const dogList = session.dogNames.join(', ');

  return (
    `Your session at ${session.locationName} has ended.\n\n` +
    `Dog(s): ${dogList}\n` +
    `Duration: ${durationMinutes} minutes\n\n` +
    `See you next time!`
  );
}
```

### Extension Keyboard Builder
```typescript
// Source: CONTEXT.md - extension durations match check-in options
function buildExtendKeyboard(sessionId: number) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('15 min', `extend_${sessionId}_15`),
      Markup.button.callback('30 min', `extend_${sessionId}_30`),
      Markup.button.callback('60 min', `extend_${sessionId}_60`)
    ],
    [Markup.button.callback('Checkout now', `checkout_${sessionId}`)]
  ]);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-session setTimeout | Polling with setInterval | Best practice | Survives restarts; simpler debugging; bounded memory |
| External cron + webhook | In-process polling | For simple bots | No infrastructure complexity; single deployment unit |
| Database-stored reminder flags | In-memory Set | Per CONTEXT.md | Simpler; acceptable for best-effort reminder tracking |
| Complex callback JSON | Simple string patterns | Telegram 64-byte limit | Reliable; easier parsing; fits limit |

**Deprecated/outdated:**
- **node-schedule for simple intervals:** Overkill; `setInterval` is cleaner for fixed polling
- **Agenda/BullMQ for in-process jobs:** Adds MongoDB/Redis dependency; unnecessary for single-instance bot
- **Context-based messaging for notifications:** `ctx.reply()` only works in update handlers; use `bot.telegram.sendMessage()` for proactive messages

## Open Questions

Things that couldn't be fully resolved:

1. **Should reminder tracking persist across restarts?**
   - What we know: CONTEXT.md says "in-memory (best effort, may re-send on restart)"
   - What's unclear: Acceptable duplicate reminder rate; user experience impact
   - Recommendation: Accept occasional duplicates near restart; users understand "reminder" intent

2. **What if proactive message fails repeatedly?**
   - What we know: Users can block bots; Telegram returns 403 error
   - What's unclear: Should we mark sessions as "unnotifiable" after N failures?
   - Recommendation: Log failures; don't mark users; they may unblock later

3. **Should extend reset the reminder tracking?**
   - What we know: Extended sessions should get new reminders per CONTEXT.md
   - What's unclear: Should we remove session ID from Set on extend, or track reminder count?
   - Recommendation: Remove from Set on extend; simpler; allows new reminder for new expiry

## Sources

### Primary (HIGH confidence)
- [Telegram Bot API - sendMessage](https://core.telegram.org/bots/api#sendmessage) - Official method for proactive messaging
- [Telegraf Documentation](https://telegraf.js.org/) - `bot.telegram.sendMessage()` pattern for out-of-context messaging
- [Node.js Timers](https://nodejs.org/api/timers.html) - Built-in setInterval for polling
- [PostgreSQL INTERVAL](https://www.postgresql.org/docs/current/datatype-datetime.html) - Timestamp arithmetic for expiry extension
- Existing codebase: `sessionRepository.ts`, `bot/index.ts` - Established patterns

### Secondary (MEDIUM confidence)
- [Better Stack: Node.js Schedulers](https://betterstack.com/community/guides/scaling-nodejs/best-nodejs-schedulers/) - Comparison showing setInterval sufficiency for simple cases
- [Telegraf GitHub Issue #204](https://github.com/telegraf/telegraf/issues/204) - Proactive messaging patterns
- [Latenode Community](https://community.latenode.com/t/creating-a-telegram-bot-to-send-automated-messages-using-telegraf-js/6864) - Automated message examples

### Tertiary (LOW confidence)
- Community discussions on callback_data size limits
- Medium articles on Telegram notification patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing stack (Telegraf, pg); no new dependencies
- Architecture: HIGH - In-process polling is well-established pattern; proactive messaging documented
- Pitfalls: HIGH - Based on Telegram API documentation and common bot issues
- Code examples: HIGH - Adapted from existing codebase patterns and official docs

**Research date:** 2026-01-30
**Valid until:** 2026-03-30 (60 days) - Stable domain; setInterval and Telegram API unchanged
