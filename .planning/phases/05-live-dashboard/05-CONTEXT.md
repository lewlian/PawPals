---
phase: 05-live-dashboard
discussed: 2026-01-30
areas: [display-format, sorting-filtering, empty-edge-states, refresh-staleness]
---

# Phase 5: Live Dashboard Context

**Phase Goal:** Users can see real-time occupancy of all dog runs with size breakdowns before visiting

## User Decisions

### Display Format & Layout

| Decision | Choice | Notes |
|----------|--------|-------|
| Entry format | Compact one-liner | "West Coast Park: 5 dogs (2S, 1M, 2L)" style |
| Parks to show | All parks | Include parks with 0 dogs for awareness |
| Size breakdown format | Abbreviated | Use 2S, 1M, 2L instead of "2 Small, 1 Medium, 2 Large" |
| Header content | With timestamp | Show "Updated 2:35 PM" at top of dashboard |

### Sorting & Filtering

| Decision | Choice | Notes |
|----------|--------|-------|
| Default sort | Nearest | User said "Nearest park at the top" - requires location |
| Sort button position | Below dashboard | Inline button after the park list |
| Distance display | Show in km | e.g., "West Coast Park (1.2 km): 5 dogs" |
| Sort buttons | Show both | "Nearest" and "Most Dogs" buttons available |

### Empty & Edge States

| Decision | Choice | Notes |
|----------|--------|-------|
| All parks empty | Hybrid | Friendly message "No dogs checked in right now" + show all parks |
| Profile required | No | /live works without a dog profile |
| Single size display | Simplify | Show "3 Small dogs" instead of "3 dogs (3S)" when only one size |
| Current location highlight | Yes | Show "📍 You're here" marker next to user's active session location |

### Refresh & Staleness

| Decision | Choice | Notes |
|----------|--------|-------|
| Refresh mechanism | Inline button | Add Refresh button that updates message in-place |
| Timestamp on refresh | Update it | Show fresh timestamp after each refresh |
| Location for nearest sort | Request fresh | Always ask for new location share for accuracy |
| Sort result display | Update in-place | Edit existing dashboard message with new sorted order |

## Implementation Notes

- Default to "Nearest" sort means /live will request location on first use
- Need to handle case where user declines location share (fall back to "Most Dogs" sort?)
- Refresh button callback: `refresh_dashboard`
- Sort button callbacks: `sort_nearest`, `sort_most_dogs`
- Current session marker requires checking user's active sessions before rendering

## Requirements Covered

- DASH-01: User can view live occupancy via /live command
- DASH-02: Dashboard shows all 11 dog runs with current dog count
- DASH-03: Each park shows size breakdown (abbreviated format)
- DASH-04: User can sort parks by "Most Dogs"
- DASH-05: User can sort parks by "Nearest to Me" (requires location)
- DASH-06: Dashboard updates in real-time (reflects current sessions)

---
*Context gathered: 2026-01-30*
