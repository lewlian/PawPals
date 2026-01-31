# Phase 7: UI Polish - Context

**Gathered:** 2026-01-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Add intuitive quick-access menu buttons and consistent emoji styling throughout the bot. This covers Telegram's command menu, reply keyboard buttons, and emoji formatting for all messages. No new features — purely visual and UX improvements to existing functionality.

</domain>

<decisions>
## Implementation Decisions

### Reply Keyboard Layout
- 2x2 grid arrangement
- Button labels: emoji + short text
- Emoji choices:
  - 🟢 Check In (green = start/go)
  - 🔴 Checkout (red = stop/end)
  - 🐕 Profile (dog emoji)
  - 📊 Live (chart/stats)

### Reply Keyboard Behavior
- Claude's Discretion: When keyboard appears/hides
- Consider: persistent after /start, hide during wizards, return after

### Message Formatting — Welcome
- Emoji header + bullet benefits style
- Format:
  ```
  🐾 Welcome to PawPals SG!
  • Check dog park occupancy
  • See size breakdowns
  • Never arrive to empty parks
  [Create Profile button]
  ```

### Message Formatting — Dashboard
- Location pin emoji for park names
- Dog emoji for count
- Written-out size breakdown
- Format per park:
  ```
  📍 West Coast Park
  🐕 5 dogs • 2 Small, 2 Medium, 1 Large
  ```

### Message Formatting — Check-in Confirmation
- Checkmark header + structured details
- Format:
  ```
  ✅ Checked in!
  📍 West Coast Park
  🐕 Max, Bella
  ⏱️ 30 minutes
  ```

### Message Formatting — Expiry Reminders
- Clock focus style
- Format:
  ```
  ⏰ 5 minutes left!
  West Coast Park • Max, Bella
  [Extend 15min] [Checkout]
  ```

### Menu Command Descriptions
- Benefit-focused tone (tell users what they get, not just what it does)
- Claude drafts specific wording for all commands
- Claude's Discretion: Whether to include /start in menu

### Claude's Discretion
- Keyboard persistence timing (when to show/hide)
- Exact command description wording
- /start menu inclusion
- Emoji choices for inline buttons (Edit, Delete, Extend, Refresh, etc.)
- Any additional formatting details not specified

</decisions>

<specifics>
## Specific Ideas

- Check-in/checkout should feel opposite (🟢/🔴 like traffic lights — intuitive go/stop)
- Profile uses dog emoji 🐕 since that's what it manages
- Parks get location pin 📍 to reinforce "where"
- Benefit-focused descriptions help users understand value, not just function

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-ui-polish*
*Context gathered: 2026-01-31*
