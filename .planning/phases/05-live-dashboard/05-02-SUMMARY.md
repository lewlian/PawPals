---
phase: 05-live-dashboard
plan: 02
subsystem: ui
tags: [telegram, location, haversine, callbacks, inline-keyboard, reply-keyboard]

# Dependency graph
requires:
  - phase: 05-live-dashboard/05-01
    provides: formatDashboard, sortByDogCount, buildDashboardKeyboard, getOccupancyByLocation, ParkDisplay type
provides:
  - sortByDistance function for geographic proximity sorting
  - Dashboard callback handlers (refresh, sort most dogs, sort nearest)
  - Location-based nearest park sorting with distance display
  - Reply keyboard for location request (Telegram API workaround)
affects: [production-deployment]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Reply keyboard for location request (inline buttons cannot request location)
    - editMessageText for in-place dashboard updates
    - Separate location handler for non-wizard location messages

key-files:
  created:
    - src/bot/handlers/dashboardCallbacks.ts
  modified:
    - src/bot/utils/dashboard.ts
    - src/bot/index.ts

key-decisions:
  - "Reply keyboard used for location request (Telegram inline button limitation)"
  - "Distance shown with 1 decimal place for user-friendly display"
  - "Location handler outside wizard processes as dashboard nearest sort"

patterns-established:
  - "Reply keyboard for location-dependent features"
  - "editMessageText for callback-triggered dashboard updates"

# Metrics
duration: 2min
completed: 2026-01-30
---

# Phase 5 Plan 2: Dashboard Interactivity Summary

**Dashboard refresh, sort by most dogs, and sort by nearest with location-based distance calculations using haversine formula**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-30T14:28:56Z
- **Completed:** 2026-01-30T14:30:58Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Added sortByDistance utility calculating km from user location to each park
- Created dashboard callback handlers for refresh, sort by dogs, and sort by nearest
- Integrated location handler to process nearest sort when user shares location
- Implemented reply keyboard workaround for Telegram's inline button location limitation

## Task Commits

Each task was committed atomically:

1. **Task 1: Add distance sorting utility** - `861de62` (feat)
2. **Task 2: Create dashboard callback handlers** - `f0b5450` (feat)
3. **Task 3: Register callbacks and location handler in bot** - `a562aa5` (feat)

## Files Created/Modified
- `src/bot/utils/dashboard.ts` - Added sortByDistance function using haversine-distance
- `src/bot/handlers/dashboardCallbacks.ts` - New file with all dashboard callback handlers
- `src/bot/index.ts` - Registered callbacks and updated location handler

## Decisions Made
- Reply keyboard used for location request since Telegram inline buttons cannot request location
- Distance rounded to 1 decimal place (e.g., "1.2 km") for user-friendly display
- Location messages outside wizard automatically processed as dashboard nearest sort
- Cancel button removes keyboard and shows guidance message

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 5 (Live Dashboard) complete
- All dashboard features implemented: occupancy display, refresh, sort by most dogs, sort by nearest
- Ready for Phase 6: Production Deployment (webhook setup, monitoring)

---
*Phase: 05-live-dashboard*
*Completed: 2026-01-30*
