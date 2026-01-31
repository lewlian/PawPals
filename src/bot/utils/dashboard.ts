import { Markup } from 'telegraf';
import haversineDistance from 'haversine-distance';
import type { OccupancyData, ParkDisplay } from '../../types/dashboard.js';
import { EMOJI } from '../constants/emoji.js';

/**
 * Format size breakdown with bullet separator
 * Per CONTEXT.md: "5 dogs • 2 Small, 2 Medium, 1 Large"
 * Single size simplification: "3 Small dogs"
 * Zero dogs: "0 dogs"
 */
export function formatSizeBreakdown(small: number, medium: number, large: number): string {
  const total = small + medium + large;

  if (total === 0) {
    return '0 dogs';
  }

  const parts: string[] = [];
  if (small > 0) parts.push(`${small} Small`);
  if (medium > 0) parts.push(`${medium} Medium`);
  if (large > 0) parts.push(`${large} Large`);

  // Single size simplification per user decision
  if (parts.length === 1) {
    const size = small > 0 ? 'Small' : medium > 0 ? 'Medium' : 'Large';
    return `${total} ${size} ${total === 1 ? 'dog' : 'dogs'}`;
  }

  return `${total} dogs • ${parts.join(', ')}`;
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
 * Sort parks by distance from user (ascending), with alphabetical tiebreaker
 * Returns ParkDisplay[] with distanceKm populated for each park
 */
export function sortByDistance(
  parks: OccupancyData[],
  userLat: number,
  userLon: number
): ParkDisplay[] {
  // Calculate distance for each park
  const parksWithDistance: ParkDisplay[] = parks.map(park => {
    const distanceMeters = haversineDistance(
      { latitude: userLat, longitude: userLon },
      { latitude: park.latitude, longitude: park.longitude }
    );
    const distanceKm = Math.round((distanceMeters / 1000) * 10) / 10; // Round to 1 decimal

    return {
      ...park,
      distanceKm,
      isUserHere: false, // Will be set by caller if needed
    };
  });

  // Sort by distance ascending, alphabetical tiebreaker
  return parksWithDistance.sort((a, b) => {
    const distA = a.distanceKm ?? Infinity;
    const distB = b.distanceKm ?? Infinity;
    if (distA !== distB) {
      return distA - distB;
    }
    return a.locationName.localeCompare(b.locationName);
  });
}

/**
 * Format dashboard message for display
 * Per CONTEXT.md emoji formatting:
 * 📊 Live Dog Run Occupancy
 * 📍 Park Name (distance)
 * 🐕 5 dogs • 2 Small, 2 Medium, 1 Large
 */
export function formatDashboard(parks: ParkDisplay[], showEmptyMessage: boolean = true): string {
  const now = new Date();
  const timestamp = now.toLocaleTimeString('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Singapore',
  });

  let message = `${EMOJI.live} Live Dog Run Occupancy\nUpdated ${timestamp}\n\n`;

  const hasAnyDogs = parks.some(p => p.totalDogs > 0);
  if (!hasAnyDogs && showEmptyMessage) {
    message += 'No dogs checked in right now.\n\n';
  }

  for (const park of parks) {
    const hereMarker = park.isUserHere ? ' [You are here]' : '';
    const distanceStr = park.distanceKm !== undefined
      ? ` (${park.distanceKm.toFixed(1)} km)`
      : '';

    message += `${EMOJI.location} ${park.locationName}${distanceStr}${hereMarker}\n`;
    message += `${EMOJI.dogs} ${formatSizeBreakdown(park.small, park.medium, park.large)}\n\n`;
  }

  return message.trim();
}

/**
 * Build inline keyboard for dashboard with sort and refresh buttons
 */
export function buildDashboardKeyboard(currentSort: 'nearest' | 'most_dogs') {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        currentSort === 'nearest' ? `${EMOJI.location} Nearest *` : `${EMOJI.location} Nearest`,
        'sort_nearest'
      ),
      Markup.button.callback(
        currentSort === 'most_dogs' ? `${EMOJI.dogs} Most Dogs *` : `${EMOJI.dogs} Most Dogs`,
        'sort_most_dogs'
      ),
    ],
    [Markup.button.callback(`${EMOJI.refresh} Refresh`, 'refresh_dashboard')],
  ]);
}
