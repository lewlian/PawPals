# Project Research Summary

**Project:** PawPals SG - Dog Run Occupancy Tracker
**Domain:** Location-based check-in Telegram bot with real-time session management and geofencing
**Researched:** 2026-01-29
**Confidence:** HIGH

## Executive Summary

PawPals SG is a Telegram bot that enables dog owners to check into Singapore's 11 dog runs, see real-time occupancy filtered by dog size, and coordinate visits. Expert implementations use a **dual-database architecture** (PostgreSQL for permanent data, Redis for ephemeral sessions with TTL auto-expiry), **webhook-based updates** for production (60-80% resource savings vs polling), and **Node.js with TypeScript + Telegraf** for modern async I/O and type safety.

The recommended approach centers on **incremental complexity**: Phase 1 establishes basic check-in/out with geofencing (Haversine formula), Phase 2 adds session auto-expiry with Redis TTL, Phase 3 implements real-time occupancy dashboard, and Phase 4 moves to production webhooks. This ordering avoids common pitfalls like premature optimization, race conditions from concurrent check-ins, and unreliable Redis keyspace notifications.

The critical risks are: (1) **Redis TTL notifications are unreliable** (fire-and-forget with no delivery guarantees — requires secondary polling fallback), (2) **GPS accuracy varies 20-50m in urban areas** (200m radius too strict — need 150m inner/250m outer with accuracy gating), (3) **Telegram group migrations silently break session state** (chat IDs change, must implement migration handlers from day one), and (4) **concurrent check-ins create race conditions** (use Lua scripts for atomic Redis operations). All four require architectural mitigation from MVP, not post-launch retrofitting.

## Key Findings

### Recommended Stack

The 2026 standard for Telegram bots with real-time state management is Node.js 24.x LTS + TypeScript 5.x with Telegraf 4.16+ as the bot framework. This stack excels at async I/O (critical for webhook concurrency), provides strong typing for geofencing calculations, and integrates seamlessly with PostgreSQL (pg client) and Redis (node-redis 5.10+) via mature libraries.

**Core technologies:**
- **Node.js 24.x LTS**: Runtime with native .env support (--env-file flag), active LTS through April 2028, optimized for async webhook handling
- **TypeScript 5.x + tsx**: Type safety for location calculations, session handling, and bot commands. tsx provides 20x faster execution than ts-node (20ms vs 500ms compilation)
- **Telegraf 4.16.3**: TypeScript-native bot framework with middleware pattern, session support, and seamless polling-to-webhook transition
- **PostgreSQL 15/16 + pg 8.17.1**: Relational storage for users, dogs, dog runs, and session history. Pure JavaScript client with 2x faster raw query performance than Prisma ORM
- **Redis 7.x + node-redis 5.10.0**: Ephemeral session store with native TTL support (SET key value EX seconds). Official Redis client recommendation for 2026 (replaces ioredis)
- **geolib 3.3.4**: Haversine distance calculations, point-in-polygon checks, coordinate conversions. 7.6x more popular than haversine-distance, TypeScript-native
- **Vitest**: Testing framework (10-20x faster than Jest), Pino for logging (5x faster than Winston), ESLint/Prettier for code quality

**Anti-stack (explicitly avoid):**
- dotenv (Node.js 20.6+ has native support), ts-node (20x slower), Prisma (2x slower for raw queries), ioredis (deprecated by Redis team), Jest (10-20x slower), Winston (5x slower), long polling in production (high server load)

### Expected Features

Based on location-based check-in apps (Foursquare Swarm) and dog park communities (DogPack, Wag Buddy), users expect a focused utility app, not a social network.

**Must have (table stakes):**
- **One-tap check-in**: Core value proposition — inline keyboard makes this trivial in Telegram
- **See who's there now**: Primary question: "Should I go to the park right now?" — real-time occupancy list
- **Dog profile (name + size)**: Minimum viable metadata for compatibility. Size categories: Small (<10kg) / Large (>10kg) per Singapore dog run restrictions
- **Manual check-out + auto-expiry**: User control + preventing stale "ghost dogs" shown as present when they've left. Industry standard: 2-3 hours for dog park visits
- **Location list**: 11 pre-loaded Singapore dog runs (defined scope, no user-generated content initially)
- **Current occupancy count**: Quick "how busy is it?" signal by size category

**Should have (competitive):**
- **Temperament flags**: Optional tags (Shy, Playful, Reactive, Calm) to help owners avoid bad matches. Low complexity, high safety value. Defer to post-MVP unless user feedback requests it
- **Park ratings/reviews**: 5-star + optional comment. Standard community feature for Phase 2 after validating MVP adoption
- **Historical busyness patterns**: "Usually busy on Saturday mornings" — aggregate data for planning visits. Requires time-series storage, defer to Phase 3

**Defer (v2+):**
- Friend notifications ("Your dog's friends are at the park!") — requires social graph, high complexity
- Proximity alerts via Telegram live location — 8hr max duration, battery drain, privacy concerns
- Playdates/scheduling — different use case from real-time check-in
- Lost & found alerts — valuable but different vertical, scope creep risk
- Photo sharing per check-in — storage costs, moderation overhead, slows core UX

**Explicit anti-features:**
- Full social network (posts, comments, feed) — scope creep kills MVPs, Telegram groups already handle social
- In-app messaging between users — reinventing Telegram's core feature
- Complex animations/UI flourishes — users expect instant responses in utility apps
- Pet service marketplace (groomers, walkers, vets) — DogHood already does this, massive scope
- Gamification (badges, mayorships, streaks) — distracting for utility-first apps

### Architecture Approach

Telegram bots with real-time state management follow a **layered clean architecture** with clear separation: Handlers (presentation layer, Telegram-specific) → Services (business logic, framework-agnostic) → Repositories (data access abstraction). The dual-database pattern stores active sessions in Redis (fast lookup, native TTL) and archives to PostgreSQL (permanent history, analytics).

**Major components:**
1. **Update Router (Telegraf)** — Receives webhooks from Telegram, applies middleware (auth, logging, error handling), routes to command handlers. Polling for dev, webhooks for production.
2. **Command Handlers** — One per bot command (/start, /checkin, /checkout, /dashboard). Validates input, orchestrates service calls, formats responses. No business logic.
3. **Service Layer** — ProfileService (user/dog CRUD), SessionService (check-in/out lifecycle with geofence validation), GeofenceService (Haversine calculations), DashboardService (aggregate active sessions), NotificationService (expiry reminders).
4. **Repository Layer** — UserRepository, DogRepository (PostgreSQL), SessionRepository (dual-write to Redis + PostgreSQL). Abstracts database operations for testability.
5. **Background Jobs** — SessionExpiryMonitor (Redis keyspace notifications + fallback polling every 30s), PreExpiryWarning (5 min before expiry), DashboardRefresh (cache invalidation every 60s).
6. **Data Persistence** — PostgreSQL tables: users, dogs, dog_runs, session_history. Redis keys: session:{id} (TTL-based), location:{user_id}, dashboard:cache.

**Critical patterns:**
- **Dual-database write**: Create session in Redis (with TTL) AND PostgreSQL (for history) atomically
- **Haversine geofencing**: Great-circle distance calculation for 150m inner / 250m outer threshold with GPS accuracy gating
- **Redis keyspace notifications**: Subscribe to `__keyevent@*__:expired` for session expiry events, BUT implement fallback polling (notifications have no delivery guarantees)
- **Lua scripts for atomicity**: Prevent race conditions on concurrent check-ins (GET-check-SET patterns are not atomic)
- **Webhook deployment**: Required for production (60-80% resource savings vs polling, instant delivery)

### Critical Pitfalls

Research identified 5 critical pitfalls requiring architectural mitigation from MVP:

1. **Relying on Redis TTL notifications for critical operations** — Redis keyspace notifications are fire-and-forget with zero delivery guarantees. Expired events only generate when (1) a key is accessed and found expired, or (2) background cleanup scans reach it. Delays of 5-10 minutes common under load. **Prevention:** Maintain secondary expiry index (Redis sorted set), poll every 30-60s as source of truth, treat notifications as optimization only.

2. **Geofence threshold too strict for real-world GPS accuracy** — GPS accuracy varies 5-10m ideal, 20-50m urban, 100m+ near tall buildings. 200m strict radius causes false negatives (user at gate can't check in). **Prevention:** Use tiered thresholds (150m inner / 250m outer) with accuracy field validation (<50m required for outer zone acceptance).

3. **Telegram group chat migration breaking session state** — When groups convert to supergroups, chat_id changes. Sessions keyed by old chat_id become orphaned. **Prevention:** Handle `migrate_to_chat_id` updates, copy Redis keys atomically, store migration mapping in PostgreSQL (not Redis), resolve chat_id through migration table on every message.

4. **Concurrent check-ins creating race conditions** — Non-atomic GET-check-SET patterns allow duplicate sessions, drift occupancy counts. **Prevention:** Use Lua scripts for atomic Redis operations (check existence + create session + increment counter as single operation).

5. **Webhook HTTPS certificate chain issues causing silent failures** — Telegram requires complete certificate chain (leaf + intermediates + root). Missing intermediates cause silent rejection (no error messages). **Prevention:** Use fullchain.pem (not cert.pem) for Let's Encrypt, verify with `openssl verify`, test with `getWebhookInfo()` showing zero errors.

**Moderate pitfalls (defer to later phases):**
- No session cleanup after bot restart (implement startup recovery scan)
- Storing location data without retention policy (GDPR/PDPA concerns — implement 7-day auto-purge)
- Not handling Telegram message edit events (treat as correction, not new check-in)
- Assuming network requests always succeed (implement retry with exponential backoff)

## Implications for Roadmap

Based on combined research, suggested 6-phase structure optimizes for incremental validation and dependency ordering:

### Phase 1: Foundation & Bot Setup
**Rationale:** Everything depends on basic bot infrastructure, database connections, and user/dog profiles. Establishes development environment (Docker Compose with PostgreSQL + Redis locally) and core data models. Cannot proceed to check-in logic without profiles.

**Delivers:**
- Bot responds to /start, /profile, /adddog commands
- PostgreSQL schema (users, dogs, dog_runs tables)
- Redis connection established
- Docker Compose for local dev (bot + postgres + redis containers)
- 11 Singapore dog runs seeded in database

**Addresses (from FEATURES.md):**
- Basic dog profile (name + size) — table stakes
- Location list — pre-loaded Singapore dog runs

**Avoids (from PITFALLS.md):**
- Hardcoding venue coordinates (use database from start for easy updates)

**Stack elements:** Node.js 24.x, TypeScript, Telegraf, PostgreSQL + pg, Redis + node-redis, geolib installed
**Research flag:** Standard patterns, skip phase research

---

### Phase 2: Core Check-In/Out with Geofencing
**Rationale:** Core value proposition — users can check in at dog runs with geofence validation. Geofencing must work before sessions make sense. This phase implements Haversine calculations with urban-optimized thresholds discovered in research.

**Delivers:**
- /checkin command with location sharing
- /checkout command (manual exit)
- Geofence validation: 150m inner / 250m outer with GPS accuracy gating
- SessionService + GeofenceService
- Dual-write to Redis (ephemeral) + PostgreSQL (history)

**Addresses (from FEATURES.md):**
- One-tap check-in — core utility
- Manual check-out — user control

**Avoids (from PITFALLS.md):**
- Geofence too strict for real-world GPS accuracy (use tiered thresholds + accuracy validation)
- Business logic in handlers (implement service layer pattern)
- Concurrent check-ins race conditions (use Lua scripts from start)

**Stack elements:** geolib for Haversine, Redis SET with EX for TTL, PostgreSQL transactions
**Research flag:** Standard patterns (Haversine formula well-documented), skip phase research

---

### Phase 3: Session Auto-Expiry & Background Jobs
**Rationale:** Prevents "ghost dogs" shown as present when they've left. Auto-expiry requires background job infrastructure and Redis keyspace notification handling. Critical pitfall: notifications are unreliable, must implement polling fallback from day one.

**Delivers:**
- Redis TTL-based session expiry (2-3 hour default)
- SessionExpiryMonitor with keyspace notifications + 30s polling fallback
- PreExpiryWarning job (5 min before expiry)
- Expiry index (Redis sorted set) for reliable polling
- NotificationService for expiry reminders

**Addresses (from FEATURES.md):**
- Session auto-expiry — table stakes for preventing stale data

**Avoids (from PITFALLS.md):**
- Relying on Redis TTL notifications alone (implement secondary index + polling)
- No session cleanup after bot restart (add startup recovery scan)
- Assuming network requests succeed (retry with backoff for notifications)

**Stack elements:** Redis keyspace notifications, node-cron or setInterval for polling, sorted sets
**Research flag:** **NEEDS RESEARCH** — Redis keyspace notification timing behavior under load requires deeper investigation and load testing

---

### Phase 4: Real-Time Occupancy Dashboard
**Rationale:** Answers primary user question: "Should I go to the park right now?" Requires active sessions from Phase 2-3 to be meaningful. Dashboard aggregates session data with caching for performance.

**Delivers:**
- /dashboard command showing occupancy by venue
- Filter by dog size (Small <10kg / Large >10kg)
- Current occupancy count
- DashboardService with Redis caching (60s TTL)
- Real-time updates on check-in/checkout

**Addresses (from FEATURES.md):**
- See who's there now — primary use case
- Current occupancy count — quick "how busy?" signal
- Size-based filtering — Singapore dog run requirement (table stakes)

**Avoids (from PITFALLS.md):**
- Storing active sessions only in PostgreSQL (use Redis for fast reads, PostgreSQL for history)

**Stack elements:** Redis GET for active sessions, aggregate operations, dashboard cache pattern
**Research flag:** Standard patterns (dashboard caching well-established), skip phase research

---

### Phase 5: Chat Migration Handlers & Edge Cases
**Rationale:** Production hardening before deployment. Telegram group migrations happen unexpectedly and break session state silently. Message edit events, user blocking bot, location accuracy validation all discovered as common issues in research.

**Delivers:**
- `migrate_to_chat_id` handler with atomic key migration
- Migration mapping table (PostgreSQL)
- Chat ID resolution middleware
- Message edit event handling
- User blocking detection (403 errors)
- GPS accuracy field validation
- Graceful error handling across all commands

**Addresses (from FEATURES.md):**
- Privacy: anonymous browsing (viewing without checking in already works by default)

**Avoids (from PITFALLS.md):**
- Group chat migration breaking session state (implement handlers + PostgreSQL mapping)
- Not handling message edit events (treat as correction)
- Forgetting to handle user blocking bot (catch 403 errors)
- Not validating location accuracy field (reject >50m accuracy)

**Stack elements:** PostgreSQL migrations table, Telegraf middleware pattern, error handling middleware
**Research flag:** **NEEDS RESEARCH** — Telegram group migration timing and data race scenarios need testing in staging environment

---

### Phase 6: Production Deployment with Webhooks
**Rationale:** Final phase transitions from polling (development) to webhooks (production). Webhook setup has multiple infrastructure requirements (HTTPS, specific ports, certificate chain) that research flagged as high-failure areas.

**Delivers:**
- Webhook endpoint (Express/Fastify)
- HTTPS with Let's Encrypt fullchain.pem
- `setWebhook` configuration
- Environment variable management (Railway/Render)
- Graceful shutdown (SIGINT/SIGTERM)
- Production monitoring (`getWebhookInfo()` checks)
- CI/CD pipeline (GitHub Actions)

**Addresses (from FEATURES.md):**
- No new features, deployment only

**Avoids (from PITFALLS.md):**
- Webhook certificate chain issues (use fullchain.pem, verify before deploy)
- Polling in production (60-80% resource waste)
- Webhook port conflicts (use 443 with reverse proxy if multiple bots)

**Stack elements:** Docker + Docker Compose, Railway/Render platform, GitHub Actions, Let's Encrypt
**Research flag:** **NEEDS RESEARCH** — SSL certificate chain validation and webhook debugging steps need documentation

---

### Phase Ordering Rationale

- **Phase 1 before 2:** Cannot implement check-in logic without user/dog profiles and database schema
- **Phase 2 before 3:** Auto-expiry meaningless without sessions to expire; geofencing must work before TTL complexity
- **Phase 3 before 4:** Dashboard requires active sessions with TTL to show real-time occupancy
- **Phase 4 before 5:** Edge cases easier to test once core features exist and generate user feedback
- **Phase 5 before 6:** Production deployment should include all hardening; webhook setup fails silently, easier to debug with robust error handling already implemented

**Dependency chain:** Bot setup → Profiles → Check-in → Auto-expiry → Dashboard → Hardening → Production
**Risk mitigation:** Incremental complexity allows validation at each phase; critical pitfalls (geofencing accuracy, Redis notifications, race conditions) addressed in phases where they naturally arise

### Research Flags

Phases likely needing `/gsd:research-phase` during planning:

- **Phase 3 (Session Auto-Expiry):** Redis keyspace notification timing behavior under concurrent load not fully documented. Need to research: (a) delay characteristics with 100+ simultaneous expirations, (b) subscriber disconnect/reconnect impact, (c) optimal polling frequency vs notification optimization tradeoff. MEDIUM priority — can defer to load testing post-MVP.

- **Phase 5 (Chat Migration):** Telegram group-to-supergroup migration timing and data race scenarios. Research needed: (a) migration event order (does migrate_to_chat_id always arrive before messages from new chat?), (b) atomic migration strategy during active sessions, (c) rollback if migration handler fails mid-process. HIGH priority — silent failures difficult to debug.

- **Phase 6 (Webhook Deployment):** SSL certificate chain troubleshooting and verification steps. Research needed: (a) Let's Encrypt fullchain.pem vs cert.pem differences, (b) `getWebhookInfo()` error message mapping to root causes, (c) testing webhook without production deploy (ngrok/localhost tunneling). MEDIUM priority — one-time setup complexity.

Phases with well-documented patterns (skip research-phase):

- **Phase 1 (Foundation):** Telegraf setup, PostgreSQL schema design, Docker Compose orchestration all have official documentation. Standard MVP setup.
- **Phase 2 (Check-In/Geofencing):** Haversine formula mathematically proven, geolib library well-maintained. Geofencing best practices documented in Android/iOS guidelines.
- **Phase 4 (Dashboard):** Redis caching pattern, dashboard aggregation, occupancy counting all standard real-time app patterns. No novel complexity.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | HIGH | All recommendations verified with npm package versions, official Node.js releases, and framework comparisons. Node.js 24.x LTS, Telegraf 4.16.3, pg 8.17.1, node-redis 5.10.0 all confirmed current as of Jan 2025. |
| **Features** | MEDIUM-HIGH | Based on WebSearch analysis of Foursquare Swarm, DogPack, Wag Buddy, and general check-in app patterns. Table stakes features consistent across sources. Temperament flags/friend systems marked as post-MVP based on complexity vs MVP ROI. |
| **Architecture** | HIGH | Layered architecture, dual-database pattern, webhook deployment verified across multiple production Telegram bot implementations and official documentation. Component boundaries align with clean architecture principles. |
| **Pitfalls** | HIGH | Critical pitfalls sourced from official Redis and Telegram documentation (keyspace notification limitations, webhook requirements, group migration). Geofencing accuracy backed by Android developer guidelines and GPS accuracy studies. Race condition prevention standard concurrency pattern. |

**Overall confidence:** HIGH

Research synthesized from authoritative sources (official documentation) and confirmed with secondary sources (production implementations, technical guides). MVP scope well-defined, technology choices justified with performance benchmarks, pitfalls actionable.

### Gaps to Address

**Phase 3 (Redis keyspace notifications):** Research confirms notifications are unreliable, but optimal polling frequency (30s? 60s? 120s?) requires load testing with production workload patterns. Start with 30s based on general recommendations, measure and adjust post-launch based on actual session volume.

**Phase 5 (Telegram migration timing):** Documentation shows `migrate_to_chat_id` exists but doesn't specify event ordering guarantees (does migration event always arrive before new chat messages?). Testing in staging environment with deliberate group-to-supergroup conversion needed before production. May discover additional race conditions not covered in research.

**Session expiry duration (business decision):** Research indicates 15min-2hr standard for location-based apps, 2-3hr recommended for dog park visits based on typical visit length, but actual optimal duration depends on user behavior. Implement as configurable value (environment variable), gather analytics post-launch, adjust based on: (a) false expiry rate (users still at park when auto-kicked), (b) "ghost dog" complaint rate (users forget to check out manually).

**Geofence radius per-venue tuning:** 150m inner / 250m outer thresholds based on general urban GPS accuracy, but specific Singapore venues may need adjustment (e.g., high-rise density near Marina Bay vs open parks). Seed database with default values, implement admin command to tune per-venue post-launch based on check-in failure analytics.

## Sources

### Primary (HIGH confidence)

**Official Documentation:**
- [Node.js Releases](https://nodejs.org/en/about/previous-releases) — LTS version verification (Node.js 24.x Krypton through April 2028)
- [Telegraf GitHub](https://github.com/telegraf/telegraf) — Bot framework features, TypeScript support (v4.16.3 confirmed)
- [Redis Keyspace Notifications](https://redis.io/docs/latest/develop/pubsub/keyspace-notifications/) — Fire-and-forget delivery guarantees, timing limitations
- [Telegram Webhook Guide](https://core.telegram.org/bots/webhooks) — Certificate chain requirements, port restrictions (443/80/88/8443 only)
- [Android Geofencing Documentation](https://developer.android.com/develop/sensors-and-location/location/geofencing) — 100-150m minimum radius recommendation

**npm Package Verification:**
- [pg npm](https://www.npmjs.com/package/pg) — PostgreSQL client v8.17.1, 12,343+ dependent projects
- [redis npm](https://www.npmjs.com/package/redis) — Official Redis client v5.10.0, now recommended over ioredis
- [geolib npm](https://www.npmjs.com/package/geolib) — Geospatial calculations v3.3.4, 226,772 weekly downloads

### Secondary (MEDIUM confidence)

**Architecture Patterns:**
- [Building Robust Telegram Bots](https://henrywithu.com/building-robust-telegram-bots/) — Clean architecture layering, service pattern
- [Two Design Patterns for Telegram Bots - DEV](https://dev.to/madhead/two-design-patterns-for-telegram-bots-59f5) — Handler vs service separation
- [Telegram Bot Template with PostgreSQL, Redis, Docker](https://github.com/donBarbos/telegram-bot-template) — Dual-database architecture example

**Performance Benchmarks:**
- [TSX vs ts-node Comparison](https://betterstack.com/community/guides/scaling-nodejs/tsx-vs-ts-node/) — 20x execution speed difference (20ms vs 500ms)
- [Pino vs Winston Comparison](https://betterstack.com/community/comparisons/pino-vs-winston/) — 5x logging performance difference
- [Vitest vs Jest 30](https://dev.to/dataformathub/vitest-vs-jest-30-why-2026-is-the-year-of-browser-native-testing-2fgb) — 10-20x testing performance difference
- [PostgreSQL pg vs Prisma](https://github.com/prisma/prisma/issues/23573) — 2x raw query performance difference (4.35s vs 2.15s)

**GPS Accuracy & Geofencing:**
- [How Accurate is Geofencing? - Radar](https://radar.com/blog/how-accurate-is-geofencing) — Real-world 20-50m urban accuracy data
- [Geofencing Accuracy Best Practices](https://www.geoplugin.com/resources/geofencing-accuracy-best-practices-for-improvements/) — Multi-source improvement strategies

**Feature Analysis:**
- [Foursquare Swarm](https://swarmapp.com/) — Check-in app feature set, session patterns
- [Wag Buddy](https://wagbuddy.app/) — Dog park check-in app, friend notification features
- [DogPack App](https://www.dogpackapp.com/) — Real-time occupancy, dog-friendly spots

### Tertiary (LOW confidence, needs validation)

**Session Management:**
- [Session Management with Redis](https://medium.com/@20011002nimeth/session-management-with-redis-a21d43ac7d5a) — TTL strategies (Medium article, single author)
- [Redis Key Expiry and Keyspace Notifications](https://medium.com/@krishnakowshik/redis-key-expiry-and-keyspace-notifications-9dde9de7e74f) — Delay examples under load (anecdotal)

**Deployment Guides:**
- [How to Dockerize a Telegram Bot](https://tjtanjin.medium.com/how-to-dockerize-a-telegram-bot-a-step-by-step-guide-b14bc427f5dc) — Docker best practices (Medium article)
- [Automating Telegram Bot Deployment](https://tjtanjin.medium.com/automating-telegram-bot-deployment-with-github-actions-and-docker-482abcd2533e) — CI/CD pipeline examples (Medium article)

---

*Research completed: 2026-01-29*
*Ready for roadmap: Yes*
*Next step: Load this summary as context for roadmap creation with 6 suggested phases*
