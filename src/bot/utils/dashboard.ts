import { Markup } from 'telegraf';
import type { OccupancyData, ParkDisplay } from '../../types/dashboard.js';

/**
 * Format size breakdown in abbreviated format
 * Single size simplification: "3 Small dogs" instead of "3 dogs (3S)"
 * Zero dogs: "0 dogs"
 */
export function formatSizeBreakdown(small: number, medium: number, large: number): string {
  const total = small + medium + large;

  if (total === 0) {
    return '0 dogs';
  }

  const parts: string[] = [];
  if (small > 0) parts.push(`${small}S`);
  if (medium > 0) parts.push(`${medium}M`);
  if (large > 0) parts.push(`${large}L`);

  // Single size simplification per user decision
  if (parts.length === 1) {
    const size = small > 0 ? 'Small' : medium > 0 ? 'Medium' : 'Large';
    return `${total} ${size} ${total === 1 ? 'dog' : 'dogs'}`;
  }

  return `${total} dogs (${parts.join(', ')})`;
}

/**
 * Sort parks by dog count (descending), with alphabetical tiebreaker
 */
export function sortByDogCount(parks: OccupancyData[]): OccupancyData[] {
  return [...parks].sort((a, b) => {
    // Primary sort: total dogs descending
    if (b.totalDogs !== a.totalDogs) {
      return b.totalDogs - a.totalDogs;
    }
    // Secondary sort: alphabetical by name
    return a.locationName.localeCompare(b.locationName);
  });
}

/**
 * Format dashboard message for display
 */
export function formatDashboard(parks: ParkDisplay[], showEmptyMessage: boolean = true): string {
  const now = new Date();
  const timestamp = now.toLocaleTimeString('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Singapore',
  });

  let message = `Live Dog Run Occupancy\nUpdated ${timestamp}\n\n`;

  const hasAnyDogs = parks.some(p => p.totalDogs > 0);
  if (!hasAnyDogs && showEmptyMessage) {
    message += 'No dogs checked in right now.\n\n';
  }

  for (const park of parks) {
    const hereMarker = park.isUserHere ? ' [You are here]' : '';
    const distanceStr = park.distanceKm !== undefined
      ? ` (${park.distanceKm.toFixed(1)} km)`
      : '';

    message += `${park.locationName}${distanceStr}: `;
    message += formatSizeBreakdown(park.small, park.medium, park.large);
    message += `${hereMarker}\n`;
  }

  return message;
}

/**
 * Build inline keyboard for dashboard with sort and refresh buttons
 */
export function buildDashboardKeyboard(currentSort: 'nearest' | 'most_dogs') {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        currentSort === 'nearest' ? '* Nearest' : 'Nearest',
        'sort_nearest'
      ),
      Markup.button.callback(
        currentSort === 'most_dogs' ? '* Most Dogs' : 'Most Dogs',
        'sort_most_dogs'
      ),
    ],
    [Markup.button.callback('Refresh', 'refresh_dashboard')],
  ]);
}
