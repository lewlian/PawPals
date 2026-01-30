-- Sessions table for tracking check-in/checkout events
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  checked_out_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'expired', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for multi-dog check-ins
CREATE TABLE IF NOT EXISTS session_dogs (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  dog_id INTEGER NOT NULL REFERENCES dogs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, dog_id)
);

-- Index for finding active sessions by user
CREATE INDEX IF NOT EXISTS idx_sessions_user_active ON sessions(user_id, status) WHERE status = 'active';

-- Index for expiry cleanup queries
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at) WHERE status = 'active';

-- Index for location-based active session queries
CREATE INDEX IF NOT EXISTS idx_sessions_location_active ON sessions(location_id, status) WHERE status = 'active';

-- Index for session_dogs lookups
CREATE INDEX IF NOT EXISTS idx_session_dogs_session ON session_dogs(session_id);
CREATE INDEX IF NOT EXISTS idx_session_dogs_dog ON session_dogs(dog_id);
