import { Telegraf } from 'telegraf';
import { validateEnv } from '../config/env.js';
import { startHandler } from './handlers/start.js';
import { profileHandler } from './handlers/profile.js';
import { checkinHandler } from './handlers/checkin.js';
import { checkoutHandler } from './handlers/checkout.js';
import { liveHandler } from './handlers/live.js';

const env = validateEnv();

export const bot = new Telegraf(env.BOT_TOKEN);

// Global error handler - prevents crashes from unhandled errors
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
  ctx.reply('Sorry, something went wrong. Please try again.').catch(() => {
    // Silent fail if we can't send error message
  });
});

// Register command handlers
bot.command('start', startHandler);
bot.command('profile', profileHandler);
bot.command('checkin', checkinHandler);
bot.command('checkout', checkoutHandler);
bot.command('live', liveHandler);

// Handle "Create Dog Profile" button callback
bot.action('create_profile', async (ctx) => {
  await ctx.answerCbQuery(); // Remove loading state
  await ctx.reply(
    'Profile creation will be available in the next update!\n\n' +
    'Use /profile to check when this feature becomes available.'
  );
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
