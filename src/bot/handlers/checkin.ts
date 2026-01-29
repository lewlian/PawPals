import { Context } from 'telegraf';

/**
 * /checkin command handler
 * Initiates check-in flow (placeholder for Phase 3)
 * Requirement: CMDS-03
 */
export async function checkinHandler(ctx: Context): Promise<void> {
  await ctx.reply(
    'Check-in feature coming soon!\n\n' +
    'When available, you will:\n' +
    '1. Share your location\n' +
    '2. Select which dog(s) to check in\n' +
    '3. Choose your stay duration\n\n' +
    'First, create a dog profile using /profile'
  );
}
