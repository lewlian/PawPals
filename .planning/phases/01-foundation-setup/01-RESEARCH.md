# Phase 1: Foundation & Setup - Research

**Researched:** 2026-01-29
**Domain:** Telegram bot development with Node.js, TypeScript, Telegraf, PostgreSQL, Redis
**Confidence:** HIGH

## Summary

Phase 1 requires setting up a Telegram bot with Telegraf framework, implementing basic command structure with interactive buttons, and seeding a PostgreSQL database with 11 Singapore dog run locations. The standard approach uses Telegraf 4.16+ with TypeScript for bot logic, node-postgres (pg) for database operations, and node-redis for session state management.

The foundation architecture follows a middleware-based pattern where commands are registered as handlers, inline keyboards provide interactive UI elements, and database connections use pooling for efficiency. For Phase 1, polling mode is appropriate for development, with webhook migration planned for production (Phase 6).

Bot commands should be registered with BotFather to display in the Telegram UI, and environment configuration should be validated at startup using zod or similar schema validation. The project structure should separate concerns: handlers for bot logic, database modules for data access, and configuration for environment setup.

**Primary recommendation:** Use Telegraf 4.16+ with TypeScript strict mode, node-postgres with connection pooling, official @telegraf/session with Redis for session prep, and implement environment validation with zod for type-safe configuration.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| telegraf | 4.16.3+ | Telegram bot framework | Official modern framework with excellent TypeScript support, middleware architecture, full Bot API 7.1+ coverage |
| pg | 8.x | PostgreSQL client | Most mature and widely-adopted Node.js PostgreSQL driver, supports pooling, prepared statements, TypeScript types |
| redis | 4.x (node-redis) | Redis client | Official Redis client for Node.js, modern async/await API, full TypeScript support |
| typescript | 5.x | Type safety | Industry standard for type-safe Node.js development, required for Telegraf's full type inference |
| dotenv | 16.x | Environment config | Zero-dependency standard for .env file loading in Node.js |
| zod | 3.x | Schema validation | TypeScript-first validation library for environment variables and runtime data |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @telegraf/session | Latest | Session storage adapters | Phase 4+ when implementing session state (use with Redis store) |
| node-pg-migrate | 7.x | Database migrations | When setting up PostgreSQL schema management (alternative to raw SQL) |
| @types/node | 20.x | Node.js types | Always - provides TypeScript definitions for Node.js APIs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| telegraf | grammY, puregram | Newer frameworks but less mature ecosystem, fewer examples |
| pg (node-postgres) | postgres.js, pg-native | postgres.js is faster but less mature; pg-native requires native bindings |
| node-redis | ioredis | ioredis is legacy, lacks newer Redis features, migration path exists |
| node-pg-migrate | Prisma, Drizzle, raw SQL | ORMs add complexity; raw SQL lacks versioning; pg-migrate is PostgreSQL-specific |

**Installation:**
```bash
npm install telegraf pg redis dotenv zod
npm install -D typescript @types/node tsx
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── bot/                 # Telegram bot logic
│   ├── handlers/        # Command and callback handlers
│   ├── keyboards/       # Inline keyboard definitions
│   └── middleware/      # Custom middleware (error handling, logging)
├── db/                  # Database layer
│   ├── migrations/      # SQL migration files
│   ├── seed.ts          # Database seeding script
│   └── client.ts        # PostgreSQL pool configuration
├── redis/               # Redis client configuration
│   └── client.ts        # Redis connection setup
├── config/              # Environment configuration
│   └── env.ts           # Environment validation with zod
├── types/               # TypeScript type definitions
│   └── context.ts       # Extended Telegraf context types
└── index.ts             # Application entry point
```

### Pattern 1: Command Registration with TypeScript
**What:** Register bot commands as middleware handlers with strong typing
**When to use:** All command handlers (start, profile, checkin, live, checkout)
**Example:**
```typescript
// Source: https://github.com/telegraf/telegraf
import { Telegraf } from 'telegraf';

const bot = new Telegraf(process.env.BOT_TOKEN!);

bot.command('start', async (ctx) => {
  await ctx.reply('Welcome to PawPals SG!', {
    reply_markup: {
      inline_keyboard: [[
        { text: '🐕 Create Dog Profile', callback_data: 'create_profile' }
      ]]
    }
  });
});

bot.command('profile', async (ctx) => {
  await ctx.reply('Your dog profiles will appear here.');
});

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
```

### Pattern 2: Inline Keyboard Creation
**What:** Use Markup API for type-safe inline keyboard buttons
**When to use:** Interactive buttons for user actions
**Example:**
```typescript
// Source: https://telegraf.js.org/functions/Markup.inlineKeyboard.html
import { Markup } from 'telegraf';

// Method 1: Using Markup API (recommended)
const keyboard = Markup.inlineKeyboard([
  [Markup.button.callback('Create Dog Profile', 'create_profile')],
  [Markup.button.callback('View Profiles', 'view_profiles')]
]);

await ctx.reply('What would you like to do?', keyboard);

// Method 2: Raw format (for complex layouts)
await ctx.reply('Choose an option:', {
  reply_markup: {
    inline_keyboard: [
      [
        { text: 'Button 1', callback_data: 'btn_1' },
        { text: 'Button 2', callback_data: 'btn_2' }
      ],
      [{ text: 'Cancel', callback_data: 'cancel' }]
    ]
  }
});

// Handle callbacks
bot.action('create_profile', async (ctx) => {
  await ctx.answerCbQuery(); // Acknowledge button press
  await ctx.reply('Starting profile creation...');
});
```

### Pattern 3: PostgreSQL Connection Pooling
**What:** Use pg.Pool for efficient connection management
**When to use:** All database operations
**Example:**
```typescript
// Source: https://node-postgres.com/
import { Pool } from 'pg';

// db/client.ts
export const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20, // Maximum pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Query example
export async function getLocations() {
  const result = await pool.query(
    'SELECT id, name, region, latitude, longitude, notes FROM locations'
  );
  return result.rows;
}

// Clean shutdown
export async function closePool() {
  await pool.end();
}
```

### Pattern 4: Database Seeding
**What:** Idempotent seed script for development data
**When to use:** Initial database population with Singapore dog runs
**Example:**
```typescript
// Source: https://www.prisma.io/docs/orm/prisma-migrate/workflows/seeding
// db/seed.ts
import { pool } from './client';

const locations = [
  { name: 'Bishan-AMK Park', region: 'Central', lat: 1.3647, lng: 103.8494, notes: 'Large open field' },
  { name: 'West Coast Park', region: 'West', lat: 1.2933, lng: 103.7540, notes: 'Coastal dog run' },
  { name: 'Jurong Lake Gardens', region: 'West', lat: 1.3404, lng: 103.7273, notes: 'Lakeside area' },
  // ... other locations
];

async function seed() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Cannot seed production database');
  }

  console.log('Seeding locations...');

  for (const loc of locations) {
    await pool.query(
      `INSERT INTO locations (name, region, latitude, longitude, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (name) DO NOTHING`,
      [loc.name, loc.region, loc.lat, loc.lng, loc.notes]
    );
  }

  console.log('Seeding complete.');
  await pool.end();
}

seed().catch(console.error);
```

### Pattern 5: Environment Validation with Zod
**What:** Type-safe environment variable validation at startup
**When to use:** Application initialization
**Example:**
```typescript
// Source: https://www.creatures.sh/blog/env-type-safety-and-validation/
// config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().regex(/^\d+$/).transform(Number).default('5432'),
  DB_NAME: z.string().min(1, 'DB_NAME is required'),
  DB_USER: z.string().min(1, 'DB_USER is required'),
  DB_PASSWORD: z.string().min(1, 'DB_PASSWORD is required'),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ Environment validation failed:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}
```

### Pattern 6: Error Handling Middleware
**What:** Global error handler for bot operations
**When to use:** Always - prevents crashes from unhandled errors
**Example:**
```typescript
// Source: https://telegraf.js.org/classes/Telegraf-1.html
import { Telegraf } from 'telegraf';

const bot = new Telegraf(token);

bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);

  // Attempt to notify user (if possible)
  ctx.reply('Sorry, something went wrong. Please try again.').catch(() => {
    // Silent fail if we can't send message
  });
});
```

### Anti-Patterns to Avoid
- **Hardcoding credentials:** Always use environment variables, never commit tokens or passwords
- **Missing callback acknowledgment:** Always call `ctx.answerCbQuery()` for callback_query updates to remove loading state
- **Synchronous blocking:** Never use synchronous file I/O or blocking operations in handlers - Telegram expects quick responses
- **Global state in handlers:** Handlers can run concurrently - use database/Redis for state, not module-level variables
- **Creating connections per request:** Use connection pools, don't create new database clients for each query

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Distance between coordinates | Custom lat/lng math | `haversine-distance` npm package | Handles Earth curvature correctly, accounts for polar distortion, well-tested |
| Environment validation | Manual `process.env` checks | `zod` or `envalid` | Type inference, validation errors, prevents runtime surprises |
| Database migrations | Manual SQL version files | `node-pg-migrate` or raw SQL with versioning | Sequential ordering, rollback safety, PostgreSQL-specific features |
| Session storage | In-memory objects | `@telegraf/session` with Redis | Survives restarts, handles concurrency, TTL support built-in |
| Inline keyboard layouts | String concatenation | `Markup` API from Telegraf | Type-safe, handles escaping, readable code |
| Bot token security | Environment files in repo | `.env` with `.gitignore` + deployment secrets | Prevents token leaks, separates config from code |

**Key insight:** Telegram bot development has mature tooling. The complexity is in state management, error handling, and Telegram API quirks - not in basic infrastructure. Use proven libraries to focus on business logic.

## Common Pitfalls

### Pitfall 1: Forgetting to Answer Callback Queries
**What goes wrong:** Inline button presses show "loading..." spinner indefinitely, users think bot is broken
**Why it happens:** Telegram expects explicit acknowledgment of callback_query updates via `answerCbQuery()`
**How to avoid:** Always call `ctx.answerCbQuery()` at the start of action handlers
**Warning signs:** Users report buttons "not working" or "stuck loading"

### Pitfall 2: Not Registering Commands with BotFather
**What goes wrong:** Commands work via typing but don't appear in Telegram's command menu (/)
**Why it happens:** BotFather command registration is separate from code implementation
**How to avoid:** After implementing commands, use BotFather's `/setcommands` to register them
**Warning signs:** Bot responds to commands but users say "I don't see the commands"

### Pitfall 3: Missing Error Handler Crashes Bot
**What goes wrong:** Single unhandled error terminates entire bot process, requires manual restart
**Why it happens:** Default Telegraf behavior rethrows errors, causing process exit
**How to avoid:** Register `bot.catch()` handler early, use process managers (pm2/systemd) in production
**Warning signs:** Bot stops responding until manually restarted

### Pitfall 4: Using Polling in Production
**What goes wrong:** Excessive server load, delayed message delivery, wasted resources
**Why it happens:** Polling continuously requests updates even when no messages exist
**How to avoid:** Use polling for development only, migrate to webhooks for production (Phase 6)
**Warning signs:** High CPU usage, Telegram API rate limiting, slow responses

### Pitfall 5: Connection Pool Exhaustion
**What goes wrong:** Database queries hang or timeout, bot becomes unresponsive
**Why it happens:** Creating new database clients instead of reusing pool connections
**How to avoid:** Use `pg.Pool` singleton, configure max connections appropriately, close clients after use
**Warning signs:** "Pool exhausted" errors, queries taking unusually long, error spike after traffic increase

### Pitfall 6: Seed Data Overwrites Production
**What goes wrong:** Production database gets reset with test data, real user data lost
**Why it happens:** Seed script runs without environment checks
**How to avoid:** Guard seed scripts with `NODE_ENV !== 'production'` check, fail fast if production
**Warning signs:** Production data mysteriously resets, users lose profiles

### Pitfall 7: Environment Variables Not Validated
**What goes wrong:** Bot starts but crashes on first operation due to missing/invalid config
**Why it happens:** No validation at startup, errors surface during runtime
**How to avoid:** Validate env vars with zod at application start, fail fast with clear error messages
**Warning signs:** Bot starts successfully but crashes on first user interaction

### Pitfall 8: Haversine Formula Precision Issues
**What goes wrong:** Users within geofence get rejected, or users outside get accepted
**Why it happens:** Incorrect unit conversion (degrees vs radians), wrong Earth radius constant
**How to avoid:** Use tested library (`haversine-distance`) or verify implementation against known coordinates
**Warning signs:** Geofence validation inconsistent, users report "I'm here but bot says I'm not"

## Code Examples

Verified patterns from official sources:

### Basic Bot Setup with TypeScript
```typescript
// Source: https://github.com/telegraf/telegraf
// index.ts
import 'dotenv/config';
import { Telegraf } from 'telegraf';
import { validateEnv } from './config/env';
import { pool } from './db/client';

const env = validateEnv();
const bot = new Telegraf(env.BOT_TOKEN);

// Error handler
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
  ctx.reply('An error occurred. Please try again.').catch(() => {});
});

// Commands
bot.command('start', async (ctx) => {
  await ctx.reply(
    'Welcome to PawPals SG! 🐕\n\nCheck real-time dog run occupancy across Singapore.',
    {
      reply_markup: {
        inline_keyboard: [[
          { text: '🐾 Create Dog Profile', callback_data: 'create_profile' }
        ]]
      }
    }
  );
});

bot.command('profile', async (ctx) => {
  await ctx.reply('Dog profile management coming soon!');
});

bot.command('checkin', async (ctx) => {
  await ctx.reply('Check-in feature coming soon!');
});

bot.command('live', async (ctx) => {
  await ctx.reply('Live dashboard coming soon!');
});

bot.command('checkout', async (ctx) => {
  await ctx.reply('Checkout feature coming soon!');
});

// Callback handler
bot.action('create_profile', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('Profile creation will be available in Phase 2!');
});

// Launch
async function main() {
  console.log('Starting bot...');
  await bot.launch();
  console.log('Bot running!');
}

main().catch((err) => {
  console.error('Failed to start bot:', err);
  process.exit(1);
});

// Graceful shutdown
process.once('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  bot.stop('SIGINT');
  await pool.end();
});

process.once('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  bot.stop('SIGTERM');
  await pool.end();
});
```

### Redis Client Setup
```typescript
// Source: https://redis.io/docs/latest/develop/clients/nodejs/
// redis/client.ts
import { createClient } from 'redis';

export type RedisClient = ReturnType<typeof createClient>;

let client: RedisClient | null = null;

export async function getRedisClient(): Promise<RedisClient> {
  if (client) return client;

  client = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  });

  client.on('error', (err) => console.error('Redis Client Error:', err));

  await client.connect();
  console.log('Redis connected');

  return client;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}

// Example: Session with TTL
export async function setSession(userId: string, data: any, ttlSeconds: number) {
  const redis = await getRedisClient();
  await redis.set(`session:${userId}`, JSON.stringify(data), {
    EX: ttlSeconds, // Expires in X seconds
  });
}

export async function getSession(userId: string) {
  const redis = await getRedisClient();
  const data = await redis.get(`session:${userId}`);
  return data ? JSON.parse(data) : null;
}
```

### Database Migration (Initial Schema)
```sql
-- Source: PostgreSQL best practices
-- db/migrations/0001-initial-schema.sql
CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  region VARCHAR(100) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_locations_region ON locations(region);
CREATE INDEX idx_locations_coordinates ON locations(latitude, longitude);
```

### TypeScript Configuration for Node.js 24
```json
// Source: https://www.typescriptlang.org/tsconfig/
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2024"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ioredis | node-redis (official client) | 2023+ | Better TypeScript support, modern API, official Redis backing |
| Telegraf v3 | Telegraf v4.16+ | 2021 (v4.0) | Improved TypeScript typings, Bot API 7.1+ support, breaking changes in middleware |
| Manual env checking | Zod/envalid validation | 2023+ | Type inference, early failure, prevents runtime errors |
| Timestamps for migrations | Sequential numbering | N/A | Guarantees same order on all systems, avoids timestamp conflicts |
| Polling in production | Webhooks | Always preferred | 60-80% resource savings, instant delivery vs polling delay |
| pg-promise | pg (node-postgres) | Stable since 2015 | pg is more widely adopted, simpler API, better ecosystem support |

**Deprecated/outdated:**
- **telegraf-session-redis (archived):** Use `@telegraf/session` with Redis store instead
- **Telegraf Scene system (v3):** Replaced with Composer-based approach in v4
- **ioredis for new projects:** node-redis is now official and recommended

## Open Questions

Things that couldn't be fully resolved:

1. **BotFather Command Description Format**
   - What we know: Commands registered with `/setcommands` as "command - description" format, one per line
   - What's unclear: Maximum description length, whether emoji are supported, formatting constraints
   - Recommendation: Test with Phase 1 commands, keep descriptions under 100 chars, avoid special formatting

2. **Redis Session Schema for Phase 4**
   - What we know: node-redis supports TTL via `EX` option, `@telegraf/session` provides Redis store
   - What's unclear: Optimal session key structure, whether to store full session or just IDs
   - Recommendation: Defer to Phase 4 research, for now just set up Redis client infrastructure

3. **PostgreSQL Pool Size for Production**
   - What we know: Default max pool size is 10, configurable via `max` option
   - What's unclear: Optimal size for expected user load, relationship to Redis pool
   - Recommendation: Start with 20 connections for development, monitor in Phase 6 and adjust

4. **Geofence Radius Accuracy**
   - What we know: 200m threshold specified in requirements, Haversine formula provides great-circle distance
   - What's unclear: Whether GPS accuracy issues in urban Singapore require larger threshold
   - Recommendation: Implement 200m as specified, collect user feedback in testing, adjust if needed

## Sources

### Primary (HIGH confidence)
- Telegraf GitHub repository: https://github.com/telegraf/telegraf (v4.16.3)
- Telegraf official docs: https://telegraf.js.org/ (API reference)
- node-postgres documentation: https://node-postgres.com/ (connection pooling, queries)
- Redis Node.js guide: https://redis.io/docs/latest/develop/clients/nodejs/ (official client)
- TypeScript TSConfig reference: https://www.typescriptlang.org/tsconfig/ (compiler options)

### Secondary (MEDIUM confidence)
- DEV Community Telegraf tutorials: https://dev.to/6akcuk/your-own-telegram-bot-on-nodejs-with-typescript-telegraf-and-fastify-part-1-4f3l (TypeScript setup patterns)
- Hostman webhook vs polling guide: https://hostman.com/tutorials/difference-between-polling-and-webhook-in-telegram-bots/ (production recommendations)
- @telegraf/session GitHub: https://github.com/telegraf/session (Redis storage adapters)
- MaibornWolff migrations article: https://www.maibornwolff.de/en/know-how/migrations-nodejs-and-postgresql/ (migration best practices)
- Creatures.sh Zod guide: https://www.creatures.sh/blog/env-type-safety-and-validation/ (environment validation patterns)

### Tertiary (LOW confidence)
- NPM package metadata for version recommendations (haversine-distance, node-pg-migrate)
- Stack Overflow-style community discussions on bot architecture
- Medium articles on TypeScript project structure (marked for validation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All recommendations verified with official documentation and active maintenance
- Architecture: HIGH - Patterns sourced from official examples and established community practices
- Pitfalls: MEDIUM-HIGH - Common issues documented in GitHub issues and community resources, some anecdotal
- Code examples: HIGH - All code examples adapted from official documentation or verified sources

**Research date:** 2026-01-29
**Valid until:** 2026-02-28 (30 days - stable ecosystem, slow-moving versions)

**Notes:**
- Telegraf 4.16.3 released Feb 2024, stable for production use
- Node.js 24.x is current LTS baseline
- PostgreSQL and Redis clients are mature, no breaking changes expected
- Webhook migration research deferred to Phase 6
- Session implementation details deferred to Phase 4
