import { pool } from '../client.js';
import type { Session } from '../../types/session.js';
import type { Dog } from '../../types/dog.js';

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
