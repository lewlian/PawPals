import { pool } from './client.js';

export interface Location {
  id: number;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
  notes: string | null;
  created_at: Date;
}

/**
 * Get all locations, optionally filtered by region
 */
export async function getAllLocations(region?: string): Promise<Location[]> {
  if (region) {
    const result = await pool.query<Location>(
      'SELECT * FROM public.locations WHERE region = $1 ORDER BY name',
      [region]
    );
    return result.rows;
  }

  const result = await pool.query<Location>(
    'SELECT * FROM public.locations ORDER BY name'
  );
  return result.rows;
}

/**
 * Get a single location by ID
 */
export async function getLocationById(id: number): Promise<Location | null> {
  const result = await pool.query<Location>(
    'SELECT * FROM public.locations WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Get a single location by name
 */
export async function getLocationByName(name: string): Promise<Location | null> {
  const result = await pool.query<Location>(
    'SELECT * FROM public.locations WHERE name = $1',
    [name]
  );
  return result.rows[0] || null;
}
