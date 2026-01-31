import { Context } from 'telegraf';
import {
  getActiveSessionByUserId,
  checkoutSession,
  getDogsBySessionId,
} from '../../db/repositories/sessionRepository.js';
import { findOrCreateUser } from '../../db/repositories/userRepository.js';
import { getLocationById } from '../../db/locations.js';
import { EMOJI } from '../constants/emoji.js';

/**
 * /checkout command handler
 * Ends current session
 * Requirement: CMDS-05
 */
export async function checkoutHandler(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;

  if (!telegramId) {
    await ctx.reply('Could not identify your account. Please try again.');
    return;
  }

  try {
    // Find or create user
    const user = await findOrCreateUser(
      telegramId,
      ctx.from?.first_name,
      ctx.from?.username
    );

    // Get active session
    const session = await getActiveSessionByUserId(user.id);

    if (!session) {
      await ctx.reply(
        `${EMOJI.dogs} You're not checked in anywhere right now.\n\n` +
        'Use /checkin when at a dog run to start a session.'
      );
      return;
    }

    // Get location details
    const location = await getLocationById(session.locationId);

    // Get dogs in session
    const dogs = await getDogsBySessionId(session.id);

    // Checkout the session
    await checkoutSession(session.id);

    // Calculate session duration
    const durationMinutes = Math.floor(
      (Date.now() - session.checkedInAt.getTime()) / 60000
    );

    // Send confirmation
    await ctx.reply(
      `${EMOJI.checkedOut} Checked out!\n\n` +
        `${EMOJI.location} ${location?.name ?? 'Unknown'}\n` +
        `${EMOJI.dogs} ${dogs.map((d) => d.name).join(', ')}\n` +
        `${EMOJI.timer} ${durationMinutes} minutes\n\n` +
        'See you next time!'
    );
  } catch (error) {
    console.error('Error during checkout:', error);
    await ctx.reply(
      'Sorry, there was an error checking you out. Please try again.'
    );
  }
}
