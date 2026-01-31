import type { BotContext } from '../../types/session.js';
import {
  findSessionById,
  extendSession,
  checkoutSession,
  getDogsBySessionId,
} from '../../db/repositories/sessionRepository.js';
import { getLocationById } from '../../db/locations.js';
import { clearReminderTracking } from '../../jobs/sessionExpiry.js';
import { EMOJI } from '../constants/emoji.js';

// Context type for regex action callbacks (includes match array from Telegraf)
type ActionContext = BotContext & { match: RegExpExecArray };

/**
 * Handle extend button callback: extend_123_15 (sessionId_minutes)
 * Validates session is active before extending
 */
export async function handleExtendCallback(ctx: ActionContext): Promise<void> {
  await ctx.answerCbQuery();

  const match = ctx.match;
  const sessionId = parseInt(match[1] ?? '0', 10);
  const minutes = parseInt(match[2] ?? '15', 10);

  // Validate session exists
  const session = await findSessionById(sessionId);

  if (!session) {
    await ctx.editMessageText('This session no longer exists.');
    return;
  }

  // Check if session is still active
  if (session.status !== 'active') {
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

  // Clear reminder tracking so extended session can get new reminder
  clearReminderTracking(sessionId);

  // Format new expiry time in Singapore timezone
  const newExpiryTime = extended.expiresAt.toLocaleTimeString('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  // Get location name
  const location = await getLocationById(extended.locationId);

  await ctx.editMessageText(
    `${EMOJI.checkedIn} Session extended!\n\n` +
      `${EMOJI.location} ${location?.name ?? 'Unknown'}\n` +
      `${EMOJI.timer} New end time: ${newExpiryTime}\n\n` +
      `I'll remind you before it expires.`
  );
}

/**
 * Handle checkout button callback: checkout_123 (sessionId)
 * Validates session is active before checking out
 */
export async function handleCheckoutCallback(ctx: ActionContext): Promise<void> {
  await ctx.answerCbQuery();

  const match = ctx.match;
  const sessionId = parseInt(match[1] ?? '0', 10);

  // Validate session exists
  const session = await findSessionById(sessionId);

  if (!session) {
    await ctx.editMessageText('This session no longer exists.');
    return;
  }

  // Check if session is still active
  if (session.status !== 'active') {
    await ctx.editMessageText('This session has already ended.');
    return;
  }

  // Get session details before checkout
  const location = await getLocationById(session.locationId);
  const dogs = await getDogsBySessionId(session.id);
  const dogNames = dogs.map((d) => d.name).join(', ');

  // Checkout the session
  await checkoutSession(sessionId);

  // Calculate duration in minutes
  const durationMinutes = Math.round(
    (Date.now() - session.checkedInAt.getTime()) / 60000
  );

  await ctx.editMessageText(
    `${EMOJI.checkedOut} Checked out!\n\n` +
      `${EMOJI.location} ${location?.name ?? 'Unknown'}\n` +
      `${EMOJI.dogs} ${dogNames}\n` +
      `${EMOJI.timer} ${durationMinutes} minutes\n\n` +
      `See you next time!`
  );
}
