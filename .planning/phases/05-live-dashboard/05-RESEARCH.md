# Phase 5: Live Dashboard - Research

**Researched:** 2026-01-30
**Domain:** Telegram bot dashboard with real-time data aggregation and inline updates
**Confidence:** HIGH

## Summary

This phase implements a live occupancy dashboard showing all 11 Singapore dog runs with current dog counts and size breakdowns. The dashboard requires aggregating active session data from PostgreSQL, formatting it for Telegram display, and handling sorting (by distance or dog count) with in-place message updates.

The codebase already uses Telegraf 4.16.3 with established patterns for command handlers, inline keyboards, and callback actions. The existing `haversine-distance` package and geofence utility provide distance calculations. The key technical challenge is the location request flow: Telegram's API limitation means inline keyboard buttons cannot directly request location - a reply keyboard must be used instead.

**Primary recommendation:** Implement /live as a command handler that queries aggregated session data, formats a compact dashboard message, and provides inline sorting buttons. For "Nearest" sort, transition to a reply keyboard for location sharing, then update the message in-place.

## Standard Stack

The established libraries/tools for this domain:

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| telegraf | 4.16.3 | Telegram bot framework | Already in use, full Bot API 7.1 support |
| pg | 8.17.2 | PostgreSQL client | Already in use for all database operations |
| haversine-distance | 1.2.4 | Distance calculations | Already in use in geofence.ts, returns meters |

### Supporting (Already Available)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Built-in Date/Intl | N/A | Time formatting | Singapore locale (en-SG) for timestamps |

### No Additional Dependencies Required

The phase requires no new npm packages. All needed functionality exists in current dependencies.

## Architecture Patterns

### Recommended Project Structure
```
src/
├── bot/
│   ├── handlers/
│   │   └── live.ts          # /live command handler (replace placeholder)
│   └── utils/
│       └── geofence.ts      # Existing - has haversine distance
├── db/
│   ├── repositories/
│   │   ├── sessionRepository.ts  # Add: getOccupancyByLocation()
│   │   └── locationRepository.ts # New: location queries if needed
│   └── locations.ts         # Existing - getAllLocations()
└── types/
    └── dashboard.ts         # New: dashboard-specific types
```

### Pattern 1: Aggregation Query with Conditional Counts
**What:** Use PostgreSQL FILTER clause for efficient size-based counting
**When to use:** Dashboard data retrieval
**Example:**
```typescript
// Source: PostgreSQL docs + project pattern from sessionRepository.ts
interface OccupancyRow {
  location_id: number;
  location_name: string;
  latitude: number;
  longitude: number;
  total_dogs: number;
  small_count: number;
  medium_count: number;
  large_count: number;
}

async function getOccupancyByLocation(): Promise<OccupancyRow[]> {
  const result = await pool.query<OccupancyRow>(`
    SELECT
      l.id as location_id,
      l.name as location_name,
      l.latitude,
      l.longitude,
      COUNT(sd.dog_id) as total_dogs,
      COUNT(sd.dog_id) FILTER (WHERE d.size = 'Small') as small_count,
      COUNT(sd.dog_id) FILTER (WHERE d.size = 'Medium') as medium_count,
      COUNT(sd.dog_id) FILTER (WHERE d.size = 'Large') as large_count
    FROM locations l
    LEFT JOIN sessions s ON s.location_id = l.id AND s.status = 'active'
    LEFT JOIN session_dogs sd ON sd.session_id = s.id
    LEFT JOIN dogs d ON d.id = sd.dog_id
    GROUP BY l.id, l.name, l.latitude, l.longitude
    ORDER BY l.name
  `);
  return result.rows;
}
```

### Pattern 2: In-Place Message Updates with Callbacks
**What:** Use editMessageText for sort changes and refresh
**When to use:** When user clicks sort or refresh buttons
**Example:**
```typescript
// Source: Telegraf docs + project pattern from sessionCallbacks.ts
bot.action('sort_most_dogs', async (ctx) => {
  await ctx.answerCbQuery();

  const occupancy = await getOccupancyByLocation();
  const sorted = sortByDogCount(occupancy);
  const message = formatDashboard(sorted, 'most_dogs');
  const keyboard = buildDashboardKeyboard('most_dogs');

  await ctx.editMessageText(message, keyboard);
});
```

### Pattern 3: Reply Keyboard for Location Request
**What:** Telegram inline buttons cannot request location - must use reply keyboard
**When to use:** When user wants to sort by "Nearest" and location not available
**Example:**
```typescript
// Source: Telegram Bot API docs + project pattern from checkInWizard.ts
bot.action('sort_nearest', async (ctx) => {
  await ctx.answerCbQuery();

  // Must use reply keyboard, not inline
  await ctx.reply(
    'Share your location to find nearest parks:',
    Markup.keyboard([
      [Markup.button.locationRequest('Share Location')],
      [Markup.button.text('Cancel')]
    ]).oneTime().resize()
  );
});

// Then handle the location message
bot.on('location', async (ctx) => {
  if (!ctx.scene.current) {
    const userLat = ctx.message.location.latitude;
    const userLon = ctx.message.location.longitude;

    const occupancy = await getOccupancyByLocation();
    const sorted = sortByDistance(occupancy, userLat, userLon);
    const message = formatDashboard(sorted, 'nearest', userLat, userLon);

    await ctx.reply(message, {
      reply_markup: { remove_keyboard: true },
      ...buildDashboardKeyboard('nearest')
    });
  }
});
```

### Pattern 4: Compact Size Formatting
**What:** Abbreviated size display per user decision
**When to use:** Dashboard entry formatting
**Example:**
```typescript
// Source: User decision from CONTEXT.md
function formatSizeBreakdown(small: number, medium: number, large: number): string {
  const parts: string[] = [];
  if (small > 0) parts.push(`${small}S`);
  if (medium > 0) parts.push(`${medium}M`);
  if (large > 0) parts.push(`${large}L`);

  // Single size simplification per user decision
  const total = small + medium + large;
  if (parts.length === 1) {
    const size = small > 0 ? 'Small' : medium > 0 ? 'Medium' : 'Large';
    return `${total} ${size} ${total === 1 ? 'dog' : 'dogs'}`;
  }

  return `${total} dogs (${parts.join(', ')})`;
}
```

### Anti-Patterns to Avoid
- **Fetching per-location separately:** Use a single aggregation query, not N+1 queries
- **Inline keyboard for location request:** Telegram API doesn't support this - use reply keyboard
- **Storing dashboard state in session:** Dashboard is read-only; recalculate on each request
- **Separate message for each park:** Send one message with all parks as per compact format decision

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Distance calculation | Custom haversine | `haversine-distance` package | Already imported in geofence.ts, returns meters |
| Time formatting | Manual string building | `toLocaleTimeString('en-SG', {...})` | Already used in sessionCallbacks.ts for Singapore timezone |
| Inline keyboard construction | Raw JSON markup | `Markup.inlineKeyboard()` | Type-safe, handles button.callback properly |
| Reply keyboard for location | Manual object | `Markup.keyboard([Markup.button.locationRequest()])` | Already used in checkInWizard.ts |

**Key insight:** All UI patterns needed are already established in the codebase. Follow existing patterns in profile.ts, sessionCallbacks.ts, and checkInWizard.ts.

## Common Pitfalls

### Pitfall 1: Trying to Request Location from Inline Keyboard
**What goes wrong:** Inline keyboard buttons cannot trigger location sharing - nothing happens when user clicks
**Why it happens:** Telegram Bot API limitation - only ReplyKeyboardMarkup supports `request_location`
**How to avoid:** When "Sort by Nearest" is clicked, send a new message with reply keyboard containing location button
**Warning signs:** Button that should request location does nothing; no location handler triggered

### Pitfall 2: Empty Dashboard When All Parks Have 0 Dogs
**What goes wrong:** Query returns no rows when using INNER JOIN
**Why it happens:** INNER JOIN excludes locations with no active sessions
**How to avoid:** Use LEFT JOIN from locations to sessions, COALESCE for counts
**Warning signs:** Parks disappear from dashboard when they have no checked-in dogs

### Pitfall 3: Race Condition on Refresh
**What goes wrong:** User sees stale data after refresh because of message caching
**Why it happens:** Telegram may cache inline keyboard messages briefly
**How to avoid:** Include unique identifier (timestamp) in callback data or message content
**Warning signs:** Clicking refresh shows same data even when database changed

### Pitfall 4: N+1 Query for User's Active Session Check
**What goes wrong:** Dashboard slow because checking each user's session separately
**Why it happens:** Need to show "You're here" marker at user's current location
**How to avoid:** Query user's active session once before rendering, pass locationId to formatter
**Warning signs:** Dashboard takes noticeably longer for users with profiles

### Pitfall 5: Location Sharing State Conflicts
**What goes wrong:** Location handler fires for check-in wizard when user was trying to sort dashboard
**Why it happens:** Global location handler without context checking
**How to avoid:** Check `ctx.scene.current` before handling; or use dedicated state tracking
**Warning signs:** Sharing location for dashboard triggers check-in flow or vice versa

### Pitfall 6: Message Too Long with All 11 Parks
**What goes wrong:** Telegram rejects message exceeding 4096 characters
**Why it happens:** Verbose formatting or too many parks
**How to avoid:** Use compact one-liner format as decided; test with max reasonable data
**Warning signs:** "MESSAGE_TOO_LONG" error from Telegram API

## Code Examples

Verified patterns from official sources and project codebase:

### Dashboard Message Formatting
```typescript
// Source: User decisions from CONTEXT.md + project pattern from profile.ts
interface ParkDisplay {
  name: string;
  distance?: number; // km
  totalDogs: number;
  small: number;
  medium: number;
  large: number;
  isUserHere: boolean;
}

function formatDashboard(
  parks: ParkDisplay[],
  sortMode: 'nearest' | 'most_dogs'
): string {
  const now = new Date();
  const timestamp = now.toLocaleTimeString('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  let message = `Live Dog Run Occupancy\nUpdated ${timestamp}\n\n`;

  const hasAnyDogs = parks.some(p => p.totalDogs > 0);
  if (!hasAnyDogs) {
    message += 'No dogs checked in right now.\n\n';
  }

  for (const park of parks) {
    const hereMarker = park.isUserHere ? ' [You are here]' : '';
    const distanceStr = park.distance !== undefined
      ? ` (${park.distance.toFixed(1)} km)`
      : '';

    message += `${park.name}${distanceStr}: `;
    message += formatSizeBreakdown(park.small, park.medium, park.large);
    message += `${hereMarker}\n`;
  }

  return message;
}
```

### Building Dashboard Keyboard
```typescript
// Source: Telegraf docs + project pattern from profile.ts
import { Markup } from 'telegraf';

function buildDashboardKeyboard(currentSort: 'nearest' | 'most_dogs') {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        currentSort === 'nearest' ? 'Nearest' : 'Nearest',
        'sort_nearest'
      ),
      Markup.button.callback(
        currentSort === 'most_dogs' ? 'Most Dogs' : 'Most Dogs',
        'sort_most_dogs'
      ),
    ],
    [Markup.button.callback('Refresh', 'refresh_dashboard')],
  ]);
}
```

### Aggregation Query
```typescript
// Source: PostgreSQL FILTER clause docs + project sessionRepository.ts pattern
const result = await pool.query<{
  location_id: number;
  location_name: string;
  latitude: string;
  longitude: string;
  total_dogs: string;
  small_count: string;
  medium_count: string;
  large_count: string;
}>(`
  SELECT
    l.id as location_id,
    l.name as location_name,
    l.latitude,
    l.longitude,
    COALESCE(COUNT(sd.dog_id), 0) as total_dogs,
    COALESCE(COUNT(sd.dog_id) FILTER (WHERE d.size = 'Small'), 0) as small_count,
    COALESCE(COUNT(sd.dog_id) FILTER (WHERE d.size = 'Medium'), 0) as medium_count,
    COALESCE(COUNT(sd.dog_id) FILTER (WHERE d.size = 'Large'), 0) as large_count
  FROM locations l
  LEFT JOIN sessions s ON s.location_id = l.id AND s.status = 'active'
  LEFT JOIN session_dogs sd ON sd.session_id = s.id
  LEFT JOIN dogs d ON d.id = sd.dog_id
  GROUP BY l.id, l.name, l.latitude, l.longitude
  ORDER BY l.name
`);

// Note: pg returns counts as strings, parse to numbers
const occupancy = result.rows.map(row => ({
  locationId: row.location_id,
  locationName: row.location_name,
  latitude: parseFloat(row.latitude),
  longitude: parseFloat(row.longitude),
  totalDogs: parseInt(row.total_dogs, 10),
  small: parseInt(row.small_count, 10),
  medium: parseInt(row.medium_count, 10),
  large: parseInt(row.large_count, 10),
}));
```

### Distance Sorting
```typescript
// Source: haversine-distance npm docs + project geofence.ts pattern
import haversineDistance from 'haversine-distance';

function sortByDistance(
  parks: OccupancyData[],
  userLat: number,
  userLon: number
): OccupancyData[] {
  return parks
    .map(park => ({
      ...park,
      distanceMeters: haversineDistance(
        { latitude: userLat, longitude: userLon },
        { latitude: park.latitude, longitude: park.longitude }
      ),
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .map(park => ({
      ...park,
      distanceKm: park.distanceMeters / 1000,
    }));
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| CASE WHEN for conditional counts | FILTER clause | PostgreSQL 9.4+ | Cleaner syntax, slightly better performance |
| Extra.markup() for keyboards | Markup.inlineKeyboard() | Telegraf 4.x | Type-safe, simpler API |
| ctx.telegram.editMessageText() | ctx.editMessageText() | Telegraf 4.x | Context shortcuts handle chat_id/message_id automatically |

**Deprecated/outdated:**
- Telegraf `Extra.markup()`: Replaced by direct Markup usage in Telegraf 4.x
- `ctx.reply().then(msg => ...)` pattern: Use async/await consistently

## Open Questions

Things that couldn't be fully resolved:

1. **Location fallback when user declines sharing**
   - What we know: User might cancel location share; CONTEXT.md mentions "fall back to Most Dogs sort?"
   - What's unclear: Whether to show an error message or silently fall back
   - Recommendation: Show brief message "Location not shared. Showing by Most Dogs." then render that sort

2. **Dashboard state between location share and result**
   - What we know: When user clicks "Nearest", we send reply keyboard, then need to edit/update
   - What's unclear: Should we delete the original dashboard message or leave it?
   - Recommendation: Leave original, send new sorted dashboard after location, with "remove_keyboard"

3. **Concurrent dashboard users**
   - What we know: Multiple users can view /live simultaneously
   - What's unclear: Whether high concurrency would cause issues
   - Recommendation: Each request is independent read-only query; no locking needed

## Sources

### Primary (HIGH confidence)
- Telegraf 4.16.3 Context documentation - editMessageText, reply methods
- PostgreSQL 18 Aggregate Functions - FILTER clause for conditional counting
- Project codebase - sessionRepository.ts, profile.ts, checkInWizard.ts patterns

### Secondary (MEDIUM confidence)
- [Telegram Bot API documentation](https://core.telegram.org/bots/api) - KeyboardButton request_location limitation
- [haversine-distance npm](https://www.npmjs.com/package/haversine-distance) - Returns meters, accepts {latitude, longitude}
- [Telegraf GitHub issues](https://github.com/telegraf/telegraf/issues/464) - editMessageText with inline keyboard patterns

### Tertiary (LOW confidence)
- Community patterns for dashboard refresh - general best practice, not verified with Telegraf specifically

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use, verified in package.json
- Architecture: HIGH - Patterns directly from existing codebase, verified
- Query patterns: HIGH - PostgreSQL FILTER clause is documented standard
- Location flow: MEDIUM - Telegram API limitation is documented, but flow design is recommended pattern
- Pitfalls: MEDIUM - Based on general Telegram bot experience and API constraints

**Research date:** 2026-01-30
**Valid until:** 2026-02-28 (30 days - stable domain, no breaking changes expected)
