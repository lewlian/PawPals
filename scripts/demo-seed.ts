/**
 * Demo Seed Script
 *
 * Populates the database with fake check-ins for demo/showcase purposes.
 * All sessions auto-expire 30 minutes after running this script.
 *
 * Usage: npm run demo:seed
 * Clear:  npm run demo:clear
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { z } from 'zod';

// Minimal env validation for script
const env = z.object({
  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().default('pawpals'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres'),
}).parse(process.env);

const pool = new Pool(
  env.DATABASE_URL
    ? { connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
    : { host: env.DB_HOST, port: env.DB_PORT, database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD }
);

// Demo data configuration
const DEMO_TELEGRAM_ID_START = 9000000001; // High range to avoid conflicts with real users
const SESSION_DURATION_MINUTES = 30;

// Dog breeds by size for realistic data
const BREEDS = {
  Small: ['Chihuahua', 'Pomeranian', 'Shih Tzu', 'Maltese', 'Yorkshire Terrier', 'Pug', 'French Bulldog', 'Dachshund', 'Miniature Schnauzer', 'Cavalier King Charles'],
  Medium: ['Beagle', 'Cocker Spaniel', 'Border Collie', 'Australian Shepherd', 'Corgi', 'Shetland Sheepdog', 'Basenji', 'Whippet', 'Brittany', 'English Springer Spaniel'],
  Large: ['Golden Retriever', 'Labrador Retriever', 'German Shepherd', 'Siberian Husky', 'Samoyed', 'Boxer', 'Doberman', 'Rottweiler', 'Great Dane', 'Bernese Mountain Dog'],
};

// Common Singaporean dog names
const DOG_NAMES = [
  'Mochi', 'Kopi', 'Boba', 'Lucky', 'Oreo', 'Cookie', 'Brownie', 'Tofu', 'Mango', 'Lychee',
  'Coco', 'Buddy', 'Max', 'Bella', 'Charlie', 'Luna', 'Cooper', 'Daisy', 'Rocky', 'Molly',
  'Tucker', 'Sadie', 'Bear', 'Bailey', 'Duke', 'Maggie', 'Jack', 'Sophie', 'Oliver', 'Chloe',
  'Teddy', 'Penny', 'Leo', 'Zoey', 'Winston', 'Lily', 'Bentley', 'Stella', 'Milo', 'Rosie',
];

// Park distribution - simulate realistic occupancy patterns
// Format: [locationId, numberOfDogs] - locationIds match seed order (1-11)
const PARK_OCCUPANCY = [
  { locationId: 1, dogs: 4 },   // Bishan-AMK Park - popular
  { locationId: 2, dogs: 6 },   // ECP Parkland Green - very popular
  { locationId: 3, dogs: 5 },   // Jurong Lake Gardens - popular
  { locationId: 4, dogs: 2 },   // Katong Park - moderate
  { locationId: 5, dogs: 0 },   // Mount Emily Park - empty
  { locationId: 6, dogs: 3 },   // Punggol Park - moderate
  { locationId: 7, dogs: 1 },   // Sembawang Park - quiet
  { locationId: 8, dogs: 0 },   // The Palawan (Sentosa) - empty
  { locationId: 9, dogs: 2 },   // Tiong Bahru (Sit Wah) - moderate
  { locationId: 10, dogs: 7 },  // West Coast Park - very popular
  { locationId: 11, dogs: 3 },  // Yishun Park - moderate
];

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomAge(): number {
  // Weighted towards younger dogs (1-5 years)
  const ages = [1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 5, 5, 6, 7, 8, 9, 10, 11, 12];
  return randomElement(ages);
}

function randomSize(): 'Small' | 'Medium' | 'Large' {
  const sizes: ('Small' | 'Medium' | 'Large')[] = ['Small', 'Small', 'Medium', 'Medium', 'Medium', 'Large', 'Large'];
  return randomElement(sizes);
}

interface DemoUser {
  id: number;
  telegramId: number;
}

interface DemoDog {
  id: number;
  userId: number;
  name: string;
  size: 'Small' | 'Medium' | 'Large';
  breed: string;
}

async function clearDemoData(): Promise<void> {
  console.log('Clearing existing demo data...');

  // Delete sessions for demo users (cascades to session_dogs)
  await pool.query(`
    DELETE FROM sessions
    WHERE user_id IN (
      SELECT id FROM users WHERE telegram_id >= $1
    )
  `, [DEMO_TELEGRAM_ID_START]);

  // Delete dogs for demo users
  await pool.query(`
    DELETE FROM dogs
    WHERE user_id IN (
      SELECT id FROM users WHERE telegram_id >= $1
    )
  `, [DEMO_TELEGRAM_ID_START]);

  // Delete demo users
  await pool.query(`
    DELETE FROM users WHERE telegram_id >= $1
  `, [DEMO_TELEGRAM_ID_START]);

  console.log('Demo data cleared.');
}

async function createDemoUsers(count: number): Promise<DemoUser[]> {
  const users: DemoUser[] = [];

  for (let i = 0; i < count; i++) {
    const telegramId = DEMO_TELEGRAM_ID_START + i;
    const firstName = `DemoUser${i + 1}`;

    const result = await pool.query<{ id: number; telegram_id: string }>(
      `INSERT INTO users (telegram_id, first_name, username)
       VALUES ($1, $2, $3)
       RETURNING id, telegram_id`,
      [telegramId, firstName, `demo_user_${i + 1}`]
    );

    users.push({
      id: result.rows[0]!.id,
      telegramId: parseInt(result.rows[0]!.telegram_id, 10),
    });
  }

  return users;
}

async function createDemoDog(userId: number, usedNames: Set<string>): Promise<DemoDog> {
  // Pick a unique name
  let name: string;
  do {
    name = randomElement(DOG_NAMES);
  } while (usedNames.has(name));
  usedNames.add(name);

  const size = randomSize();
  const breed = randomElement(BREEDS[size]);
  const age = randomAge();

  const result = await pool.query<{ id: number }>(
    `INSERT INTO dogs (user_id, name, size, breed, age)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, name, size, breed, age]
  );

  return {
    id: result.rows[0]!.id,
    userId,
    name,
    size,
    breed,
  };
}

async function createDemoSession(userId: number, locationId: number, dogIds: number[]): Promise<number> {
  // Create session expiring in 30 minutes
  const result = await pool.query<{ id: number }>(
    `INSERT INTO sessions (user_id, location_id, expires_at, status)
     VALUES ($1, $2, NOW() + ($3 || ' minutes')::INTERVAL, 'active')
     RETURNING id`,
    [userId, locationId, SESSION_DURATION_MINUTES]
  );

  const sessionId = result.rows[0]!.id;

  // Link dogs to session
  for (const dogId of dogIds) {
    await pool.query(
      `INSERT INTO session_dogs (session_id, dog_id) VALUES ($1, $2)`,
      [sessionId, dogId]
    );
  }

  return sessionId;
}

async function seed(): Promise<void> {
  console.log('\n=== PawPals Demo Seed ===\n');

  // Clear any existing demo data
  await clearDemoData();

  // Calculate total dogs needed
  const totalDogs = PARK_OCCUPANCY.reduce((sum, p) => sum + p.dogs, 0);
  console.log(`Creating ${totalDogs} demo dogs across ${PARK_OCCUPANCY.filter(p => p.dogs > 0).length} parks...\n`);

  // Create demo users (1 user per dog for simplicity)
  const users = await createDemoUsers(totalDogs);
  console.log(`Created ${users.length} demo users.`);

  // Track used names to avoid duplicates
  const usedNames = new Set<string>();
  let userIndex = 0;
  let totalSessions = 0;

  // Create dogs and sessions for each park
  for (const park of PARK_OCCUPANCY) {
    if (park.dogs === 0) continue;

    const parkDogs: DemoDog[] = [];

    for (let i = 0; i < park.dogs; i++) {
      const user = users[userIndex]!;
      const dog = await createDemoDog(user.id, usedNames);
      parkDogs.push(dog);

      // Create session for this user/dog at this park
      await createDemoSession(user.id, park.locationId, [dog.id]);
      totalSessions++;
      userIndex++;
    }

    // Get park name for logging
    const parkResult = await pool.query<{ name: string }>(
      'SELECT name FROM locations WHERE id = $1',
      [park.locationId]
    );
    const parkName = parkResult.rows[0]?.name || `Location ${park.locationId}`;

    // Log park summary
    const sizeBreakdown = {
      Small: parkDogs.filter(d => d.size === 'Small').length,
      Medium: parkDogs.filter(d => d.size === 'Medium').length,
      Large: parkDogs.filter(d => d.size === 'Large').length,
    };

    const sizes = [];
    if (sizeBreakdown.Small > 0) sizes.push(`${sizeBreakdown.Small}S`);
    if (sizeBreakdown.Medium > 0) sizes.push(`${sizeBreakdown.Medium}M`);
    if (sizeBreakdown.Large > 0) sizes.push(`${sizeBreakdown.Large}L`);

    console.log(`  ${parkName}: ${park.dogs} dogs (${sizes.join(', ')})`);
    parkDogs.forEach(d => console.log(`    - ${d.name} (${d.breed}, ${d.size})`));
  }

  console.log(`\nCreated ${totalSessions} active sessions.`);
  console.log(`\nAll sessions will auto-expire in ${SESSION_DURATION_MINUTES} minutes.`);
  console.log('\nDemo data ready! Open the bot and use /live to see the dashboard.\n');
}

async function clear(): Promise<void> {
  console.log('\n=== Clearing PawPals Demo Data ===\n');
  await clearDemoData();
  console.log('\nDone!\n');
}

// Main
const command = process.argv[2];

if (command === 'clear') {
  clear()
    .catch(console.error)
    .finally(() => pool.end());
} else {
  seed()
    .catch(console.error)
    .finally(() => pool.end());
}
