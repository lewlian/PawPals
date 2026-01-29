-- Locations table for Singapore dog runs
CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  region VARCHAR(100) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for region-based queries
CREATE INDEX IF NOT EXISTS idx_locations_region ON locations(region);

-- Index for coordinate-based lookups (geofencing)
CREATE INDEX IF NOT EXISTS idx_locations_coordinates ON locations(latitude, longitude);
