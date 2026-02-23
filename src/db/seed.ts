import { pool, closePool } from './client.js';
import { validateEnv } from '../config/env.js';

// All 11 Singapore dog runs from requirements (LOCN-03)
// Coordinates researched for each location
const locations = [
  {
    name: 'Bishan-AMK Park',
    region: 'Central',
    latitude: 1.3647,
    longitude: 103.8454,
    notes: 'Large open field near Bishan MRT, dog run area near Pond Gardens'
  },
  {
    name: 'West Coast Park',
    region: 'West',
    latitude: 1.2935,
    longitude: 103.7653,
    notes: 'Coastal dog run with fenced area near car park'
  },
  {
    name: 'Jurong Lake Gardens',
    region: 'West',
    latitude: 1.3404,
    longitude: 103.7273,
    notes: 'Lakeside dog run at Chinese and Japanese Gardens'
  },
  {
    name: 'East Coast Park (Parkland Green)',
    region: 'East',
    latitude: 1.3011,
    longitude: 103.9125,
    notes: 'Dog run near Parkland Green, Area E'
  },
  {
    name: 'Katong Park',
    region: 'East',
    latitude: 1.3023,
    longitude: 103.8985,
    notes: 'Small neighborhood dog run'
  },
  {
    name: 'Sembawang Park',
    region: 'North',
    latitude: 1.4562,
    longitude: 103.8311,
    notes: 'Beachside dog run area'
  },
  {
    name: 'Yishun Park',
    region: 'North',
    latitude: 1.4194,
    longitude: 103.8395,
    notes: 'Dog run near Yishun Pond'
  },
  {
    name: 'Punggol Park',
    region: 'North-East',
    latitude: 1.3761,
    longitude: 103.8975,
    notes: 'Dog run near Punggol Waterway'
  },
  {
    name: 'Tiong Bahru Park (Sit Wah)',
    region: 'Central',
    latitude: 1.2859,
    longitude: 103.8239,
    notes: 'Small fenced dog run in Tiong Bahru estate'
  },
  {
    name: 'The Palawan (Sentosa)',
    region: 'South',
    latitude: 1.2490,
    longitude: 103.8242,
    notes: 'Dog-friendly beach area at Palawan Beach, Sentosa'
  },
  {
    name: 'Mount Emily Park',
    region: 'Central',
    latitude: 1.3032,
    longitude: 103.8468,
    notes: 'Hillside dog run near Somerset'
  }
];

async function seed(): Promise<void> {
  const env = validateEnv();

  // Safety check: prevent seeding production accidentally
  if (env.NODE_ENV === 'production') {
    console.error('ERROR: Cannot run seed script in production environment');
    console.error('Set NODE_ENV to development or test to seed data');
    process.exit(1);
  }

  console.log('Seeding Singapore dog run locations...');
  console.log(`Environment: ${env.NODE_ENV}`);

  try {
    let inserted = 0;
    let skipped = 0;

    for (const loc of locations) {
      const result = await pool.query(
        `INSERT INTO locations (name, region, latitude, longitude, notes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name) DO NOTHING
         RETURNING id`,
        [loc.name, loc.region, loc.latitude, loc.longitude, loc.notes]
      );

      if (result.rowCount && result.rowCount > 0) {
        console.log(`  + Added: ${loc.name}`);
        inserted++;
      } else {
        console.log(`  - Skipped (exists): ${loc.name}`);
        skipped++;
      }
    }

    console.log(`\nSeeding complete: ${inserted} inserted, ${skipped} skipped`);

    // Verify count
    const countResult = await pool.query('SELECT COUNT(*) FROM locations');
    console.log(`Total locations in database: ${countResult.rows[0]?.count}`);

  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

seed();
