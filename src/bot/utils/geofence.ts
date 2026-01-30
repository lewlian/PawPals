import haversineDistance from 'haversine-distance';
import { getAllLocations, Location } from '../../db/locations.js';

export const GEOFENCE_RADIUS_METERS = 200;

export interface GeofenceResult {
  isWithinGeofence: boolean;
  nearestLocation?: Location;
  distance?: number;
}

/**
 * Validate if user location is within geofence radius of any dog run
 * @param userLat User's latitude
 * @param userLon User's longitude
 * @returns GeofenceResult with validation status and nearest location
 */
export async function validateGeofence(
  userLat: number,
  userLon: number
): Promise<GeofenceResult> {
  const locations = await getAllLocations();

  if (locations.length === 0) {
    return {
      isWithinGeofence: false,
    };
  }

  let nearestLocation: Location | undefined;
  let minDistance = Infinity;

  for (const location of locations) {
    const distance = haversineDistance(
      { latitude: userLat, longitude: userLon },
      { latitude: Number(location.latitude), longitude: Number(location.longitude) }
    );

    if (distance < minDistance) {
      minDistance = distance;
      nearestLocation = location;
    }
  }

  return {
    isWithinGeofence: minDistance <= GEOFENCE_RADIUS_METERS,
    nearestLocation,
    distance: minDistance,
  };
}
