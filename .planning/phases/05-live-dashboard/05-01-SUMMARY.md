---
phase: 05-live-dashboard
plan: 01
executed: 2026-01-30
duration: 3m
subsystem: dashboard
tags: [postgresql, aggregation, telegram-bot, formatting]

dependency-graph:
  requires: [04-session-automation]
  provides: [occupancy-data, dashboard-display, live-command]
  affects: [05-02-location-sorting]

tech-stack:
  added: []
  patterns: [postgresql-filter-clause, size-breakdown-formatting, inline-keyboard-sorting]

key-files:
  created:
    - src/types/dashboard.ts
    - src/bot/utils/dashboard.ts
  modified:
    - src/db/repositories/sessionRepository.ts
    - src/bot/handlers/live.ts

decisions:
  - id: filter-clause
    choice: PostgreSQL FILTER clause for conditional counting
    reason: Cleaner syntax than CASE WHEN, single pass aggregation
  - id: default-sort
    choice: Most Dogs as default sort (not Nearest)
    reason: Nearest requires location which Plan 02 handles
  - id: size-simplification
    choice: Single size shows "3 Small dogs" not "3 dogs (3S)"
    reason: More readable when only one size present

metrics:
  duration: 3m
  completed: 2026-01-30
---

# Phase 05 Plan 01: Core Dashboard Data Layer Summary

**Implemented /live command showing all 11 Singapore dog runs with real-time occupancy data and size breakdowns using PostgreSQL FILTER clause aggregation.**

## What Was Built

### 1. Dashboard Types (src/types/dashboard.ts)
- `OccupancyData`: Location with aggregated dog counts by size
- `ParkDisplay`: Extended with optional distance and isUserHere marker

### 2. Occupancy Query (src/db/repositories/sessionRepository.ts)
- `getOccupancyByLocation()`: Single aggregation query with LEFT JOIN
- Uses PostgreSQL FILTER clause for efficient size-based counting
- Returns all 11 locations even when they have 0 dogs
- Parses pg string counts to numbers

### 3. Dashboard Utilities (src/bot/utils/dashboard.ts)
- `formatSizeBreakdown()`: Abbreviated format (2S, 1M, 2L) with single-size simplification
- `sortByDogCount()`: Descending sort with alphabetical tiebreaker
- `formatDashboard()`: Complete dashboard with Singapore timezone timestamp
- `buildDashboardKeyboard()`: Inline buttons for Nearest, Most Dogs, Refresh

### 4. Live Command Handler (src/bot/handlers/live.ts)
- Replaced placeholder with full implementation
- Queries user's active session for "You are here" marker
- Sorts by most dogs by default
- Sends formatted dashboard with inline keyboard

## Commits

| Hash | Description |
|------|-------------|
| 70bae74 | feat(05-01): add occupancy aggregation query and dashboard types |
| 1eb0f0a | feat(05-01): add dashboard formatting utilities |
| 2f89e13 | feat(05-01): implement /live command with dashboard display |

## Requirements Completed

| ID | Requirement | Status |
|----|-------------|--------|
| DASH-01 | User can view live occupancy via /live command | Done |
| DASH-02 | Dashboard shows all 11 dog runs with current dog count | Done |
| DASH-03 | Each park shows size breakdown (abbreviated format) | Done |
| DASH-04 | Parks sorted by most dogs by default | Done |

## Deviations from Plan

None - plan executed exactly as written.

## Technical Notes

### PostgreSQL FILTER Clause
Used for efficient conditional counting in a single query:
```sql
COUNT(sd.dog_id) FILTER (WHERE d.size = 'Small') as small_count
```

### Size Breakdown Logic
- Zero dogs: "0 dogs"
- Single size: "3 Small dogs" (natural language)
- Mixed sizes: "5 dogs (2S, 1M, 2L)" (abbreviated)

### Dashboard Display Format
```
Live Dog Run Occupancy
Updated 10:35 PM

West Coast Park: 5 dogs (2S, 1M, 2L) [You are here]
Bishan Park: 3 Medium dogs
East Coast Park: 0 dogs
...
```

## Next Phase Readiness

**Ready for 05-02:**
- Inline keyboard buttons wired (sort_nearest, sort_most_dogs, refresh_dashboard)
- Callback handlers need implementation in Plan 02
- Location sorting requires reply keyboard flow for location sharing
- Distance calculation will use existing haversine-distance package

---
*Executed: 2026-01-30 | Duration: 3 minutes*
