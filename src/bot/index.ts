import { Telegraf, Scenes, session, Markup } from 'telegraf';
import { validateEnv } from '../config/env.js';
import type { BotContext } from '../types/session.js';
import { startHandler } from './handlers/start.js';
import {
  profileHandler,
  formatDogProfile,
  buildDogDetailKeyboard,
} from './handlers/profile.js';
import { checkinHandler } from './handlers/checkin.js';
import { checkoutHandler } from './handlers/checkout.js';
import { liveHandler } from './handlers/live.js';
import { createDogProfileWizard } from './scenes/createDogProfile.js';
import { findDogById, deleteDog } from '../db/repositories/dogRepository.js';

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

// Handle view dog detail
bot.action(/^view_dog_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const dogId = parseInt(ctx.match[1] ?? '0', 10);
  const dog = await findDogById(dogId);

  if (!dog) {
    await ctx.editMessageText('Dog not found. It may have been deleted.');
    return;
  }

  const message = formatDogProfile(dog);
  const keyboard = buildDogDetailKeyboard(dog.id);

  await ctx.editMessageText(message, keyboard);
});

// Handle "Back to List" - return to profile list
bot.action('profile_list', async (ctx) => {
  await ctx.answerCbQuery();
  await profileHandler(ctx);
});

// Handle delete dog request - show confirmation
bot.action(/^delete_dog_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const dogId = parseInt(ctx.match[1] ?? '0', 10);
  const dog = await findDogById(dogId);

  if (!dog) {
    await ctx.editMessageText('Dog not found. It may have been deleted.');
    return;
  }

  await ctx.editMessageText(
    `Are you sure you want to delete ${dog.name}?\n\nThis cannot be undone.`,
    Markup.inlineKeyboard([
      [Markup.button.callback('Yes, delete', `confirm_delete_${dogId}`)],
      [Markup.button.callback('No, keep', `view_dog_${dogId}`)],
    ])
  );
});

// Handle confirmed delete
bot.action(/^confirm_delete_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const dogId = parseInt(ctx.match[1] ?? '0', 10);
  const dog = await findDogById(dogId);

  if (!dog) {
    await ctx.editMessageText('Dog not found. It may have been deleted.');
    return;
  }

  const deleted = await deleteDog(dogId);

  if (deleted) {
    await ctx.editMessageText(
      `${dog.name} has been removed from your profiles.\n\n` +
        'Use /profile to view your remaining dogs.'
    );
  } else {
    await ctx.editMessageText(
      'Could not delete dog. Please try again.'
    );
  }
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
