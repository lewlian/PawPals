import { Pool } from 'pg';
import { validateEnv } from '../config/env.js';

const env = validateEnv();

// Use DATABASE_URL if provided (production), otherwise use individual DB_* vars (development)
const poolConfig = env.DATABASE_URL
  ? {
      connectionString: env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Required for Supabase
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      options: '-c search_path=public',
    }
  : {
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

export async function closePool(): Promise<void> {
  await pool.end();
}

// Health check function
export async function checkConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}
