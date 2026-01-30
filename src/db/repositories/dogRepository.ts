import { pool } from '../client.js';
import type { Dog, CreateDogInput, UpdateDogInput, DogSize } from '../../types/dog.js';

interface DogRow {
  id: number;
  user_id: number;
  name: string;
  size: string;
  breed: string;
  age: number;
  created_at: Date;
  updated_at: Date;
}

function mapRowToDog(row: DogRow): Dog {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    size: row.size as DogSize,
    breed: row.breed,
    age: row.age,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Create a new dog profile for a user
 */
export async function createDog(
  userId: number,
  input: CreateDogInput
): Promise<Dog> {
  const result = await pool.query<DogRow>(
    `INSERT INTO dogs (user_id, name, size, breed, age)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, input.name, input.size, input.breed, input.age]
  );

  return mapRowToDog(result.rows[0]!);
}

/**
 * Find all dogs belonging to a user
 */
export async function findDogsByUserId(userId: number): Promise<Dog[]> {
  const result = await pool.query<DogRow>(
    'SELECT * FROM dogs WHERE user_id = $1 ORDER BY created_at ASC',
    [userId]
  );

  return result.rows.map(mapRowToDog);
}

/**
 * Find a single dog by ID
 */
export async function findDogById(id: number): Promise<Dog | null> {
  const result = await pool.query<DogRow>(
    'SELECT * FROM dogs WHERE id = $1',
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRowToDog(result.rows[0]!);
}

/**
 * Update a dog's profile (partial update)
 */
export async function updateDog(
  id: number,
  input: UpdateDogInput
): Promise<Dog | null> {
  // Build dynamic SET clause for provided fields only
  const updates: string[] = [];
  const values: (string | number)[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(input.name);
  }
  if (input.size !== undefined) {
    updates.push(`size = $${paramIndex++}`);
    values.push(input.size);
  }
  if (input.breed !== undefined) {
    updates.push(`breed = $${paramIndex++}`);
    values.push(input.breed);
  }
  if (input.age !== undefined) {
    updates.push(`age = $${paramIndex++}`);
    values.push(input.age);
  }

  if (updates.length === 0) {
    // No fields to update, return current dog
    return findDogById(id);
  }

  // Always update updated_at
  updates.push(`updated_at = CURRENT_TIMESTAMP`);

  // Add ID as last parameter
  values.push(id);

  const result = await pool.query<DogRow>(
    `UPDATE dogs SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return null;
  }

  return mapRowToDog(result.rows[0]!);
}

/**
 * Delete a dog by ID
 */
export async function deleteDog(id: number): Promise<boolean> {
  const result = await pool.query('DELETE FROM dogs WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}
