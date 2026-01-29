# Domain Pitfalls

**Domain:** Telegram bot with geofencing, real-time session tracking, and Redis TTL expiry
**Researched:** 2026-01-29
**Confidence:** HIGH (verified with official Redis and Telegram documentation)

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or major reliability issues.

### Pitfall 1: Relying on Redis TTL Expiry Notifications for Critical Operations

**What goes wrong:**
Teams design systems where Redis keyspace notifications trigger critical actions (expiry reminders, session cleanup, state transitions), assuming these notifications fire reliably when TTL reaches zero. In production, users report missed notifications, delayed alerts (minutes late), or complete silence during high load.

**Why it happens:**
Redis keyspace notifications are **fire-and-forget with zero delivery guarantees**. Expired events only generate when (1) a key is accessed and found expired, or (2) background cleanup scans reach that key. If your cache has thousands of keys with TTLs and no active reads, significant delays occur between TTL=0 and notification delivery. Additionally, if your client disconnects momentarily, all events during that window are permanently lost.

**Consequences:**
- Users get expiry reminders 5-10 minutes late (or never)
- Sessions appear "stuck" because cleanup handlers never ran
- Race conditions where users check in again before old session expired
- Silent failures with no retry mechanism

**Prevention:**
```typescript
// WRONG: Relying on keyspace notifications alone
redis.on('expired', (key) => {
  sendExpiryReminder(key); // May never fire!
});

// CORRECT: Active polling + notifications as optimization
class SessionManager {
  async startExpiryPoller() {
    setInterval(async () => {
      const expiringSoon = await redis.zrangebyscore(
        'session:expiry:index',
        Date.now(),
        Date.now() + 60000 // Check 1 min ahead
      );
      for (const sessionId of expiringSoon) {
        await this.handleExpiry(sessionId);
      }
    }, 30000); // Every 30s
  }

  // Use notifications as optimization, not source of truth
  async onKeyspaceNotification(key: string) {
    // Verify expiry actually happened
    const exists = await redis.exists(key);
    if (!exists) {
      await this.handleExpiry(extractSessionId(key));
    }
  }
}
```

**Architecture pattern:**
- Maintain a **secondary expiry index** (Redis sorted set with expiry timestamps)
- Active polling scans this index every 30-60 seconds
- Keyspace notifications optimize "happy path" but polling ensures nothing is missed
- Store critical reminder state in PostgreSQL, not just Redis

**Detection:**
- Users report "didn't get reminder" despite session expiring
- Monitoring shows notification subscriber disconnects/reconnects
- Session keys exist past their intended expiry window
- Load testing reveals delayed notifications under concurrent load

**Phase impact:**
- **Phase 1 (MVP)**: Must be addressed immediately. Silent expiry failures break core UX.
- Requires: Secondary index design, polling loop, notification fallback pattern

**Sources:**
- [Redis Keyspace Notifications](https://redis.io/docs/latest/develop/pubsub/keyspace-notifications/) - Official documentation confirms fire-and-forget, no timing guarantees
- [Redis Key Expiry and Keyspace Notifications](https://medium.com/@krishnakowshik/redis-key-expiry-and-keyspace-notifications-9dde9de7e74f) - Real-world delay examples

---

### Pitfall 2: Geofence Threshold Too Strict for Real-World GPS Accuracy

**What goes wrong:**
Developers set check-in radius to exactly 200m based on "official venue boundary," then users report "can't check in even though I'm standing at the gate" or "got kicked out while sitting inside." Urban environments, poor GPS signal, and device variance make sub-50m geofencing unreliable.

**Why it happens:**
GPS accuracy varies wildly: 5-10m in ideal conditions, 20-50m in urban areas, 100m+ near tall buildings. Wi-Fi/cellular fallback helps but requires user permissions. Developers test in optimal conditions (suburban, Wi-Fi on, modern phone) and assume that's representative.

**Consequences:**
- False negatives: legitimate users can't check in (bounce to 210m)
- False positives: users outside venue pass geofence (GPS drifts inside)
- Support burden: "Your geofence is broken" complaints
- Workarounds: users disable/enable location repeatedly until it "works"

**Prevention:**
```typescript
// WRONG: Strict 200m threshold
const GEOFENCE_RADIUS_M = 200;
const distance = haversineDistance(userLat, userLng, venueLat, venueLng);
if (distance > GEOFENCE_RADIUS_M) {
  return { allowed: false, reason: 'Too far' };
}

// CORRECT: Tiered thresholds with accuracy consideration
const INNER_RADIUS_M = 150;  // High confidence
const OUTER_RADIUS_M = 250;  // Accept with accuracy check
const MAX_ACCEPTED_ACCURACY = 50; // meters

async function validateGeofence(
  userLat: number,
  userLng: number,
  accuracy: number, // from Telegram location data
  venueLat: number,
  venueLng: number
) {
  const distance = haversineDistance(userLat, userLng, venueLat, venueLng);

  // Definitely inside
  if (distance <= INNER_RADIUS_M) {
    return { allowed: true, confidence: 'high' };
  }

  // In fuzzy zone - require good GPS accuracy
  if (distance <= OUTER_RADIUS_M && accuracy <= MAX_ACCEPTED_ACCURACY) {
    return { allowed: true, confidence: 'medium' };
  }

  return {
    allowed: false,
    reason: `Distance: ${Math.round(distance)}m (limit: ${OUTER_RADIUS_M}m)`,
    suggestion: 'Move closer or improve GPS signal (enable Wi-Fi, clear sky view)'
  };
}
```

**Best practices:**
- **Minimum radius:** 100-150m for any geofence (official Android recommendation)
- **Check accuracy field:** Telegram location messages include accuracy; reject if >50m
- **Urban buffer:** Add 30-50m buffer in Singapore due to high-rise interference
- **User feedback:** Show distance + accuracy so users understand why check-in failed

**Detection:**
- High check-in failure rate (>20%) despite legitimate users
- Complaints about "standing inside but can't check in"
- Success rate varies by venue (urban vs park)
- Low accuracy values correlated with failures

**Phase impact:**
- **Phase 1 (MVP)**: Use 150m inner + 250m outer with accuracy gating
- **Phase 2**: Add ML model for false positive/negative correction based on venue density

**Sources:**
- [How Accurate is Geofencing? Real-World Precision](https://radar.com/blog/how-accurate-is-geofencing) - 20-50m urban accuracy documented
- [Android Geofencing Best Practices](https://developer.android.com/develop/sensors-and-location/location/geofencing) - 100-150m minimum recommendation
- [Geofencing Accuracy Best Practices](https://www.geoplugin.com/resources/geofencing-accuracy-best-practices-for-improvements/) - Multi-source improvement strategies

---

### Pitfall 3: Telegram Group Chat Migration Breaking Session State

**What goes wrong:**
When Telegram converts a regular group to supergroup (happens automatically when groups exceed limits or enable features), the chat ID changes. Your bot loses all session data, user mappings, and venue associations for that chat because keys use the old ID. Users see "session not found" errors mid-session.

**Why it happens:**
Telegram treats the migrated supergroup as an entirely new chat with a different ID. The bot receives a `migrate_to_chat_id` update, but this arrives **asynchronously** - new messages from the supergroup may arrive before the migration notice. If session keys use chat_id directly, they point to the old, now-invalid chat.

**Consequences:**
- Active check-in sessions vanish mid-session
- User-to-dog mappings reset for that group
- Venue preferences lost
- Data races: message arrives from new chat_id before migration handler processes

**Prevention:**
```typescript
// WRONG: Using chat_id directly in keys
const sessionKey = `session:${chatId}:${userId}`;

// CORRECT: Handle migration + use stable identifiers
class SessionStore {
  // Maintain migration mapping
  async handleChatMigration(oldChatId: number, newChatId: number) {
    // CRITICAL: Must be atomic transaction
    const pipeline = redis.pipeline();

    // Copy all keys for this chat
    const pattern = `session:${oldChatId}:*`;
    const keys = await redis.keys(pattern);

    for (const oldKey of keys) {
      const newKey = oldKey.replace(
        `session:${oldChatId}:`,
        `session:${newChatId}:`
      );
      const value = await redis.get(oldKey);
      const ttl = await redis.ttl(oldKey);

      pipeline.set(newKey, value);
      if (ttl > 0) pipeline.expire(newKey, ttl);
    }

    // Store migration mapping (permanent)
    await db.chatMigrations.insert({
      oldChatId,
      newChatId,
      migratedAt: new Date()
    });

    await pipeline.exec();

    // Clean old keys after confirming migration
    setTimeout(() => redis.del(...keys), 60000); // 1 min grace period
  }

  // Always check migration before key access
  async resolveChat(chatId: number): Promise<number> {
    const migration = await db.chatMigrations.findOne({ oldChatId: chatId });
    return migration?.newChatId ?? chatId;
  }
}

// Middleware to handle migration updates
bot.on('migrate_to_chat_id', async (ctx) => {
  const oldChatId = ctx.chat.id;
  const newChatId = ctx.update.message.migrate_to_chat_id;
  await sessionStore.handleChatMigration(oldChatId, newChatId);
});

// CRITICAL: Check migration on every message
bot.use(async (ctx, next) => {
  if (ctx.chat?.id) {
    ctx.resolvedChatId = await sessionStore.resolveChat(ctx.chat.id);
  }
  return next();
});
```

**Architecture implications:**
- Store migration mappings in **PostgreSQL, not Redis** (must persist)
- Never trust chat_id - always resolve through migration table
- Implement middleware that resolves chat_id before every handler
- Use database transactions when copying session data

**Detection:**
- "Session not found" errors for users who just sent valid check-in
- Redis keys with old chat_id remain after migration
- Active session count drops suddenly for a group
- Users report "bot forgot everything" in specific group

**Phase impact:**
- **Phase 1 (MVP)**: Must implement migration handlers from day one
- Groups may migrate even during small MVP testing if you enable features
- Fixing retroactively requires re-asking users to check in

**Sources:**
- [grammY Session Documentation](https://grammy.dev/plugins/session.html) - Documents migration data race issue
- [Telegram State Management Issue](https://github.com/php-telegram-bot/core/issues/874) - Real-world migration problems

---

### Pitfall 4: Concurrent Check-ins/Check-outs Creating Race Conditions

**What goes wrong:**
User rapidly taps "check in" twice, or two users check out simultaneously. Bot processes both requests in parallel, leading to: duplicate sessions, incorrect occupancy counts (off by 1-2), or sessions that never get created/removed properly.

**Why it happens:**
Telegram webhook deployment processes updates sequentially **per chat**, but multiple chats can process concurrently. Redis GET-check-SET patterns are not atomic. Between reading current count and writing new count, another handler modified it. Node.js async handlers exacerbate this with concurrent promise execution.

**Consequences:**
- Occupancy counter drifts from reality (shows 3 dogs, actually 2)
- Duplicate active sessions for same user (both with TTL, waste memory)
- Checkout fails with "session not found" because duplicate consumed different key
- Users see "already checked in" then "not checked in" confusion

**Prevention:**
```typescript
// WRONG: Non-atomic read-modify-write
async function checkIn(userId: number, venueId: number) {
  const existing = await redis.get(`session:${userId}`);
  if (existing) return { error: 'Already checked in' };

  await redis.set(`session:${userId}`, sessionData); // RACE HERE
  const count = await redis.incr(`occupancy:${venueId}`);
}

// CORRECT: Lua scripts for atomic operations
const CHECK_IN_SCRIPT = `
  local sessionKey = KEYS[1]
  local occupancyKey = KEYS[2]
  local sessionData = ARGV[1]
  local ttl = tonumber(ARGV[2])

  -- Check existence atomically
  if redis.call('EXISTS', sessionKey) == 1 then
    return { 'error', 'Already checked in' }
  end

  -- Create session + increment occupancy atomically
  redis.call('SET', sessionKey, sessionData, 'EX', ttl)
  local newCount = redis.call('INCR', occupancyKey)

  return { 'ok', newCount }
`;

async function checkIn(userId: number, venueId: number, ttlSeconds: number) {
  const result = await redis.eval(
    CHECK_IN_SCRIPT,
    2, // number of keys
    `session:${userId}`,
    `occupancy:${venueId}`,
    JSON.stringify(sessionData),
    ttlSeconds
  );

  if (result[0] === 'error') {
    return { success: false, error: result[1] };
  }

  return { success: true, occupancy: result[1] };
}

// For PostgreSQL: Use transactions with row-level locking
async function persistSession(userId: number, venueId: number) {
  return await db.transaction(async (tx) => {
    // FOR UPDATE locks the row until commit
    const existing = await tx.sessions.findOne({
      userId,
      active: true
    }).forUpdate();

    if (existing) {
      throw new Error('Already checked in');
    }

    const session = await tx.sessions.insert({
      userId,
      venueId,
      checkedInAt: new Date()
    });

    return session;
  });
}
```

**Additional safeguards:**
- **Idempotency keys:** Accept client-generated `check_in_id`, store in Redis for 5 min, reject duplicates
- **Optimistic locking:** Include version field in session data, reject if version changed
- **Defer occupancy updates:** Use separate background job to reconcile counts every 30s

**Testing strategy:**
```typescript
// Load test for race conditions
test('concurrent check-ins by same user', async () => {
  const results = await Promise.all([
    checkIn(userId, venueId),
    checkIn(userId, venueId),
    checkIn(userId, venueId)
  ]);

  const successes = results.filter(r => r.success);
  expect(successes).toHaveLength(1); // Only one should succeed

  const occupancy = await getOccupancy(venueId);
  expect(occupancy).toBe(1); // Not 2 or 3
});
```

**Detection:**
- Occupancy count increases by >1 for single check-in event
- Multiple active sessions in Redis for same user
- Monitoring shows duplicate webhook processing
- Error logs: "session already exists" then "session not found" for same user

**Phase impact:**
- **Phase 1 (MVP)**: Implement Lua scripts from start - easier than retrofitting
- Test with deliberate rapid-fire requests (not just normal human speed)

**Sources:**
- [Handling Race Conditions in Real-Time Apps](https://dev.to/mattlewandowski93/handling-race-conditions-in-real-time-apps-49c8) - WebSocket/concurrent request patterns
- [Redis Transactions Documentation](https://redis.io/docs/latest/develop/interact/transactions/) - MULTI/EXEC vs Lua scripts

---

### Pitfall 5: Webhook HTTPS Certificate Chain Issues Causing Silent Failures

**What goes wrong:**
Bot works perfectly with polling during development, but after switching to webhooks for production deployment, Telegram reports successful webhook setup (`setWebhook` returns OK) but updates never arrive. No error messages, no logs - just silence.

**Why it happens:**
Telegram requires **complete certificate chain** (leaf + all intermediates) even when browsers accept your cert. Missing intermediate certs cause Telegram's validator to reject the connection silently. Using unverified certs from budget providers, switching CAs, or using Let's Encrypt without concatenating the full chain triggers this.

**Consequences:**
- Bot appears "online" but never responds to messages
- No delivery errors from Telegram
- Hours wasted debugging bot code instead of infrastructure
- Switching back to polling in production (performance hit)

**Prevention:**
```bash
# WRONG: Only uploading leaf certificate
curl -F "url=https://example.com/webhook" \
     -F "certificate=@server.crt" \
     https://api.telegram.org/bot<TOKEN>/setWebhook

# CORRECT: Verify and upload complete chain
# 1. Check your certificate chain
openssl s_client -connect example.com:443 -showcerts

# 2. Concatenate full chain (leaf + intermediates + root)
cat server.crt intermediate.crt root.crt > fullchain.pem

# 3. Verify chain is complete
openssl verify -CAfile fullchain.pem server.crt

# 4. Upload complete chain
curl -F "url=https://example.com/webhook" \
     -F "certificate=@fullchain.pem" \
     https://api.telegram.org/bot<TOKEN>/setWebhook
```

**Infrastructure requirements:**
- **Only ports 443, 80, 88, 8443 supported**
- IPv4 only (no IPv6)
- TLS 1.2+ (TLS 1.0/1.1 rejected)
- Certificate CN/SAN must match webhook domain exactly
- Accept requests from Telegram IP ranges: `149.154.160.0/20` and `91.108.4.0/22`

**For Let's Encrypt users:**
```bash
# Use fullchain.pem, NOT cert.pem
certbot certonly --webroot -w /var/www/html -d example.com

# Correct file (includes intermediates)
/etc/letsencrypt/live/example.com/fullchain.pem

# Wrong file (leaf only)
/etc/letsencrypt/live/example.com/cert.pem
```

**Verification checklist:**
```typescript
// Test webhook setup
async function verifyWebhook() {
  const info = await bot.api.getWebhookInfo();

  console.log('Webhook URL:', info.url);
  console.log('Pending updates:', info.pending_update_count);
  console.log('Last error:', info.last_error_message);
  console.log('Last error date:', new Date(info.last_error_date * 1000));

  if (info.last_error_message) {
    throw new Error(`Webhook error: ${info.last_error_message}`);
  }

  if (info.pending_update_count > 0) {
    console.warn(`${info.pending_update_count} updates queued - check delivery`);
  }
}

// Set up webhook with validation
async function setupWebhook(url: string, certPath: string) {
  // Read certificate
  const certificate = await fs.readFile(certPath);

  // Set webhook
  await bot.api.setWebhook(url, {
    certificate: new InputFile(certificate),
    max_connections: 40,
    allowed_updates: ['message', 'callback_query']
  });

  // Verify immediately
  await verifyWebhook();

  // Monitor for first update
  setTimeout(async () => {
    const info = await bot.api.getWebhookInfo();
    if (info.pending_update_count > 0) {
      console.error('Updates not being processed - check webhook handler');
    }
  }, 60000); // 1 min
}
```

**Detection:**
- `getWebhookInfo()` shows increasing `pending_update_count`
- `last_error_message` mentions SSL/TLS/certificate
- Bot works with polling, fails with webhook
- `curl` to your webhook succeeds but Telegram doesn't connect

**Phase impact:**
- **Pre-launch:** Must resolve before production deployment
- Staging environment should use webhook (not polling) to catch this early
- Budget 2-4 hours for certificate debugging in timeline

**Sources:**
- [Marvin's Marvellous Guide to All Things Webhook](https://core.telegram.org/bots/webhooks) - Official Telegram webhook documentation with certificate requirements
- [Telegram Webhook Setup Guide](https://pinggy.io/blog/how_to_set_up_and_test_telegram_bot_webhook/) - Common certificate issues

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or degraded UX.

### Pitfall 6: No Session Cleanup After Bot Restart

**What goes wrong:**
Bot restarts (deployment, crash, server reboot), and session data in Redis becomes orphaned. TTL continues counting down, but no process exists to send expiry reminders or update occupancy counts when sessions expire during downtime.

**Why it happens:**
Keyspace notification subscriptions don't persist across restarts. Your bot reconnects to Redis but missed all expiry events that occurred while offline. Sessions silently expire without triggering cleanup handlers.

**Prevention:**
```typescript
// Recovery scan on startup
async function recoverOrphanedSessions() {
  console.log('Scanning for orphaned sessions...');

  // Get all active session keys
  const sessionKeys = await redis.keys('session:*');
  const now = Date.now();
  let recovered = 0;

  for (const key of sessionKeys) {
    const ttl = await redis.ttl(key); // seconds remaining

    // Already expired or expiring in next 60s
    if (ttl <= 60) {
      const sessionData = await redis.get(key);
      const session = JSON.parse(sessionData);

      // Send overdue reminder
      await sendExpiryReminder(session);
      recovered++;
    } else {
      // Re-schedule reminder for this session
      const expiryTime = now + (ttl * 1000);
      await scheduleReminder(key, expiryTime);
    }
  }

  console.log(`Recovered ${recovered} orphaned sessions`);
}

// Call during bot initialization
async function startBot() {
  await bot.init();
  await recoverOrphanedSessions();
  await startExpiryPoller(); // Resume monitoring
  bot.start();
}
```

---

### Pitfall 7: Storing Location Data Without Retention Policy

**What goes wrong:**
Bot stores every location update in database for "debugging purposes," then months later PostgreSQL is 50GB+ and queries slow down. GDPR/PDPA concerns emerge because you're retaining precise location history indefinitely.

**Prevention:**
- Store only **last known location** per user (overwrite, don't append)
- For check-ins, store only venue ID, not raw coordinates
- If debugging requires history, implement automatic purge after 7 days
- Document retention policy in privacy policy

```typescript
// WRONG: Unbounded location history
await db.locationHistory.insert({
  userId,
  lat,
  lng,
  timestamp: new Date()
});

// CORRECT: Single "last location" record
await db.users.update(userId, {
  lastKnownLat: lat,
  lastKnownLng: lng,
  lastLocationUpdate: new Date()
});

// For check-ins: No raw coords needed
await db.checkIns.insert({
  userId,
  venueId, // Reference to venue, not coordinates
  checkedInAt: new Date()
});
```

---

### Pitfall 8: Not Handling Telegram's Message Edit Events

**What goes wrong:**
User checks in by sending location, then accidentally edits the message (Telegram allows editing within 48h). Bot processes this as a **new** check-in attempt, creating duplicate sessions or confusing state.

**Prevention:**
```typescript
// Handle both new messages and edits
bot.on('message:location', handleCheckIn);
bot.on('edited_message:location', async (ctx) => {
  // Treat as potential correction, not new check-in
  await ctx.reply(
    'Location edit detected. Use /checkin command to update check-in, ' +
    'or /checkout then check in again.'
  );
});
```

---

### Pitfall 9: Assuming Network Requests Always Succeed

**What goes wrong:**
Bot sends reminder notification, network error occurs, exception crashes handler. Reminder never gets retried, session expires without user notification.

**Prevention:**
```typescript
// WRONG: No error handling
await bot.api.sendMessage(userId, 'Your session expires in 5 minutes');

// CORRECT: Retry with backoff + dead letter queue
async function sendNotificationWithRetry(
  userId: number,
  message: string,
  retries = 3
) {
  for (let i = 0; i < retries; i++) {
    try {
      await bot.api.sendMessage(userId, message);
      return { success: true };
    } catch (err) {
      if (err.error_code === 403) {
        // User blocked bot - don't retry
        await db.users.update(userId, { botBlocked: true });
        return { success: false, reason: 'blocked' };
      }

      if (i < retries - 1) {
        await sleep(Math.pow(2, i) * 1000); // Exponential backoff
      }
    }
  }

  // All retries failed - log for manual review
  await db.failedNotifications.insert({
    userId,
    message,
    attemptedAt: new Date(),
    reason: 'max_retries_exceeded'
  });

  return { success: false, reason: 'network_error' };
}
```

---

### Pitfall 10: Webhook Port Conflicts in Multi-Bot Deployments

**What goes wrong:**
Running multiple Telegram bots on same server, each needs webhook on a different port, but Telegram only supports ports 443, 80, 88, 8443. Fifth bot has nowhere to bind.

**Prevention:**
- Use reverse proxy (nginx) to route by path: `example.com/bot1`, `example.com/bot2`
- All bots listen on different internal ports, nginx forwards from 443
- Or use different domains/subdomains: `bot1.example.com:443`, `bot2.example.com:443`

```nginx
# nginx config for multiple bots on port 443
server {
  listen 443 ssl;
  server_name example.com;

  ssl_certificate /path/to/fullchain.pem;
  ssl_certificate_key /path/to/privkey.pem;

  location /bot1/webhook {
    proxy_pass http://localhost:3001/webhook;
  }

  location /bot2/webhook {
    proxy_pass http://localhost:3002/webhook;
  }
}
```

---

## Minor Pitfalls

Mistakes that cause annoyance but are easily fixable.

### Pitfall 11: Not Validating Location Accuracy Field

**What goes wrong:**
User shares location while in poor signal area (accuracy: 200m). Bot accepts it, user "checks in" from 300m away.

**Prevention:**
```typescript
const location = ctx.message.location;
const accuracy = location.horizontal_accuracy; // meters

if (accuracy && accuracy > 50) {
  return ctx.reply(
    `GPS accuracy too low (${accuracy}m). Please:\n` +
    '- Enable Wi-Fi\n' +
    '- Move to open area\n' +
    '- Wait for GPS lock'
  );
}
```

---

### Pitfall 12: Forgetting to Handle User Blocking Bot

**What goes wrong:**
User blocks bot mid-session. Bot tries to send expiry reminder, gets 403 Forbidden error, handler crashes.

**Prevention:**
```typescript
try {
  await bot.api.sendMessage(userId, message);
} catch (err) {
  if (err.error_code === 403) {
    // User blocked bot - mark as inactive
    await db.users.update(userId, { active: false, blockedAt: new Date() });

    // Clean up active sessions
    await redis.del(`session:${userId}`);
  }
}
```

---

### Pitfall 13: Hardcoding Venue Coordinates Instead of Using Config

**What goes wrong:**
Singapore dog runs occasionally relocate or expand. Hardcoded coordinates require code change + deployment to update.

**Prevention:**
```typescript
// WRONG: Hardcoded
const venues = {
  'Marine Parade': { lat: 1.3011, lng: 103.9057, radius: 200 }
};

// CORRECT: Database-driven
const venues = await db.venues.findAll();

// Even better: Admin commands to update
bot.command('admin_update_venue', adminOnly, async (ctx) => {
  // Parse venue update from message
  await db.venues.update(venueId, { lat, lng, radius });
  ctx.reply('Venue updated');
});
```

---

### Pitfall 14: Not Logging User Actions for Debugging

**What goes wrong:**
User reports "bot said I was already checked in but I wasn't." No logs to investigate.

**Prevention:**
```typescript
// Structured logging
import pino from 'pino';
const logger = pino();

logger.info({
  action: 'check_in_attempt',
  userId,
  venueId,
  distance: distanceFromVenue,
  accuracy: location.horizontal_accuracy,
  result: 'success'
});
```

---

### Pitfall 15: UI Copy Doesn't Explain Why Action Failed

**What goes wrong:**
Bot replies "Check-in failed" with no context. User doesn't know if they're too far, already checked in, or system error.

**Prevention:**
```typescript
// WRONG: Generic error
ctx.reply('Check-in failed');

// CORRECT: Actionable feedback
if (distance > MAX_RADIUS) {
  ctx.reply(
    `You're ${Math.round(distance)}m from the venue (max: ${MAX_RADIUS}m).\n\n` +
    'Please move closer and try again.'
  );
} else if (existingSession) {
  ctx.reply(
    `You're already checked in at ${existingSession.venueName} since ` +
    `${formatTime(existingSession.checkedInAt)}.\n\n` +
    'Use /checkout first, then check in to the new location.'
  );
}
```

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| **MVP - Core Check-in** | Redis TTL expiry notification failures | Implement secondary expiry index + polling from day one |
| **MVP - Geofencing** | 200m radius too strict for urban areas | Use 150m inner / 250m outer with accuracy gating |
| **MVP - Session State** | Group chat migration breaks sessions | Add migration handler + PostgreSQL mapping table |
| **MVP - Concurrent Users** | Race conditions on check-in/checkout | Use Lua scripts for atomic Redis operations |
| **Production Deploy** | Webhook certificate chain incomplete | Test with full chain, verify with `getWebhookInfo()` |
| **Multi-Venue Support** | Hardcoded coordinates require redeploy | Store venues in database with admin update commands |
| **Scaling** | Polling doesn't scale past 100 users | Switch to webhooks early (before scaling issues hit) |
| **User Privacy** | Unbounded location history storage | Implement 7-day auto-purge for debugging data |

---

## Sources

### Official Documentation (HIGH confidence)
- [Redis Keyspace Notifications](https://redis.io/docs/latest/develop/pubsub/keyspace-notifications/) - Delivery guarantees, timing limitations
- [Telegram Webhook Guide](https://core.telegram.org/bots/webhooks) - Certificate requirements, port restrictions
- [Telegram Bot Features](https://core.telegram.org/bots/features) - Location sharing capabilities
- [grammY Session Plugin](https://grammy.dev/plugins/session.html) - Migration issues, race conditions
- [Android Geofencing Documentation](https://developer.android.com/develop/sensors-and-location/location/geofencing) - Minimum radius recommendations

### Technical Guides (MEDIUM confidence)
- [Common Mistakes When Building Telegram Bots](https://infinitejs.com/posts/common-mistakes-telegram-bots-nodejs/) - Error handling, webhook vs polling
- [Polling vs Webhook Guide](https://grammy.dev/guide/deployment-types) - Deployment type comparison
- [Redis Key Expiry and Keyspace Notifications](https://medium.com/@krishnakowshik/redis-key-expiry-and-keyspace-notifications-9dde9de7e74f) - Real-world delay examples
- [Handling Race Conditions in Real-Time Apps](https://dev.to/mattlewandowski93/handling-race-conditions-in-real-time-apps-49c8) - Concurrent request patterns

### Accuracy & Reliability Studies (MEDIUM confidence)
- [How Accurate is Geofencing?](https://radar.com/blog/how-accurate-is-geofencing) - Real-world GPS accuracy data
- [Geofencing Accuracy Best Practices](https://www.geoplugin.com/resources/geofencing-accuracy-best-practices-for-improvements/) - Multi-source strategies
- [Reliable Keyspace Notifications Issue](https://github.com/valkey-io/valkey/issues/28) - Community discussion of Redis limitations

### Security & Privacy (MEDIUM confidence)
- [Telegram Bot Privacy Policy](https://telegram.org/privacy-tpa) - Data handling requirements
- [Real-Time Location Sharing Guide](https://golubevcg.com/post/real-time_location_sharing_with_telegram_bots) - Implementation patterns
