import { Context } from 'telegraf';
import {
  getActiveSessionByUserId,
  checkoutSession,
  getDogsBySessionId,
} from '../../db/repositories/sessionRepository.js';
import { findOrCreateUser } from '../../db/repositories/userRepository.js';
import { getLocationById } from '../../db/locations.js';

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
        'You are not currently checked in to any dog run. Use /checkin when at a dog run to start a session.'
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
      '✅ Checked out successfully!\n\n' +
        `Location: ${location?.name ?? 'Unknown'}\n` +
        `Dog(s): ${dogs.map((d) => d.name).join(', ')}\n` +
        `Session duration: ${durationMinutes} minutes\n\n` +
        'Thanks for using PawPals SG!'
    );
  } catch (error) {
    console.error('Error during checkout:', error);
    await ctx.reply(
      'Sorry, there was an error checking you out. Please try again.'
    );
  }
}
