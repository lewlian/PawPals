---
phase: 07-ui-polish
plan: 01
subsystem: ui
tags: [telegram, reply-keyboard, menu-commands, emoji]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Bot infrastructure and Telegraf setup
  - phase: 03-core-check-in
    provides: Check-in wizard and checkout handler
  - phase: 05-live-dashboard
    provides: Live dashboard handler
provides:
  - Telegram menu commands visible via "/" button
  - Persistent 2x2 reply keyboard with Check In, Checkout, Profile, Live buttons
  - Centralized emoji constants for consistent UI
  - Button text constants for hears() matching
affects: [07-02-emoji-styling]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Centralized emoji constants in src/bot/constants/emoji.ts
    - Reply keyboard definitions in src/bot/keyboards/
    - bot.hears() for reply keyboard button handling

key-files:
  created:
    - src/bot/constants/emoji.ts
    - src/bot/keyboards/mainMenu.ts
  modified:
    - src/bot/index.ts
    - src/bot/handlers/start.ts
    - src/index.ts

key-decisions:
  - "Persistent reply keyboard with resize() for compact display"
  - "Two-message approach for start: welcome with keyboard, then inline button"
  - "Menu commands registered at startup before bot launch"
  - "Button handlers skip if ctx.scene.current to avoid wizard interference"

patterns-established:
  - "EMOJI object with categorized emoji constants (headers, content, buttons)"
  - "BUTTON_TEXT object with exact strings for bot.hears() matching"
  - "Reply keyboard handlers placed before catch-all text handler"

# Metrics
duration: 3min
completed: 2026-01-31
---

# Phase 7 Plan 01: Menu Commands and Reply Keyboard Summary

**Telegram menu commands and persistent 2x2 reply keyboard with quick-access buttons for Check In, Checkout, Profile, and Live features**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-31T06:10:03Z
- **Completed:** 2026-01-31T06:12:41Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Menu commands visible when user taps "/" button in Telegram
- Persistent 2x2 reply keyboard appears after /start with Check In, Checkout, Profile, Live buttons
- Reply keyboard buttons trigger corresponding handlers
- Centralized emoji constants for consistent UI across the bot

## Task Commits

Each task was committed atomically:

1. **Task 1: Create emoji constants and main menu keyboard** - `ec4479f` (feat)
2. **Task 2: Wire menu commands, keyboard handlers, and update start** - `f8dd62f` (feat)

## Files Created/Modified
- `src/bot/constants/emoji.ts` - Centralized EMOJI and BUTTON_TEXT constants
- `src/bot/keyboards/mainMenu.ts` - Persistent 2x2 reply keyboard definition
- `src/bot/index.ts` - Reply keyboard button handlers with bot.hears()
- `src/bot/handlers/start.ts` - Welcome message with emoji and keyboard
- `src/index.ts` - setMyCommands() registration at startup

## Decisions Made
- **Persistent reply keyboard with resize():** Compact display that stays visible after button press
- **Two-message approach for start:** First message with welcome and keyboard, second with inline button for profile creation
- **Menu commands registered at startup:** setMyCommands() called before webhook setup or bot.launch()
- **Button handlers skip in wizard:** Check ctx.scene.current to avoid interfering with check-in wizard

## Deviations from Plan
None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Reply keyboard and menu commands operational
- Ready for 07-02 emoji styling plan
- All button handlers wire to existing features

---
*Phase: 07-ui-polish*
*Completed: 2026-01-31*
