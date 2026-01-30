import { pool } from '../client.js';
import type { Session } from '../../types/session.js';
import type { Dog } from '../../types/dog.js';
import type { OccupancyData } from '../../types/dashboard.js';

/**
 * Session data enriched with user and location details for notifications
 */
export interface SessionForNotification {
  id: number;
  userId: number;
  telegramId: number;
  locationId: number;
  locationName: string;
  checkedInAt: Date;
  expiresAt: Date;
  dogNames: string[];
}

interface SessionRow {
  id: number;
  user_id: number;
  location_id: number;
  checked_in_at: Date;
  expires_at: Date;
  checked_out_at: Date | null;
  status: 'active' | 'expired' | 'completed';
  created_at: Date;
  updated_at: Date;
}

function mapRowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    locationId: row.location_id,
    checkedInAt: row.checked_in_at,
    expiresAt: row.expires_at,
    checkedOutAt: row.checked_out_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Create a new check-in session
 */
export async function createSession(
  userId: number,
  locationId: number,
  durationMinutes: number
): Promise<Session> {
  const result = await pool.query<SessionRow>(
    `INSERT INTO sessions (user_id, location_id, expires_at, status)
     VALUES ($1, $2, NOW() + ($3 || ' minutes')::INTERVAL, 'active')
     RETURNING *`,
    [userId, locationId, durationMinutes]
  );

  return mapRowToSession(result.rows[0]!);
}

/**
 * Get active session for a user
 */
export async function getActiveSessionByUserId(userId: number): Promise<Session | null> {
  const result = await pool.query<SessionRow>(
    `SELECT * FROM sessions
     WHERE user_id = $1 AND status = 'active'
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRowToSession(result.rows[0]!);
}

/**
 * Check out a session
 */
export async function checkoutSession(sessionId: number): Promise<Session | null> {
  const result = await pool.query<SessionRow>(
    `UPDATE sessions
     SET checked_out_at = NOW(),
         status = 'completed',
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [sessionId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRowToSession(result.rows[0]!);
}

/**
 * Find a session by ID
 */
export async function findSessionById(sessionId: number): Promise<Session | null> {
  const result = await pool.query<SessionRow>(
    'SELECT * FROM sessions WHERE id = $1',
    [sessionId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRowToSession(result.rows[0]!);
}

/**
 * Add dogs to a session
 */
export async function addDogsToSession(sessionId: number, dogIds: number[]): Promise<void> {
  if (dogIds.length === 0) {
    return;
  }

  // Build batch insert values
  const values: number[] = [];
  const placeholders: string[] = [];

  dogIds.forEach((dogId, index) => {
    const offset = index * 2;
    placeholders.push(`($${offset + 1}, $${offset + 2})`);
    values.push(sessionId, dogId);
  });

  await pool.query(
    `INSERT INTO session_dogs (session_id, dog_id)
     VALUES ${placeholders.join(', ')}
     ON CONFLICT (session_id, dog_id) DO NOTHING`,
    values
  );
}

/**
 * Get all dogs in a session
 */
export async function getDogsBySessionId(sessionId: number): Promise<Dog[]> {
  const result = await pool.query(
    `SELECT d.id, d.user_id, d.name, d.size, d.breed, d.age, d.created_at, d.updated_at
     FROM dogs d
     INNER JOIN session_dogs sd ON sd.dog_id = d.id
     WHERE sd.session_id = $1
     ORDER BY d.name ASC`,
    [sessionId]
  );

  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    name: row.name,
    size: row.size,
    breed: row.breed,
    age: row.age,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/**
 * Get active sessions expiring within 5-6 minutes (for reminder notifications)
 * Window accounts for polling interval variance
 */
export async function getSessionsNeedingReminder(): Promise<SessionForNotification[]> {
  const result = await pool.query<{
    id: number;
    user_id: number;
    telegram_id: string;
    location_id: number;
    location_name: string;
    checked_in_at: Date;
    expires_at: Date;
    dog_names: string[];
  }>(
    `SELECT
       s.id,
       s.user_id,
       u.telegram_id,
       s.location_id,
       l.name as location_name,
       s.checked_in_at,
       s.expires_at,
       ARRAY_AGG(d.name ORDER BY d.name) as dog_names
     FROM sessions s
     INNER JOIN users u ON s.user_id = u.id
     INNER JOIN locations l ON s.location_id = l.id
     INNER JOIN session_dogs sd ON s.id = sd.session_id
     INNER JOIN dogs d ON sd.dog_id = d.id
     WHERE s.status = 'active'
       AND s.expires_at > NOW()
       AND s.expires_at <= NOW() + INTERVAL '6 minutes'
     GROUP BY s.id, s.user_id, u.telegram_id, s.location_id, l.name, s.checked_in_at, s.expires_at
     ORDER BY s.expires_at ASC`
  );

  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    telegramId: parseInt(row.telegram_id, 10),
    locationId: row.location_id,
    locationName: row.location_name,
    checkedInAt: row.checked_in_at,
    expiresAt: row.expires_at,
    dogNames: row.dog_names,
  }));
}

/**
 * Get sessions that have expired but not yet processed
 */
export async function getExpiredSessions(): Promise<SessionForNotification[]> {
  const result = await pool.query<{
    id: number;
    user_id: number;
    telegram_id: string;
    location_id: number;
    location_name: string;
    checked_in_at: Date;
    expires_at: Date;
    dog_names: string[];
  }>(
    `SELECT
       s.id,
       s.user_id,
       u.telegram_id,
       s.location_id,
       l.name as location_name,
       s.checked_in_at,
       s.expires_at,
       ARRAY_AGG(d.name ORDER BY d.name) as dog_names
     FROM sessions s
     INNER JOIN users u ON s.user_id = u.id
     INNER JOIN locations l ON s.location_id = l.id
     INNER JOIN session_dogs sd ON s.id = sd.session_id
     INNER JOIN dogs d ON sd.dog_id = d.id
     WHERE s.status = 'active'
       AND s.expires_at <= NOW()
     GROUP BY s.id, s.user_id, u.telegram_id, s.location_id, l.name, s.checked_in_at, s.expires_at
     ORDER BY s.expires_at ASC`
  );

  return result.rows.map(row => ({
    id: row.id,
    userId: row.user_id,
    telegramId: parseInt(row.telegram_id, 10),
    locationId: row.location_id,
    locationName: row.location_name,
    checkedInAt: row.checked_in_at,
    expiresAt: row.expires_at,
    dogNames: row.dog_names,
  }));
}

/**
 * Mark sessions as expired (batch operation)
 */
export async function expireSessions(sessionIds: number[]): Promise<void> {
  if (sessionIds.length === 0) {
    return;
  }

  await pool.query(
    `UPDATE sessions
     SET status = 'expired',
         updated_at = NOW()
     WHERE id = ANY($1)`,
    [sessionIds]
  );
}

/**
 * Extend a session by adding minutes to expires_at
 */
export async function extendSession(
  sessionId: number,
  additionalMinutes: number
): Promise<Session | null> {
  const result = await pool.query<SessionRow>(
    `UPDATE sessions
     SET expires_at = expires_at + ($2 || ' minutes')::INTERVAL,
         updated_at = NOW()
     WHERE id = $1 AND status = 'active'
     RETURNING *`,
    [sessionId, additionalMinutes]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRowToSession(result.rows[0]!);
}

/**
 * Get occupancy data for all locations with size breakdowns
 * Uses LEFT JOIN to ensure parks with 0 dogs still appear
 */
export async function getOccupancyByLocation(): Promise<OccupancyData[]> {
  const result = await pool.query<{
    location_id: number;
    location_name: string;
    latitude: string;
    longitude: string;
    total_dogs: string;
    small_count: string;
    medium_count: string;
    large_count: string;
  }>(`
    SELECT
      l.id as location_id,
      l.name as location_name,
      l.latitude,
      l.longitude,
      COALESCE(COUNT(sd.dog_id), 0) as total_dogs,
      COALESCE(COUNT(sd.dog_id) FILTER (WHERE d.size = 'Small'), 0) as small_count,
      COALESCE(COUNT(sd.dog_id) FILTER (WHERE d.size = 'Medium'), 0) as medium_count,
      COALESCE(COUNT(sd.dog_id) FILTER (WHERE d.size = 'Large'), 0) as large_count
    FROM locations l
    LEFT JOIN sessions s ON s.location_id = l.id AND s.status = 'active'
    LEFT JOIN session_dogs sd ON sd.session_id = s.id
    LEFT JOIN dogs d ON d.id = sd.dog_id
    GROUP BY l.id, l.name, l.latitude, l.longitude
    ORDER BY l.name
  `);

  // pg returns counts as strings, parse to numbers
  return result.rows.map(row => ({
    locationId: row.location_id,
    locationName: row.location_name,
    latitude: parseFloat(row.latitude),
    longitude: parseFloat(row.longitude),
    totalDogs: parseInt(row.total_dogs, 10),
    small: parseInt(row.small_count, 10),
    medium: parseInt(row.medium_count, 10),
    large: parseInt(row.large_count, 10),
  }));
}
