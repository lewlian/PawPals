import { Context } from 'telegraf';

/**
 * /start command handler
 * Shows welcome message with "Create Dog Profile" button
 * Requirement: CMDS-01
 */
export async function startHandler(ctx: Context): Promise<void> {
  const welcomeMessage = `Welcome to PawPals SG!

Check real-time dog run occupancy across Singapore before making the trip.

Get started by creating your dog's profile, then check in when you arrive at a dog run.

Commands:
/profile - Manage your dog profiles
/checkin - Check in at a dog run
/checkout - End your current session
/live - View live occupancy`;

  await ctx.reply(welcomeMessage, {
    reply_markup: {
      inline_keyboard: [[
        { text: 'Create Dog Profile', callback_data: 'create_profile' }
      ]]
    }
  });
}
