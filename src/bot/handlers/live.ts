import { Context } from 'telegraf';
import {
  getOccupancyByLocation,
  getActiveSessionByUserId,
} from '../../db/repositories/sessionRepository.js';
import { findOrCreateUser } from '../../db/repositories/userRepository.js';
import {
  formatDashboard,
  sortByDogCount,
  buildDashboardKeyboard,
} from '../utils/dashboard.js';
import type { ParkDisplay } from '../../types/dashboard.js';

/**
 * /live command handler
 * Shows occupancy dashboard with all 11 dog runs
 * Requirement: CMDS-04, DASH-01, DASH-02, DASH-03, DASH-04
 */
export async function liveHandler(ctx: Context): Promise<void> {
  const from = ctx.from;
  if (!from) {
    await ctx.reply('Could not identify user.');
    return;
  }

  // Show typing indicator while loading data
  await ctx.sendChatAction('typing');

  // Get user from database
  const user = await findOrCreateUser(
    from.id,
    from.first_name,
    from.username
  );

  // Check if user has an active session (for "You are here" marker)
  const activeSession = await getActiveSessionByUserId(user.id);
  const userLocationId = activeSession?.locationId;

  // Get all occupancy data
  const occupancyData = await getOccupancyByLocation();

  // Sort by dog count (default sort)
  const sorted = sortByDogCount(occupancyData);

  // Map to ParkDisplay with isUserHere marker
  const parks: ParkDisplay[] = sorted.map(park => ({
    ...park,
    isUserHere: park.locationId === userLocationId,
  }));

  // Format and send dashboard
  const message = formatDashboard(parks);
  const keyboard = buildDashboardKeyboard('most_dogs');

  await ctx.reply(message, keyboard);
}
