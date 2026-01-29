# Architecture Patterns: Telegram Bot with Real-Time State Management

**Domain:** Telegram bot with real-time session tracking, geofencing, and dual-database architecture
**Project:** PawPals SG - Dog run occupancy tracker
**Researched:** 2026-01-29
**Overall Confidence:** MEDIUM-HIGH

## Executive Summary

Telegram bots with real-time state management typically follow a **layered architecture** with clear separation between user interaction, business logic, and data persistence. The recommended pattern uses:

1. **Dual-database architecture**: PostgreSQL for permanent data, Redis for ephemeral sessions
2. **Event-driven updates**: Webhook-based for production (60-80% resource savings vs polling)
3. **Background job processing**: Scheduled tasks for session expiry monitoring
4. **Clean architecture pattern**: Handler → Service → Repository layers
5. **Modular command structure**: Each bot command as independent handler

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         TELEGRAM API                             │
│                   (Update Distribution Layer)                    │
└────────────────────────────┬────────────────────────────────────┘
                             │ Webhooks (HTTPS)
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                      BOT APPLICATION                             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  UPDATE ROUTER (Telegraf/Framework)                        │ │
│  │  - Validates incoming updates                               │ │
│  │  - Routes to appropriate handler                            │ │
│  │  - Applies middleware (auth, logging, error handling)       │ │
│  └────────────────────┬───────────────────────────────────────┘ │
│                       ↓                                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  COMMAND HANDLERS (Presentation Layer)                     │ │
│  │  - /start, /profile, /checkin, /checkout, /dashboard       │ │
│  │  - Input validation                                         │ │
│  │  - Context management                                       │ │
│  └────────────────────┬───────────────────────────────────────┘ │
│                       ↓                                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  SERVICE LAYER (Business Logic)                            │ │
│  │  - ProfileService: User/dog CRUD operations                │ │
│  │  - SessionService: Check-in/out logic, geofence validation │ │
│  │  - DashboardService: Aggregate active sessions             │ │
│  │  - GeofenceService: Haversine distance calculations        │ │
│  │  - NotificationService: Alert users before expiry          │ │
│  └────────────────────┬───────────────────────────────────────┘ │
│                       ↓                                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  REPOSITORY LAYER (Data Access)                            │ │
│  │  - UserRepository (PostgreSQL)                             │ │
│  │  - DogRepository (PostgreSQL)                              │ │
│  │  - SessionRepository (Redis + PostgreSQL)                  │ │
│  └────────────────────┬───────────────────────────────────────┘ │
└────────────────────────┼───────────────────────────────────────┘
                         ↓
┌────────────────────────────────────────────────────────────────┐
│              BACKGROUND JOB SCHEDULER                           │
│  - Monitor Redis keyspace notifications (__keyevent@*:expired) │
│  - Periodic dashboard refresh (every 30-60 seconds)            │
│  - Pre-expiry warnings (5 minutes before TTL)                  │
└────────────────────────┬───────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DATA PERSISTENCE LAYER                        │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │   POSTGRESQL             │  │   REDIS                      │  │
│  │   (Permanent Data)       │  │   (Ephemeral Data)           │  │
│  │                          │  │                              │  │
│  │  - users                 │  │  - session:{id} (TTL-based)  │  │
│  │  - dogs                  │  │  - location:{user_id}        │  │
│  │  - dog_runs (locations)  │  │  - dashboard:cache           │  │
│  │  - session_history       │  │                              │  │
│  └─────────────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Boundaries

### 1. Update Router (Framework Layer)

**Responsibility:** Receive Telegram updates, apply middleware, route to handlers
**Technology:** Telegraf (Node.js), python-telegram-bot (Python), or similar
**Communicates with:**
- Telegram API (incoming webhooks)
- Command Handlers (dispatches updates)
- Middleware chain (auth, logging, error handling)

**Key decisions:**
- Use **webhooks** for production (not polling)
- Requires public HTTPS endpoint
- Implement graceful shutdown for SIGINT/SIGTERM

**Build order:** Phase 1 (Foundation)

---

### 2. Command Handlers (Presentation Layer)

**Responsibility:** Handle user commands, validate input, orchestrate service calls
**File structure:** `handlers/start.ts`, `handlers/profile.ts`, `handlers/checkin.ts`, etc.
**Communicates with:**
- Service Layer (business logic)
- Telegram API (send messages, keyboards)

**Pattern:**
```javascript
// Each handler is independent and decides if it processes an update
async function handleCheckIn(ctx) {
  // 1. Validate input
  // 2. Call service layer
  // 3. Format response
  // 4. Send to user
}
```

**Anti-pattern:** Business logic in handlers (e.g., Haversine calculation in handler)

**Build order:** Phase 2-4 (Progressive feature addition)

---

### 3. Service Layer (Business Logic)

**Responsibility:** Core business rules, validation, orchestration between repositories
**Communicates with:**
- Repository Layer (data access)
- Other services (cross-cutting concerns)

**Key services:**

| Service | Responsibility | Key Methods |
|---------|---------------|-------------|
| `ProfileService` | User/dog profile management | `createProfile()`, `updateProfile()`, `getDogs()` |
| `SessionService` | Check-in/out lifecycle | `startSession()`, `endSession()`, `validateGeofence()` |
| `DashboardService` | Aggregate active sessions | `getActiveSessions()`, `getOccupancyByRun()` |
| `GeofenceService` | Location validation | `calculateDistance()`, `isWithinThreshold()` |
| `NotificationService` | Alerts and reminders | `sendExpiryWarning()`, `notifyCheckout()` |

**Build order:** Incrementally with corresponding features

---

### 4. Repository Layer (Data Access)

**Responsibility:** Abstract database operations, provide clean interface to services
**Communicates with:**
- PostgreSQL (via ORM/query builder)
- Redis (via redis client)

**Repository pattern:**
```javascript
class SessionRepository {
  // Dual-write pattern: Redis + PostgreSQL
  async createSession(sessionData) {
    // 1. Write to Redis with TTL
    await redis.setex(`session:${id}`, TTL, JSON.stringify(data));
    // 2. Write to PostgreSQL for history
    await db.insert('sessions', sessionData);
    return id;
  }

  async getActiveSession(userId) {
    // Read from Redis (fast)
    return await redis.get(`session:${userId}`);
  }

  async getSessionHistory(userId) {
    // Read from PostgreSQL (permanent)
    return await db.query('SELECT * FROM sessions WHERE user_id = ?', userId);
  }
}
```

**Build order:** Phase 2 (With database setup)

---

### 5. Background Job Scheduler

**Responsibility:** Time-based and event-based background tasks
**Technology:** APScheduler (Python), node-cron (Node.js), BullMQ (Node.js with Redis)
**Communicates with:**
- Redis (keyspace notifications)
- Service Layer (trigger business logic)
- Telegram API (send notifications)

**Key jobs:**

| Job | Trigger | Purpose |
|-----|---------|---------|
| `SessionExpiryMonitor` | Redis keyspace event | React to session expiry, notify user |
| `PreExpiryWarning` | Run every 1 minute | Check sessions expiring in 5 minutes, send warning |
| `DashboardRefresh` | Run every 30-60 seconds | Update cached dashboard data |
| `CleanupOrphanedSessions` | Daily at 2 AM | Remove stale data, sync Redis ↔ PostgreSQL |

**Implementation pattern:**
```javascript
// React to Redis expiry
redis.subscribe('__keyevent@*__:expired');
redis.on('message', async (channel, key) => {
  if (key.startsWith('session:')) {
    await notificationService.sendExpiryNotification(sessionId);
  }
});
```

**Build order:** Phase 3 (After core check-in/out works)

---

### 6. Data Persistence Layer

**PostgreSQL (Permanent Data):**

```sql
-- Users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT UNIQUE NOT NULL,
  phone_number VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Dogs table
CREATE TABLE dogs (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  name VARCHAR(100) NOT NULL,
  breed VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Dog runs (geofence boundaries)
CREATE TABLE dog_runs (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  threshold_meters INT DEFAULT 200
);

-- Session history (archival)
CREATE TABLE session_history (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  dog_id INT REFERENCES dogs(id),
  dog_run_id INT REFERENCES dog_runs(id),
  checked_in_at TIMESTAMP NOT NULL,
  checked_out_at TIMESTAMP,
  duration_minutes INT
);
```

**Redis (Ephemeral Data):**

```
Key Pattern: session:{session_id}
Value: JSON { userId, dogId, dogRunId, checkedInAt, lat, lng }
TTL: 3600 seconds (1 hour)

Key Pattern: user:location:{telegram_id}
Value: JSON { lat, lng, timestamp }
TTL: 300 seconds (5 minutes)

Key Pattern: dashboard:cache
Value: JSON { dogRunId → activeCount }
TTL: 60 seconds (1 minute)
```

**Build order:** Phase 1 (PostgreSQL schema), Phase 2 (Redis patterns)

## Data Flow Patterns

### Pattern 1: User Check-In Flow

```
User sends /checkin command
  ↓
Handler validates location shared
  ↓
GeofenceService.isWithinThreshold(userLat, userLng, dogRunLat, dogRunLng)
  ↓ (Haversine calculation)
If within 200m:
  SessionService.startSession(userId, dogId, dogRunId, location)
    ↓
  SessionRepository.createSession()
    → Redis (with TTL)
    → PostgreSQL (for history)
    ↓
  NotificationService.scheduleExpiryWarning(sessionId, expiryTime - 5min)
    ↓
  Handler sends confirmation to user
```

### Pattern 2: Session Auto-Expiry Flow

```
Redis TTL reaches 0
  ↓
Redis publishes keyspace notification: __keyevent@*__:expired
  ↓
Background job receives event
  ↓
SessionExpiryMonitor.handleExpiry(sessionId)
  ↓
SessionRepository.archiveSession(sessionId)
  → Update PostgreSQL session_history with checked_out_at
  ↓
NotificationService.sendExpiryNotification(userId)
  → "Your session expired. Your dog has been checked out."
```

### Pattern 3: Real-Time Dashboard Flow

```
User sends /dashboard command
  ↓
Handler requests DashboardService.getOccupancy()
  ↓
Check Redis cache: dashboard:cache
  ↓
If cache HIT:
  Return cached data
Else (cache MISS):
  SessionRepository.getAllActiveSessions() from Redis
    ↓
  Group by dog_run_id, count active sessions
    ↓
  Store in Redis: dashboard:cache (TTL: 60s)
    ↓
  Return data
    ↓
Handler formats as message with inline buttons
```

## Architecture Patterns to Follow

### Pattern 1: Dual-Database Write Pattern

**What:** Write session data to both Redis (ephemeral) and PostgreSQL (permanent) simultaneously

**When:** Creating or ending sessions

**Why:**
- Redis provides fast lookup for active sessions
- PostgreSQL preserves history after Redis TTL expires
- Enables analytics on past sessions

**Example:**
```javascript
async createSession(data) {
  const sessionId = generateId();

  // Write to Redis (active session)
  await redis.setex(
    `session:${sessionId}`,
    3600,
    JSON.stringify(data)
  );

  // Write to PostgreSQL (history)
  await db.insert('session_history', {
    id: sessionId,
    user_id: data.userId,
    checked_in_at: new Date(),
    ...data
  });

  return sessionId;
}
```

**Confidence:** HIGH (verified in multiple production implementations)

---

### Pattern 2: Repository Pattern for Data Access

**What:** Abstract database operations behind interfaces, services never directly query databases

**When:** All data access

**Why:**
- Testability (mock repositories in tests)
- Flexibility (swap database without changing business logic)
- Single Responsibility (repositories handle queries, services handle logic)

**Example:**
```javascript
// Service Layer (business logic)
class SessionService {
  constructor(sessionRepo, geofenceService) {
    this.sessionRepo = sessionRepo;
    this.geofenceService = geofenceService;
  }

  async startSession(userId, dogId, dogRunId, location) {
    // Business rule: Check geofence
    const dogRun = await this.dogRunRepo.findById(dogRunId);
    if (!this.geofenceService.isWithin(location, dogRun, 200)) {
      throw new Error('Not within geofence');
    }

    // Delegate data access to repository
    return await this.sessionRepo.createSession({
      userId, dogId, dogRunId, location
    });
  }
}

// Repository Layer (data access)
class SessionRepository {
  async createSession(data) { /* ... */ }
  async findActiveByUser(userId) { /* ... */ }
  async archiveSession(sessionId) { /* ... */ }
}
```

**Confidence:** HIGH (standard pattern in clean architecture)

---

### Pattern 3: Redis Keyspace Notifications for Expiry

**What:** Subscribe to Redis `__keyevent@*__:expired` channel to react to TTL expiry

**When:** Monitoring session expirations

**Why:**
- Event-driven (no polling needed)
- Redis handles expiry logic
- Bot reacts instantly when session expires

**Example:**
```javascript
// Enable keyspace notifications in Redis
await redis.config('SET', 'notify-keyspace-events', 'Ex');

// Subscribe to expired events
const subscriber = redis.duplicate();
await subscriber.subscribe('__keyevent@*__:expired');

subscriber.on('message', async (channel, expiredKey) => {
  if (expiredKey.startsWith('session:')) {
    const sessionId = expiredKey.split(':')[1];
    await sessionExpiryHandler(sessionId);
  }
});
```

**Important caveat:** Redis does NOT guarantee immediate notification. There can be delays if many keys expire simultaneously or under high load.

**Confidence:** MEDIUM (verified pattern, but timing caveats exist)

---

### Pattern 4: Haversine Geofencing

**What:** Calculate great-circle distance between two lat/lng points to determine geofence boundary

**When:** Validating user location during check-in

**Why:**
- Accounts for Earth's curvature (more accurate than Euclidean distance)
- Standard for <1000km distances
- Simple formula, no external API needed

**Example:**
```javascript
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
}

function isWithinGeofence(userLat, userLng, dogRunLat, dogRunLng, thresholdMeters) {
  const distance = haversineDistance(userLat, userLng, dogRunLat, dogRunLng);
  return distance <= thresholdMeters;
}
```

**Confidence:** HIGH (mathematically proven, widely used)

---

### Pattern 5: Webhook Deployment for Production

**What:** Use webhooks (not long polling) for Telegram updates in production

**When:** Deploying to production environment

**Why:**
- 60-80% resource savings vs polling
- Instant update delivery (no polling delay)
- Scales better under high load
- Required for serverless deployments

**Requirements:**
- Public HTTPS endpoint with valid SSL certificate
- Webhook URL registered with Telegram: `setWebhook`
- Web server (Express, Fastify) to receive POST requests

**Example:**
```javascript
// Setup webhook
await bot.telegram.setWebhook('https://your-domain.com/webhook');

// Express endpoint
app.post('/webhook', async (req, res) => {
  await bot.handleUpdate(req.body);
  res.sendStatus(200);
});
```

**Confidence:** HIGH (official Telegram recommendation for production)

## Anti-Patterns to Avoid

### Anti-Pattern 1: Business Logic in Handlers

**What goes wrong:** Handlers contain Haversine calculations, session validation logic, etc.

**Why bad:**
- Untestable (handlers are tightly coupled to Telegram context)
- Non-reusable (can't use logic outside bot commands)
- Violates Single Responsibility Principle

**Instead:** Handlers only validate input and orchestrate service calls. All business logic lives in service layer.

**Example:**
```javascript
// ❌ BAD: Logic in handler
async function handleCheckIn(ctx) {
  const distance = calculateHaversine(ctx.location, dogRun.location);
  if (distance > 200) {
    return ctx.reply('Too far');
  }
  await redis.setex('session:' + userId, 3600, JSON.stringify(data));
}

// ✅ GOOD: Handler orchestrates services
async function handleCheckIn(ctx) {
  try {
    const session = await sessionService.startSession(
      ctx.from.id,
      dogId,
      dogRunId,
      ctx.location
    );
    await ctx.reply(`Checked in! Session ID: ${session.id}`);
  } catch (error) {
    await ctx.reply(error.message);
  }
}
```

---

### Anti-Pattern 2: Polling in Production

**What goes wrong:** Using long polling instead of webhooks in production

**Why bad:**
- Wastes 60-80% of resources on redundant requests
- Polling delay (typically 1-3 seconds) feels sluggish
- Doesn't scale well with multiple bot instances

**Instead:** Use webhooks with proper HTTPS endpoint

---

### Anti-Pattern 3: Storing Active Sessions Only in PostgreSQL

**What goes wrong:** Reading active sessions from PostgreSQL on every dashboard request

**Why bad:**
- PostgreSQL reads are slower than Redis (10-50ms vs <1ms)
- Dashboard needs fast reads (users expect instant results)
- PostgreSQL not optimized for TTL-based expiry

**Instead:** Use Redis for active sessions, PostgreSQL for history

---

### Anti-Pattern 4: Relying on Redis Keyspace Notifications Alone

**What goes wrong:** Only using `__keyevent@*__:expired` without backup polling

**Why bad:**
- Redis does NOT guarantee immediate expiry notifications
- If Redis is under load, notifications can be delayed by seconds/minutes
- If bot restarts, it misses expiry events that occurred during downtime

**Instead:** Combine keyspace notifications with periodic polling (every 1-2 minutes) as backup

**Example:**
```javascript
// Primary: React to Redis events
subscriber.on('message', handleExpiry);

// Backup: Poll every 2 minutes for sessions expiring soon
setInterval(async () => {
  const expiringKeys = await redis.keys('session:*');
  for (const key of expiringKeys) {
    const ttl = await redis.ttl(key);
    if (ttl > 0 && ttl < 120) { // Expiring in next 2 minutes
      // Double-check and handle
    }
  }
}, 120000);
```

---

### Anti-Pattern 5: Monolithic main.js File

**What goes wrong:** All handlers, services, and logic in a single file

**Why bad:**
- Impossible to navigate (1000+ line files)
- Merge conflicts in teams
- Adding feature requires editing unrelated code

**Instead:** Modular structure with separate files per concern

**Structure:**
```
src/
├── main.ts                    # Application orchestrator
├── handlers/
│   ├── start.ts              # /start command
│   ├── profile.ts            # /profile, /adddog
│   ├── checkin.ts            # /checkin
│   ├── checkout.ts           # /checkout
│   └── dashboard.ts          # /dashboard
├── services/
│   ├── ProfileService.ts
│   ├── SessionService.ts
│   ├── GeofenceService.ts
│   └── NotificationService.ts
├── repositories/
│   ├── UserRepository.ts
│   ├── DogRepository.ts
│   └── SessionRepository.ts
├── jobs/
│   ├── SessionExpiryMonitor.ts
│   └── PreExpiryWarning.ts
└── config/
    ├── database.ts
    └── redis.ts
```

## Build Order Recommendations

Based on component dependencies, suggested build order:

### Phase 1: Foundation (Week 1)
**Components:**
- Update Router (Telegraf setup)
- PostgreSQL schema
- Redis connection
- Basic handler structure (/start command)

**Why first:** Everything depends on these foundations

**Validation:** Bot responds to /start, databases connect

---

### Phase 2: Profile Management (Week 1-2)
**Components:**
- ProfileService
- UserRepository, DogRepository
- Profile handlers (/profile, /adddog)

**Why second:** Sessions require user/dog data to exist first

**Validation:** Users can create profiles and add dogs

---

### Phase 3: Core Check-In/Out (Week 2-3)
**Components:**
- SessionService
- GeofenceService (Haversine)
- SessionRepository (dual-write pattern)
- Check-in/out handlers

**Why third:** Core value proposition

**Validation:** Users can check in/out, data persists in both databases

---

### Phase 4: Real-Time Dashboard (Week 3)
**Components:**
- DashboardService
- Dashboard handler
- Redis caching for aggregates

**Why fourth:** Requires active sessions to exist first

**Validation:** Dashboard shows live occupancy counts

---

### Phase 5: Background Jobs (Week 4)
**Components:**
- SessionExpiryMonitor
- PreExpiryWarning job
- Redis keyspace notifications
- NotificationService

**Why fifth:** Enhancement on top of working check-in/out

**Validation:** Users receive notifications before/after expiry

---

### Phase 6: Production Deployment (Week 4)
**Components:**
- Webhook endpoint
- HTTPS setup
- Environment variables
- Graceful shutdown

**Why last:** Convert from polling (dev) to webhooks (prod)

**Validation:** Bot runs on production server with webhooks

## Scalability Considerations

| Concern | At 100 users | At 1K users | At 10K users |
|---------|--------------|-------------|--------------|
| **Bot instances** | Single instance, polling OK | Single instance, webhooks recommended | Multiple instances behind load balancer |
| **Redis** | Single Redis instance | Single Redis with persistence | Redis cluster or managed service (AWS ElastiCache) |
| **PostgreSQL** | Single instance, no indexes needed | Single instance, add indexes on user_id, session timestamps | Read replicas, connection pooling (PgBouncer) |
| **Background jobs** | In-process cron | In-process cron | Separate worker process or BullMQ with Redis |
| **Dashboard caching** | 60s TTL cache | 30s TTL cache | 10s TTL cache + lazy invalidation on writes |

## Technology Stack Recommendations

Based on research, recommended stack for Node.js implementation:

| Layer | Technology | Version | Why |
|-------|-----------|---------|-----|
| **Bot Framework** | Telegraf | v4.16+ | Clean syntax, TypeScript support, active maintenance |
| **Runtime** | Node.js | v20+ LTS | Async/await native, good ecosystem |
| **Web Server** | Fastify | v4+ | Fast webhook handling, better performance than Express |
| **PostgreSQL ORM** | Prisma or Drizzle | Latest | Type-safe, migrations built-in |
| **Redis Client** | ioredis | v5+ | Best Node.js Redis client, keyspace notification support |
| **Background Jobs** | node-cron | v3+ | Simple for start, migrate to BullMQ if scaling |
| **Validation** | Zod | v3+ | TypeScript-first schema validation |

**Alternative for Python:**
- Framework: python-telegram-bot (PTB) v21+
- ORM: SQLAlchemy
- Redis: redis-py
- Jobs: APScheduler

## Sources

### Architecture Patterns
- [Building Robust Telegram Bots](https://henrywithu.com/building-robust-telegram-bots/)
- [Two Design Patterns for Telegram Bots - DEV Community](https://dev.to/madhead/two-design-patterns-for-telegram-bots-59f5)
- [Clean Architecture Telegram Bot - GitHub](https://github.com/barahouei/clean-architecture-telegram-bot)
- [Building a Global Sanctions Tracker Telegram Bot with Clean Architecture](https://oleg-dubetcky.medium.com/building-a-global-sanctions-tracker-telegram-bot-with-clean-architecture-57e5a56340f9)

### Session Management
- [Telegram Bot Template with PostgreSQL, Redis, Docker - GitHub](https://github.com/donBarbos/telegram-bot-template)
- [A Developer's Guide to Building Telegram Bots in 2025](https://stellaray777.medium.com/a-developers-guide-to-building-telegram-bots-in-2025-dbc34cd22337)
- [Telegraf Session Redis - GitHub](https://github.com/telegraf/telegraf-session-redis)

### Geofencing
- [ESP-32 Geofencing With Telegram Bot - GitHub](https://github.com/Nurudeeen/ESP-32_Geofencing-_With_Telegram-Bot)
- [Build a Shipment Tracking Tool using a Telegram Bot](https://towardsdatascience.com/build-a-real-time-shipment-tracking-tool-using-a-telegram-bot-beb6ab29fca3/)
- [Haversine Formula for Geospatial Distances — Product Teacher](https://www.productteacher.com/quick-product-tips/haversine-formula-for-product-teams)

### Redis & Background Jobs
- [Handling Cache Expiry Notifications in a Redis-Based Application](https://partnerpens.hashnode.dev/handling-cache-expiry-notifications-in-a-redis-based-application)
- [Redis Key Expiration: Automating Tasks with Redis Events](https://gokhana.medium.com/redis-key-expiration-automating-tasks-with-redis-events-not-cron-jobs-bc403d0beedb)
- [Redis Keyspace Notifications - Official Docs](https://redis.io/docs/latest/develop/pubsub/keyspace-notifications/)
- [JobQueue - python-telegram-bot](https://docs.python-telegram-bot.org/telegram.ext.jobqueue.html)

### Webhook vs Polling
- [Polling vs Webhook in Telegram Bots | Guide by Hostman](https://hostman.com/tutorials/difference-between-polling-and-webhook-in-telegram-bots/)
- [Long Polling vs. Webhooks | grammY](https://grammy.dev/guide/deployment-types)
- [Building a Scalable Telegram Bot with Node.js, BullMQ, and Webhooks](https://medium.com/@pushpesh0/building-a-scalable-telegram-bot-with-node-js-bullmq-and-webhooks-6b0070fcbdfc)

### Node.js/Telegraf
- [Telegraf: Modern Telegram Bot Framework for Node.js - GitHub](https://github.com/telegraf/telegraf)
- [Your own Telegram bot on NodeJS with TypeScript, Telegraf and Fastify](https://dev.to/6akcuk/your-own-telegram-bot-on-nodejs-with-typescript-telegraf-and-fastify-part-1-4f3l)
- [Build a Telegram Bot using TypeScript, Node.js, and Telegraf](https://medium.com/geekculture/build-a-telegram-bot-using-typescript-node-js-and-telegraf-and-deploy-it-on-heroku-fcc28c15614f)

---

**Confidence Assessment:**
- **Component boundaries**: HIGH (verified across multiple implementations)
- **Data flow patterns**: HIGH (standard patterns for dual-database architecture)
- **Build order**: MEDIUM-HIGH (logical dependencies clear, exact timing flexible)
- **Scalability**: MEDIUM (based on general architecture principles, project-specific testing needed)
