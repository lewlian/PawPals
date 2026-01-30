---
phase: 03-core-check-in-out
plan: 02
subsystem: bot-commands
tags: [telegraf, scenes, wizard, location, geofence, sessions]

# Dependency graph
requires:
  - phase: 03-01
    provides: Session repository, geofence validation, CheckInWizardState type
  - phase: 02-01
    provides: Dog repository, user repository
  - phase: 01-03
    provides: Bot infrastructure, scene support

provides:
  - Check-in wizard scene with location validation
  - Multi-dog selection support
  - Duration selection (15/30/60 minutes)
  - Session creation with confirmation

affects: [03-03-checkin-handler, phase-4-session-automation, phase-5-live-dashboard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Location request with one-time keyboard"
    - "Multi-step wizard with callback handlers"
    - "Geofence validation with distance-based error messages"

key-files:
  created:
    - src/bot/scenes/checkInWizard.ts
  modified:
    - src/bot/handlers/checkout.ts

key-decisions:
  - "30-minute duration marked as default with star emoji"
  - "All Dogs button shown only when user has multiple dogs"
  - "Exit wizard immediately when geofence validation fails"
  - "Show dog breed in selection keyboard for clarity"

patterns-established:
  - "Wizard state managed via ctx.wizard.state with typed interface"
  - "Location keyboard uses Markup.button.locationRequest()"
  - "Geofence errors show distance in kilometers with one decimal"
  - "Confirmation messages use checkmark emoji and structured format"

# Metrics
duration: 2min
completed: 2026-01-30
---

# Phase 3 Plan 2: Check-In Wizard Summary

**Multi-step check-in wizard with GPS location validation, multi-dog selection, and configurable session duration**

## Performance

- **Duration:** 2 minutes
- **Started:** 2026-01-30T07:02:36Z
- **Completed:** 2026-01-30T07:04:46Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Location sharing request with one-time keyboard
- 200m geofence validation with clear distance-based error messaging
- Multi-dog selection with "All Dogs" shortcut for users with multiple profiles
- Three duration options (15/30/60 minutes) with 30 minutes marked as default
- Session creation with confirmation showing location, dogs, duration, and auto-checkout time
- Global cancel handler for wizard exit at any step

## Task Commits

Each task was committed atomically:

1. **Task 1: Create check-in wizard scene** - `479d291` (feat)

**Related commit:** `f141665` (feat: checkout handler from 03-01)

## Files Created/Modified
- `src/bot/scenes/checkInWizard.ts` - 5-step wizard scene: entry, location, dogs, dogCallback, duration
- `src/bot/handlers/checkout.ts` - Completed checkout implementation from 03-01 (previously uncommitted)

## Decisions Made

**1. 30-minute duration marked as default**
- Rationale: Most common dog run visit duration based on typical dog park usage patterns
- Implementation: Star emoji (⭐) added to 30-minute button label

**2. "All Dogs" button only shown for multiple dogs**
- Rationale: Reduces cognitive load for single-dog users by eliminating unnecessary choice
- Implementation: Conditional button prepend based on dogs.length > 1

**3. Exit wizard on geofence failure**
- Rationale: No recovery possible if user not at location - must physically move
- Implementation: ctx.scene.leave() immediately after error message

**4. Show dog breed in selection keyboard**
- Rationale: Helps users distinguish dogs with similar names (e.g., "Max" and "Maxi")
- Implementation: Button labels format: "DogName (Breed)"

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Checkout handler implementation**
- **Found during:** Git status check before commit
- **Issue:** Checkout handler was implemented in 03-01 but never committed. Without it, users cannot end sessions early.
- **Fix:** Committed existing checkout handler implementation that connects /checkout command to session repository with proper confirmation and error handling
- **Files modified:** src/bot/handlers/checkout.ts
- **Verification:** TypeScript compilation passes, file exports checkoutHandler function
- **Committed in:** f141665 (separate commit for 03-01 work)

**2. [Rule 3 - Blocking] TypeScript readonly state assignment**
- **Found during:** Initial TypeScript compilation
- **Issue:** ctx.wizard.state is readonly, cannot assign new object directly
- **Fix:** Modified stepEntry to set individual properties instead of reassigning entire state object
- **Files modified:** src/bot/scenes/checkInWizard.ts (lines 17-23)
- **Verification:** TypeScript compilation passes with no errors
- **Committed in:** 479d291 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Checkout handler fix ensures session management completeness. TypeScript fix required for compilation. No scope creep.

## Issues Encountered

None - wizard implementation followed established patterns from createDogProfile.ts scene.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for 03-03 (Check-in handler integration):**
- checkInWizard scene exports and ready for bot stage registration
- Wizard implements all requirements: location, geofence, dogs, duration, confirmation
- Error handling for edge cases: no dogs, invalid user, geofence failure
- Cancel handler allows exit from any step

**Remaining work in Phase 3:**
- Register checkInWizard scene with bot stage
- Create /checkin command handler to enter scene
- Add scene to bot initialization

**No blockers or concerns.**

---
*Phase: 03-core-check-in-out*
*Completed: 2026-01-30*
