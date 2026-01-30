-- Users table for Telegram user data
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL UNIQUE,
  first_name VARCHAR(255),
  username VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dogs table for dog profiles
CREATE TABLE IF NOT EXISTS dogs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  size VARCHAR(10) NOT NULL CHECK (size IN ('Small', 'Medium', 'Large')),
  breed VARCHAR(100) NOT NULL,
  age INTEGER CHECK (age >= 0 AND age <= 30),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient user lookup by Telegram ID
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);

-- Index for efficient dog lookup by user
CREATE INDEX IF NOT EXISTS idx_dogs_user_id ON dogs(user_id);
