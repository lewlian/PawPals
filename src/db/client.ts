import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
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

const _pool = new Pool(poolConfig);

_pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

// Force search_path=public on every new connection (required for Supabase pooler)
_pool.on('connect', (client) => {
  client.query('SET search_path TO public');
});

// Wrap pool to prepend SET LOCAL search_path for each query in transaction-mode pooling
export const pool = {
  query<T extends QueryResultRow = QueryResultRow>(text: string | { text: string; values?: unknown[] }, values?: unknown[]): Promise<QueryResult<T>> {
    const queryText = typeof text === 'string' ? text : text.text;
    const queryValues = typeof text === 'string' ? values : text.values;
    // Prepend SET LOCAL for Supabase transaction-mode pooler compatibility
    const wrappedText = `SET LOCAL search_path = 'public'; ${queryText}`;
    return _pool.query<T>(wrappedText, queryValues);
  },
  connect(): Promise<PoolClient> {
    return _pool.connect();
  },
  end(): Promise<void> {
    return _pool.end();
  },
};

export async function closePool(): Promise<void> {
  await _pool.end();
}

// Health check function
export async function checkConnection(): Promise<boolean> {
  try {
    const client = await _pool.connect();
    await client.query('SET search_path TO public');
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}
