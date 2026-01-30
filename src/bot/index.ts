import { Telegraf, Scenes, session } from 'telegraf';
import { validateEnv } from '../config/env.js';
import type { BotContext } from '../types/session.js';
import { startHandler } from './handlers/start.js';
import { profileHandler } from './handlers/profile.js';
import { checkinHandler } from './handlers/checkin.js';
import { checkoutHandler } from './handlers/checkout.js';
import { liveHandler } from './handlers/live.js';
import { createDogProfileWizard } from './scenes/createDogProfile.js';

const env = validateEnv();

export const bot = new Telegraf<BotContext>(env.BOT_TOKEN);

// Global error handler - prevents crashes from unhandled errors
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
  ctx.reply('Sorry, something went wrong. Please try again.').catch(() => {
    // Silent fail if we can't send error message
  });
});

// Session middleware MUST come before stage
bot.use(session());

// Create and register stage with all scenes
const stage = new Scenes.Stage<BotContext>([createDogProfileWizard]);
bot.use(stage.middleware());

// Register command handlers
bot.command('start', startHandler);
bot.command('profile', profileHandler);
bot.command('checkin', checkinHandler);
bot.command('checkout', checkoutHandler);
bot.command('live', liveHandler);

// Handle "Create Dog Profile" button callback - enters wizard
bot.action('create_profile', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('create-dog-profile');
});

// Handle unknown commands gracefully
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  if (text.startsWith('/')) {
    await ctx.reply(
      'Unknown command. Available commands:\n' +
      '/start - Welcome message\n' +
      '/profile - Manage dog profiles\n' +
      '/checkin - Check in at dog run\n' +
      '/checkout - End session\n' +
      '/live - View live occupancy'
    );
  }
});
