import { Markup } from 'telegraf';
import type { BotContext } from '../../types/session.js';
import {
  getOccupancyByLocation,
  getActiveSessionByUserId,
} from '../../db/repositories/sessionRepository.js';
import { findOrCreateUser } from '../../db/repositories/userRepository.js';
import {
  formatDashboard,
  sortByDogCount,
  sortByDistance,
  buildDashboardKeyboard,
} from '../utils/dashboard.js';
import type { ParkDisplay } from '../../types/dashboard.js';

/**
 * Handle refresh dashboard callback
 * Refreshes dashboard data and updates message in-place
 */
export async function handleRefreshDashboard(ctx: BotContext): Promise<void> {
  await ctx.answerCbQuery('Refreshing...');

  const from = ctx.from;
  if (!from) {
    return;
  }

  // Get user from database
  const user = await findOrCreateUser(
    from.id,
    from.first_name,
    from.username
  );

  // Check for active session (for "You are here" marker)
  const activeSession = await getActiveSessionByUserId(user.id);
  const userLocationId = activeSession?.locationId;

  // Get fresh occupancy data
  const occupancyData = await getOccupancyByLocation();

  // Sort by dog count (maintain default sort on refresh)
  const sorted = sortByDogCount(occupancyData);

  // Map to ParkDisplay with isUserHere marker
  const parks: ParkDisplay[] = sorted.map(park => ({
    ...park,
    isUserHere: park.locationId === userLocationId,
  }));

  // Format and update message in-place
  const message = formatDashboard(parks);
  const keyboard = buildDashboardKeyboard('most_dogs');

  await ctx.editMessageText(message, keyboard);
}

/**
 * Handle sort by most dogs callback
 * Re-sorts dashboard by dog count and updates in-place
 */
export async function handleSortMostDogs(ctx: BotContext): Promise<void> {
  await ctx.answerCbQuery();

  const from = ctx.from;
  if (!from) {
    return;
  }

  // Get user from database
  const user = await findOrCreateUser(
    from.id,
    from.first_name,
    from.username
  );

  // Check for active session (for "You are here" marker)
  const activeSession = await getActiveSessionByUserId(user.id);
  const userLocationId = activeSession?.locationId;

  // Get fresh occupancy data
  const occupancyData = await getOccupancyByLocation();

  // Sort by dog count
  const sorted = sortByDogCount(occupancyData);

  // Map to ParkDisplay with isUserHere marker
  const parks: ParkDisplay[] = sorted.map(park => ({
    ...park,
    isUserHere: park.locationId === userLocationId,
  }));

  // Format and update message in-place
  const message = formatDashboard(parks);
  const keyboard = buildDashboardKeyboard('most_dogs');

  await ctx.editMessageText(message, keyboard);
}

/**
 * Handle sort by nearest callback
 * Inline buttons cannot request location, so send a reply keyboard
 */
export async function handleSortNearest(ctx: BotContext): Promise<void> {
  await ctx.answerCbQuery();

  // Per Telegram API limitation: inline buttons cannot request location
  // Send a new message with reply keyboard for location
  await ctx.reply(
    'Share your location to find nearest parks:',
    Markup.keyboard([
      [Markup.button.locationRequest('Share Location')],
      ['Cancel'],
    ]).oneTime().resize()
  );
}

/**
 * Handle location message for nearest sort
 * Called when user shares location (outside wizard context)
 */
export async function handleNearestLocation(
  ctx: BotContext,
  userLat: number,
  userLon: number
): Promise<void> {
  const from = ctx.from;
  if (!from) {
    return;
  }

  // Get user from database
  const user = await findOrCreateUser(
    from.id,
    from.first_name,
    from.username
  );

  // Check for active session (for "You are here" marker)
  const activeSession = await getActiveSessionByUserId(user.id);
  const userLocationId = activeSession?.locationId;

  // Get occupancy data
  const occupancyData = await getOccupancyByLocation();

  // Sort by distance from user
  const parks = sortByDistance(occupancyData, userLat, userLon);

  // Add "You are here" marker
  for (const park of parks) {
    park.isUserHere = park.locationId === userLocationId;
  }

  // Format and send new dashboard message (removes reply keyboard)
  const message = formatDashboard(parks);
  const keyboard = buildDashboardKeyboard('nearest');

  await ctx.reply(message, {
    ...keyboard,
    reply_markup: {
      ...keyboard.reply_markup,
      remove_keyboard: undefined, // inline keyboard will override
    },
  });

  // Remove the reply keyboard by sending a message with remove_keyboard
  // The inline keyboard in the message above should handle this,
  // but we explicitly remove any lingering reply keyboard
  await ctx.reply('Parks sorted by distance from your location.', {
    reply_markup: { remove_keyboard: true },
  });
}

/**
 * Handle cancel button for nearest sort location request
 */
export async function handleCancelNearest(ctx: BotContext): Promise<void> {
  await ctx.reply(
    'Location not shared. Use /live to see the dashboard.',
    { reply_markup: { remove_keyboard: true } }
  );
}
