# Technology Stack

**Project:** PawPals SG
**Domain:** Telegram bot with real-time geofencing and session management
**Researched:** 2026-01-29
**Overall confidence:** HIGH

## Executive Summary

For a Telegram bot with geofencing, real-time session management, and PostgreSQL/Redis backend, the standard 2026 stack centers on **Node.js with TypeScript** using **Telegraf** as the bot framework. This stack provides excellent performance, strong typing, and a mature ecosystem for all requirements: location-based tracking (Haversine distance calculations), session TTL management with Redis, and relational data persistence with PostgreSQL.

**Why Node.js over Python:** While python-telegram-bot (v22.6) is actively maintained and excellent for ML/data-heavy bots, Node.js excels at real-time experiences, has superior async I/O for session management, and integrates seamlessly with modern TypeScript tooling. For a bot focused on real-time occupancy tracking with auto-expiry sessions, Node.js is the natural fit.

---

## Recommended Stack

### Core Runtime & Language

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Node.js** | 24.x LTS (Krypton) | Runtime environment | Active LTS through April 2028. v24 is the recommended primary choice for 2026 production apps. Native .env support (--env-file flag) eliminates dotenv dependency. |
| **TypeScript** | 5.x | Type safety & DX | Telegraf ships with full TypeScript declarations. Prevents runtime errors in location calculations, session handling, and bot commands. |
| **tsx** | Latest | TypeScript execution | 20-30x faster than ts-node (20ms vs 500ms compilation). Uses esbuild for near-instant execution. Execution-first approach with separate type validation. |

**Confidence:** HIGH - Verified with official Node.js releases and npm package data.

**Alternatives considered:**
- Python 3.10+ with python-telegram-bot v22.6: Excellent for ML/data pipelines, but Node.js is superior for real-time/async workloads.
- Node.js 22.x LTS: Also valid (supported until April 2028), but v24 has longer support window.
- ts-node: Mature but 20x slower than tsx. No reason to use in 2026.

---

### Telegram Bot Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Telegraf** | 4.16.3 | Telegram Bot API framework | Modern, TypeScript-native framework with intuitive command handling, middleware pattern, and session support. Includes types for complete Telegram API via typegram package. Supports both polling (dev) and webhooks (production). |

**Confidence:** HIGH - Official npm package, GitHub activity confirmed through January 2025.

**Why Telegraf:**
- **TypeScript-first:** Ships with declaration files for entire library
- **Middleware pattern:** Clean separation of concerns (auth, validation, business logic)
- **Session support:** Built-in session middleware perfect for tracking user state
- **Webhook & polling:** Seamless switch between dev (polling) and production (webhooks)
- **Active community:** 460+ dependent projects, maintained by Telegram community

**Alternatives considered:**
- grammY: Modern alternative, but Telegraf has larger ecosystem (460+ projects vs fewer for grammY)
- node-telegram-bot-api: Older, callback-based API. Not TypeScript-native.
- python-telegram-bot: Different language. Excellent library, but Node.js fits this use case better.

**Production deployment strategy:**
- **Development:** Use polling (bot.launch()) for local testing
- **Production:** Use webhooks with HTTPS endpoint for lower latency and better scaling
- **Rationale:** Webhooks eliminate continuous polling requests, reduce server load, and provide instant message delivery. Critical for real-time occupancy tracking.

---

### Database Layer

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **PostgreSQL** | 15.x or 16.x | Relational data persistence | Users, dogs, check-in history, occupancy logs. ACID guarantees for financial data (if needed). PostGIS extension available if spatial queries needed beyond Haversine. |
| **pg** | 8.17.1 | PostgreSQL client | Pure JavaScript, non-blocking client. 12,343+ projects use it. Supports pooling, prepared statements, streaming. Compatible with Node.js 18/20/22/24. Simple, fast, no ORM overhead. |
| **Redis** | 7.x | Session store with TTL | Active session tracking with auto-expiry. Native TTL support (SET key value EX seconds). In-memory speed for real-time occupancy counts. Atomic operations for concurrent check-ins. |
| **redis (node-redis)** | 5.10.0 | Redis client | Official Redis client for Node.js. Now recommended over ioredis for new projects (2026). Client-side caching support. Simple API for TTL operations. |

**Confidence:** HIGH - Verified with official PostgreSQL docs, npm package versions, and Redis documentation.

**Why pg over Prisma:**
- **Raw query performance:** Prisma is 2x slower than pg (4.35s vs 2.15s in benchmarks)
- **Simplicity for MVP:** Direct SQL control, no ORM learning curve
- **Lightweight:** Zero overhead for simple CRUD operations
- **Mature:** 12,343+ projects, proven production reliability

**Why not Prisma:**
- Prisma is excellent for type-safe queries and migrations in larger teams
- 2x performance penalty for raw queries is significant for real-time bot
- Overhead not justified for MVP with 3-4 tables (users, dogs, sessions, check_ins)
- Can migrate to Prisma later if type-safe migrations become priority

**Why redis (node-redis) over ioredis:**
- **Official recommendation:** Redis team now recommends node-redis for new projects (2026)
- **Feature parity:** Supports Redis Stack, hash-field expiration, new Redis 8 features
- **Actively maintained:** Open source (MIT), designed for future Redis capabilities
- **Performance:** Similar performance to ioredis for typical workloads
- **Simpler API:** Less feature bloat than ioredis

**Why not ioredis:**
- Previously recommended, now deprecated in favor of node-redis
- Still has more downloads (9.9M vs 6.3M weekly), but node-redis is officially supported
- Advanced features (clustering, auto-reconnect) not needed for MVP
- Node-redis provides all required TTL and session functionality

---

### Geofencing & Location

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **geolib** | 3.3.4 | Geospatial calculations | Haversine distance, point-in-polygon, coordinate conversions. TypeScript-based. 226,772 weekly downloads vs 29,739 for haversine-distance. More comprehensive than single-purpose haversine libs. |

**Confidence:** MEDIUM - Based on npm popularity data and package features. Haversine formula is well-established (HIGH confidence in algorithm).

**Why geolib:**
- **Comprehensive:** Not just Haversine - includes point-in-polygon, bounding boxes, coordinate conversions
- **TypeScript-native:** Ships with TypeScript definitions
- **Popular:** 7.6x more downloads than standalone haversine-distance
- **Future-proof:** If geofencing needs expand beyond simple radius checks, geolib handles it
- **Well-maintained:** 445+ projects depend on it

**Haversine formula specifics:**
- Calculates great-circle distance between two points on sphere
- Provides high accuracy for short-to-medium distances (perfect for 200m threshold)
- Formula: a = sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)
- Result: c = 2 * atan2(√a, √(1−a)), distance = R * c (R = Earth radius)

**Alternatives considered:**
- haversine (npm): Simple, but single-purpose. No extras like polygon checks.
- haversine-distance: Popular but less feature-complete than geolib.
- PostGIS (PostgreSQL extension): Overkill for simple 200m radius checks. Adds DB complexity for MVP.

**When to use PostGIS:**
- If complex spatial queries needed (overlapping geofences, nearest dog park, etc.)
- If geofence shapes become non-circular (polygons, complex boundaries)
- For MVP with simple radius checks, geolib is sufficient

---

### Configuration & Environment

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Native .env** | Node.js 20.6.0+ | Environment variables | Node.js native --env-file flag eliminates dotenv dependency. Simpler, zero dependencies, built-in support. |
| **dotenv** | 16.x (fallback) | Legacy env loading | Only if supporting Node.js < 20.6.0. Otherwise, use native --env-file. |

**Confidence:** HIGH - Official Node.js documentation.

**Rationale:**
- Node.js 24.x (recommended) includes native .env support via --env-file flag
- Eliminates 45M+ download dependency (dotenv) for zero benefit
- Production: Use proper secrets management (not .env files) for sensitive data
- Development: `node --env-file=.env index.js` replaces `dotenv.config()`

**Security note:**
- **Never commit .env files to Git** (add to .gitignore)
- **Use .env.example** with placeholder values for team reference
- **Production:** Inject secrets via platform (Railway, Render, Docker secrets) not .env files

---

### Development Tooling

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Vitest** | Latest | Testing framework | 10-20x faster than Jest on large codebases. Browser-native design, Vite integration. Native ESM support. Modern choice for 2026. |
| **telegram-test-api** | Latest | Bot testing | Mock Telegram API server for offline bot testing. Captures payloads, allows assertions without hitting real Telegram servers. |
| **pino** | Latest | Structured logging | 5x faster than Winston. JSON-structured logs. Minimal overhead for high-throughput bots. Native OpenTelemetry support. |
| **ESLint** | 9.x | Linting | Standard TypeScript linting. |
| **Prettier** | Latest | Code formatting | Consistent formatting across team. |

**Confidence:** HIGH - Verified with performance benchmarks and community adoption data.

**Why Vitest over Jest:**
- **Performance:** 10-20x faster due to Vite integration and browser-native design
- **Modern:** Built for ESM, native TypeScript support
- **2026 standard:** Jest 30 exists, but Vitest momentum is clear
- **Compatible API:** Similar to Jest, easy migration

**Why Pino over Winston:**
- **Performance:** 5x faster, critical for high-throughput bot logging
- **Structured:** JSON logs, easy parsing for monitoring tools
- **Minimal overhead:** Asynchronous by default, won't block bot responses
- **Winston use case:** Only if you need complex log routing (file + console + HTTP simultaneously)

**Testing strategy:**
- **Unit tests:** Test geofencing logic (Haversine), session expiry, command parsing
- **Integration tests:** Use telegram-test-api to mock bot interactions
- **E2E tests:** Optional for MVP, test against real Telegram test bot

---

### Session Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **connect-redis** | Latest | Express session store (if using Express) | Integrates Express sessions with Redis. TTL support via expires date or ttl option (default 86400s). |
| **telegraf-session-redis** | Latest (if exists) or custom | Telegraf session store | Direct Redis integration for Telegraf session middleware. Custom implementation simple with node-redis. |

**Confidence:** MEDIUM - Telegraf has built-in session middleware, Redis integration may require custom adapter.

**Implementation approach:**
1. **Telegraf built-in session:** Stores in-memory (fine for dev)
2. **Production:** Custom Redis session store using node-redis
3. **TTL management:** Use Redis SET with EX flag for auto-expiry
4. **Example:** `await redis.set(`session:${chatId}`, JSON.stringify(data), { EX: 1800 })` (30min TTL)

**Session reset pattern:**
- On user interaction, extend TTL: `await redis.expire(`session:${sessionId}`, 1800)`
- Ensures active users stay checked in, inactive users auto-expire

---

### Deployment & Infrastructure

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Docker** | Latest | Containerization | Standard deployment packaging. Multi-arch support (amd64/arm64). Easy dependency management. |
| **Docker Compose** | Latest | Local orchestration | Manage bot + PostgreSQL + Redis containers locally. Avoid manual container management. |
| **Railway / Render** | N/A | Hosting platform | Free tier available. Built-in PostgreSQL & Redis. HTTPS endpoints for webhooks. Environment variable management. |
| **GitHub Actions** | N/A | CI/CD | Build Docker images, run tests, auto-deploy on push to main. Versioning, changelogs, multi-arch builds. |

**Confidence:** HIGH - Standard 2026 deployment practices.

**Deployment strategy:**
1. **Development:** docker-compose up (bot + postgres + redis locally)
2. **Production:** Railway/Render with managed PostgreSQL & Redis
3. **CI/CD:** GitHub Actions builds Docker image, pushes to registry, deploys on push
4. **Webhooks:** Platform provides HTTPS URL, configure with Telegram setWebhook

**Why Railway/Render:**
- Free tier sufficient for MVP (developer + friends)
- Managed databases (no ops overhead)
- Automatic HTTPS for webhooks
- Simple environment variable management

**Docker best practices:**
- Multi-stage builds (dependencies + app layers)
- Multi-arch support (amd64 + arm64)
- Healthcheck endpoint for container orchestration
- Mounted volumes for persistent data (if needed)

---

## Anti-Stack (What NOT to Use)

| Technology | Why Avoid | Use Instead |
|------------|-----------|-------------|
| **dotenv** | Node.js 20.6+ has native --env-file support. Zero benefit, 45M download dependency. | Native --env-file flag |
| **ts-node** | 20x slower than tsx (500ms vs 20ms). No advantage in 2026. | tsx |
| **Prisma** | 2x slower than pg for raw queries. ORM overhead not justified for 3-4 table MVP. | pg (raw SQL) |
| **ioredis** | Deprecated by Redis team for new projects. node-redis is official client. | redis (node-redis) |
| **Jest** | 10-20x slower than Vitest. Legacy choice. | Vitest |
| **Winston** | 5x slower than Pino. Complex config overhead for simple logging needs. | Pino |
| **Long polling in production** | High server load, increased latency. Continuous requests to Telegram servers. | Webhooks (HTTPS) |
| **In-memory sessions (production)** | Lost on restart. No sharing across instances. No TTL expiry. | Redis with TTL |
| **Serverless (MVP)** | Adds cold start latency. Webhook complexity. Better for established bots. | Container-based (Railway/Render) |

---

## Installation

### Initial Setup

```bash
# Create project
mkdir pawpals-sg
cd pawpals-sg
npm init -y

# Install core dependencies
npm install telegraf pg redis geolib pino

# Install dev dependencies
npm install -D typescript tsx @types/node vitest eslint prettier

# Initialize TypeScript
npx tsc --init
```

### TypeScript Configuration (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Package.json Scripts

```json
{
  "scripts": {
    "dev": "NODE_ENV=development tsx --watch src/index.ts",
    "start": "node --env-file=.env dist/index.js",
    "build": "tsc",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write 'src/**/*.ts'"
  }
}
```

### Docker Compose (Local Development)

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: pawpals
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --save 60 1 --loglevel warning
    volumes:
      - redis_data:/data

  bot:
    build: .
    depends_on:
      - postgres
      - redis
    environment:
      BOT_TOKEN: ${BOT_TOKEN}
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/pawpals
      REDIS_URL: redis://redis:6379
    volumes:
      - ./src:/app/src

volumes:
  postgres_data:
  redis_data:
```

---

## Dependency Tree

```
Core Runtime
├── Node.js 24.x LTS
├── TypeScript 5.x
└── tsx (execution)

Bot Framework
└── Telegraf 4.16.3
    └── typegram (types)

Database
├── PostgreSQL 15/16
│   └── pg 8.17.1
└── Redis 7.x
    └── redis 5.10.0

Geofencing
└── geolib 3.3.4

Utilities
├── pino (logging)
└── Native .env (config)

Development
├── Vitest (testing)
├── telegram-test-api (bot mocking)
├── ESLint (linting)
└── Prettier (formatting)

Deployment
├── Docker + Docker Compose
└── GitHub Actions (CI/CD)
```

---

## Version Pinning Strategy

For production stability, pin major and minor versions, allow patch updates:

```json
{
  "dependencies": {
    "telegraf": "^4.16.3",
    "pg": "^8.17.1",
    "redis": "^5.10.0",
    "geolib": "^3.3.4",
    "pino": "^9.0.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "tsx": "^4.19.0",
    "vitest": "^3.0.0"
  }
}
```

**Rationale:**
- `^` allows patch updates (4.16.3 → 4.16.4) but not minor (4.16 → 4.17)
- Security patches applied automatically
- Breaking changes avoided
- Review dependency updates quarterly

---

## Migration Path (Future Considerations)

As project matures beyond MVP:

1. **Prisma adoption:** If team grows and type-safe migrations become priority
   - Trade performance for DX
   - Migrate incrementally (pg → Prisma over 2-3 sprints)

2. **PostGIS spatial queries:** If geofencing becomes complex (non-circular zones)
   - Add PostGIS extension to PostgreSQL
   - Migrate Haversine logic to ST_DWithin queries

3. **Serverless migration:** If bot scales to 10K+ users
   - Evaluate cold start impact
   - Consider AWS Lambda or Cloudflare Workers
   - Requires webhook architecture (already implemented)

4. **Monitoring & observability:** Post-MVP
   - Prometheus metrics for occupancy counts
   - Grafana dashboards for real-time usage
   - Sentry for error tracking

---

## Confidence Assessment

| Category | Level | Reason |
|----------|-------|--------|
| **Runtime (Node.js/TypeScript)** | HIGH | Official LTS releases verified. Node.js 24.x is current production standard. |
| **Bot Framework (Telegraf)** | HIGH | npm package versions confirmed. Active GitHub maintenance through Jan 2025. |
| **Database (pg, redis)** | HIGH | Official client libraries. Version numbers verified via npm. Mature, production-proven. |
| **Geofencing (geolib)** | MEDIUM | Popularity data from npm trends. Haversine formula itself is HIGH confidence (mathematical constant). Library choice based on features + downloads. |
| **Development Tools** | HIGH | Performance benchmarks published (Vitest vs Jest, Pino vs Winston). Industry trends clear. |
| **Deployment (Docker/Railway)** | HIGH | Standard 2026 practices. Docker + managed platforms are proven MVP strategy. |

---

## Sources

### Official Documentation & Packages
- [Node.js Releases](https://nodejs.org/en/about/previous-releases) - LTS version information
- [Telegraf GitHub](https://github.com/telegraf/telegraf) - Bot framework
- [python-telegram-bot PyPI](https://pypi.org/project/python-telegram-bot/) - Python alternative (v22.6)
- [pg npm](https://www.npmjs.com/package/pg) - PostgreSQL client (v8.17.1)
- [redis npm](https://www.npmjs.com/package/redis) - Redis client (v5.10.0)
- [Node Redis Guide](https://redis.io/docs/latest/develop/clients/nodejs/) - Official Redis documentation

### Framework Comparisons & Best Practices
- [A Developer's Guide to Building Telegram Bots in 2025](https://stellaray777.medium.com/a-developers-guide-to-building-telegram-bots-in-2025-dbc34cd22337) - Telegraf vs alternatives
- [Bot API Library Examples](https://core.telegram.org/bots/samples) - Official Telegram examples
- [Polling vs Webhook in Telegram Bots](https://hostman.com/tutorials/difference-between-polling-and-webhook-in-telegram-bots/) - Deployment strategies
- [Long Polling vs. Webhooks | grammY](https://grammy.dev/guide/deployment-types) - Production recommendations

### Performance & Tooling
- [TSX vs ts-node: The Definitive Comparison](https://betterstack.com/community/guides/scaling-nodejs/tsx-vs-ts-node/) - TypeScript execution
- [Pino vs Winston: Which Logger Should You Choose?](https://betterstack.com/community/comparisons/pino-vs-winston/) - Logging libraries
- [Vitest vs Jest 30: Why 2026 is the Year of Browser-Native Testing](https://dev.to/dataformathub/vitest-vs-jest-30-why-2026-is-the-year-of-browser-native-testing-2fgb) - Testing frameworks
- [Should You Still Use dotenv in 2025?](https://infisical.com/blog/stop-using-dotenv-in-nodejs-v20.6.0+) - Environment variables

### Database & Redis
- [ioredis vs redis | npm comparison](https://npm-compare.com/ioredis,redis) - Redis client comparison
- [Migrate from ioredis](https://redis.io/docs/latest/develop/clients/nodejs/migration/) - Official migration guide
- [Session Management with Redis](https://medium.com/@20011002nimeth/session-management-with-redis-a21d43ac7d5a) - TTL strategies
- [PostgreSQL Node.js client pg vs Prisma](https://github.com/prisma/prisma/issues/23573) - Performance benchmarks

### Geofencing & Location
- [geolib npm](https://www.npmjs.com/package/geolib) - Geospatial library
- [geolib vs haversine npm trends](https://npmtrends.com/geolib-vs-haversine-distance-vs-haversine-js) - Popularity comparison
- [How to Implement Geofencing: A Complete Guide](https://medium.com/@adetifaboluwatife/how-to-implement-geofencing-a-complete-guide-with-geo-toolkits-d66aec381b08) - Implementation patterns

### Deployment
- [How to Dockerize a Telegram Bot](https://tjtanjin.medium.com/how-to-dockerize-a-telegram-bot-a-step-by-step-guide-b14bc427f5dc) - Docker best practices
- [Automating Telegram Bot Deployment with GitHub Actions](https://tjtanjin.medium.com/automating-telegram-bot-deployment-with-github-actions-and-docker-482abcd2533e) - CI/CD pipeline

---

## Summary for Roadmap

**Recommended stack:** Node.js 24.x + TypeScript + Telegraf + PostgreSQL (pg) + Redis (node-redis) + geolib

**Phase implications:**
1. **Phase 1 (Setup):** Node.js + Telegraf + Docker Compose for local dev
2. **Phase 2 (Database):** PostgreSQL + pg for users/dogs, Redis for sessions
3. **Phase 3 (Geofencing):** geolib for Haversine calculations, 200m threshold logic
4. **Phase 4 (Sessions):** Redis TTL for auto-expiry, session extension on interaction
5. **Phase 5 (Deployment):** Docker + Railway/Render + webhooks for production

**No deep research flags:** Stack is well-established. Haversine formula is standard. Redis TTL is native feature. All technologies are production-proven.

**Open questions:**
- Exact PostgreSQL schema (defer to database phase research)
- Session expiry duration (30min? 1hr? 2hr?) - business decision, not technical
- Webhook URL provider (Railway vs Render vs DigitalOcean) - minor, all work
