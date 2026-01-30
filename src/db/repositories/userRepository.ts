import { pool } from '../client.js';

export interface User {
  id: number;
  telegramId: number;
  firstName: string | null;
  username: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface UserRow {
  id: number;
  telegram_id: string; // BIGINT comes as string from pg
  first_name: string | null;
  username: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapRowToUser(row: UserRow): User {
  return {
    id: row.id,
    telegramId: parseInt(row.telegram_id, 10),
    firstName: row.first_name,
    username: row.username,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Find a user by their Telegram ID
 */
export async function findUserByTelegramId(
  telegramId: number
): Promise<User | null> {
  const result = await pool.query<UserRow>(
    'SELECT * FROM users WHERE telegram_id = $1',
    [telegramId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRowToUser(result.rows[0]!);
}

/**
 * Find or create a user by Telegram ID (upsert)
 * Updates first_name and username if user exists
 */
export async function findOrCreateUser(
  telegramId: number,
  firstName?: string,
  username?: string
): Promise<User> {
  const result = await pool.query<UserRow>(
    `INSERT INTO users (telegram_id, first_name, username)
     VALUES ($1, $2, $3)
     ON CONFLICT (telegram_id) DO UPDATE SET
       first_name = EXCLUDED.first_name,
       username = EXCLUDED.username,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [telegramId, firstName ?? null, username ?? null]
  );

  return mapRowToUser(result.rows[0]!);
}
