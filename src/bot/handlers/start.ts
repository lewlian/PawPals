import { Context, Markup } from 'telegraf';
import { mainMenuKeyboard } from '../keyboards/mainMenu.js';
import { EMOJI } from '../constants/emoji.js';

/**
 * /start command handler
 * Shows welcome message with persistent reply keyboard and "Create Dog Profile" button
 * Requirement: CMDS-01
 */
export async function startHandler(ctx: Context): Promise<void> {
  const welcomeMessage = `${EMOJI.welcome} Welcome to PawPals SG!

\u2022 Check dog park occupancy
\u2022 See size breakdowns
\u2022 Never arrive to empty parks`;

  // Send welcome message with persistent reply keyboard
  await ctx.reply(welcomeMessage, mainMenuKeyboard);

  // Send separate message with inline button for profile creation
  await ctx.reply(
    'Get started by creating your dog\'s profile:',
    Markup.inlineKeyboard([[
      Markup.button.callback(`${EMOJI.dogs} Create Dog Profile`, 'create_profile')
    ]])
  );
}
