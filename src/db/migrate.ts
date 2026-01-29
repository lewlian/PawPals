import { pool, closePool } from './client.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate(): Promise<void> {
  console.log('Running database migrations...');

  try {
    // Read and execute migration file
    const migrationPath = join(__dirname, 'migrations', '0001-initial-schema.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf-8');

    await pool.query(migrationSQL);
    console.log('Migration 0001-initial-schema.sql applied successfully');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

migrate();
