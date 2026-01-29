import { Context } from 'telegraf';

/**
 * /checkout command handler
 * Ends current session (placeholder for Phase 3)
 * Requirement: CMDS-05
 */
export async function checkoutHandler(ctx: Context): Promise<void> {
  await ctx.reply(
    'Checkout feature coming soon!\n\n' +
    'You are not currently checked in to any dog run.\n' +
    'Use /checkin when at a dog run to start a session.'
  );
}
