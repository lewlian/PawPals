# Phase 4: Session Automation - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Sessions expire automatically after selected duration with timely user notifications. Users receive a reminder before expiry with options to extend or checkout. Occupancy counts update when sessions end.

</domain>

<decisions>
## Implementation Decisions

### Notification content & tone
- Casual & friendly tone for reminders ("Hey! Your session at West Coast Park ends in 5 mins")
- Expiry notification includes summary with stats (park name, duration, dog names)
- Keep expiry message simple — no occupancy info, just session summary
- End with friendly sign-off ("See you next time!")

### Extension mechanics
- Unlimited extensions allowed per session
- Offer choice of durations on extend (15/30/60 min), same as check-in
- Every extension triggers a new 5-min reminder before new expiry
- If user taps extend after session expired: offer to start fresh check-in, not grace period

### Background job approach
- ~1 minute timing accuracy is acceptable (best effort)
- On bot restart, catch up immediately — process any missed expiries/reminders
- Track sent reminders in-memory (best effort, may re-send on restart near reminder time)

### Claude's Discretion
- Background job implementation (in-process polling vs external scheduler)
- Exact polling interval within the ~1 min accuracy constraint
- Reminder message content details (Claude picks what's useful without being cluttered)
- Exact message formatting and emoji usage

</decisions>

<specifics>
## Specific Ideas

- Extend buttons should match check-in duration options (15/30/60 min) for consistency
- Expired session "extend" tap should feel helpful, not like an error — guide to new check-in

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-session-automation*
*Context gathered: 2026-01-30*
