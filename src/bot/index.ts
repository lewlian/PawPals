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
import {
  handleExtendCallback,
  handleCheckoutCallback,
} from './handlers/sessionCallbacks.js';
import {
  handleRefreshDashboard,
  handleSortMostDogs,
  handleSortNearest,
  handleNearestLocation,
  handleCancelNearest,
} from './handlers/dashboardCallbacks.js';
import { createDogProfileWizard } from './scenes/createDogProfile.js';
import { editDogProfileWizard } from './scenes/editDogProfile.js';
import { checkInWizard } from './scenes/checkInWizard.js';
import { findDogById, deleteDog } from '../db/repositories/dogRepository.js';
import { BUTTON_TEXT } from './constants/emoji.js';
import { mainMenuKeyboard } from './keyboards/mainMenu.js';

const env = validateEnv();

export const bot = new Telegraf<BotContext>(env.BOT_TOKEN);

// Global error handler - prevents crashes from unhandled errors
bot.catch(async (err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);

  // Try to notify user
  try {
    await ctx.reply('Sorry, something went wrong. Please try again.');
  } catch {
    // Silent fail if we can't send error message
  }

  // Send error details to admin (production only)
  if (env.NODE_ENV === 'production' && env.ADMIN_CHAT_ID) {
    try {
      const errorMessage =
        'Bot Error\n\n' +
        `Type: ${ctx.updateType}\n` +
        `Error: ${err instanceof Error ? err.message : String(err)}\n` +
        `User: ${ctx.from?.id || 'unknown'}\n` +
        `Time: ${new Date().toISOString()}\n\n` +
        `Stack: ${err instanceof Error ? err.stack?.substring(0, 500) : 'N/A'}`;

      await bot.telegram.sendMessage(env.ADMIN_CHAT_ID, errorMessage);
    } catch (notifyErr) {
      // CRITICAL: Never throw from error handler - would cause infinite loop
      console.error('Failed to send admin notification:', notifyErr);
    }
  }
});

// Session middleware MUST come before stage
bot.use(session());

// Create and register stage with all scenes
const stage = new Scenes.Stage<BotContext>([
  createDogProfileWizard,
  editDogProfileWizard,
  checkInWizard,
]);
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

// Handle edit field buttons - enter edit wizard with field context
bot.action(/^edit_dog_(name|size|breed|age)_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const field = ctx.match[1] as 'name' | 'size' | 'breed' | 'age';
  const dogId = parseInt(ctx.match[2] ?? '0', 10);

  // Enter edit wizard with initial state
  await ctx.scene.enter('edit-dog-profile', { dogId, field });
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

// Session automation callback handlers
bot.action(/^extend_(\d+)_(\d+)$/, handleExtendCallback);
bot.action(/^checkout_(\d+)$/, handleCheckoutCallback);

// Dashboard callback handlers
bot.action('refresh_dashboard', handleRefreshDashboard);
bot.action('sort_most_dogs', handleSortMostDogs);
bot.action('sort_nearest', handleSortNearest);

// Handle location messages (outside wizard)
// Used for dashboard "Nearest" sort when user shares location
bot.on('location', async (ctx) => {
  // Skip if in a scene (check-in wizard handles its own location)
  if (ctx.scene.current) {
    return;
  }

  // Process as dashboard nearest location sort
  const userLat = ctx.message.location.latitude;
  const userLon = ctx.message.location.longitude;

  await handleNearestLocation(ctx, userLat, userLon);
});

// Reply keyboard button handlers
bot.hears(BUTTON_TEXT.checkIn, async (ctx) => {
  if (ctx.scene.current) return; // Skip if in wizard
  await ctx.scene.enter('check-in-wizard');
});

bot.hears(BUTTON_TEXT.checkout, async (ctx) => {
  if (ctx.scene.current) return;
  await checkoutHandler(ctx);
});

bot.hears(BUTTON_TEXT.profile, async (ctx) => {
  if (ctx.scene.current) return;
  await profileHandler(ctx);
});

bot.hears(BUTTON_TEXT.live, async (ctx) => {
  if (ctx.scene.current) return;
  await liveHandler(ctx);
});

// Handle "Cancel" button for nearest sort location request
bot.hears('Cancel', async (ctx) => {
  // Only handle if not in a scene
  if (!ctx.scene.current) {
    await handleCancelNearest(ctx);
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

// Re-export mainMenuKeyboard for use by handlers
export { mainMenuKeyboard };
