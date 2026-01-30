/**
 * Dashboard type definitions for live occupancy display
 */

/**
 * Aggregated occupancy data for a single location
 */
export interface OccupancyData {
  locationId: number;
  locationName: string;
  latitude: number;
  longitude: number;
  totalDogs: number;
  small: number;
  medium: number;
  large: number;
}

/**
 * Park display data with optional distance and user presence marker
 */
export interface ParkDisplay extends OccupancyData {
  distanceKm?: number;
  isUserHere: boolean;
}
