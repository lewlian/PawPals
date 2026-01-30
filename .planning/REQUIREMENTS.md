# Requirements: PawPals SG

**Defined:** 2025-01-29
**Core Value:** Dog owners can see exactly how many dogs are at a park right now, so they never arrive to find it empty or overcrowded with incompatible breeds.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Dog Profiles

- [x] **PROF-01**: User can create a dog profile with name
- [x] **PROF-02**: User can set dog size (Small/Medium/Large)
- [x] **PROF-03**: User can set dog breed from searchable list (with "Other" option)
- [x] **PROF-04**: User can set dog age
- [x] **PROF-05**: User can add multiple dogs to their account
- [x] **PROF-06**: User can view and edit their dog profiles
- [x] **PROF-07**: User can delete a dog profile

### Check-In

- [x] **CHKN-01**: User can initiate check-in via /checkin command
- [x] **CHKN-02**: Bot requests one-time location share from user
- [x] **CHKN-03**: System validates user is within 200m of a dog run (Haversine formula)
- [x] **CHKN-04**: User receives clear error if too far from any dog run
- [x] **CHKN-05**: User can select which dog(s) to check in (if multiple)
- [x] **CHKN-06**: User can select stay duration (15m, 30m, 60m) with 30m default
- [x] **CHKN-07**: User receives confirmation with check-in details

### Session Management

- [x] **SESS-01**: Sessions auto-expire after selected duration
- [x] **SESS-02**: User receives reminder 5 minutes before session expires
- [x] **SESS-03**: Expiry reminder includes "Extend 15min" and "Checkout" buttons
- [x] **SESS-04**: User can extend session by 15 minutes from reminder
- [x] **SESS-05**: User can manually check out anytime via /checkout command
- [x] **SESS-06**: Session ends immediately on manual checkout
- [x] **SESS-07**: Occupancy count decreases when session ends (expiry or checkout)

### Live Dashboard

- [x] **DASH-01**: User can view live occupancy via /live command
- [x] **DASH-02**: Dashboard shows all 11 dog runs with current dog count
- [x] **DASH-03**: Each park shows size breakdown (e.g., "3 Small, 2 Med, 1 Large")
- [x] **DASH-04**: User can sort parks by "Most Dogs" (default)
- [x] **DASH-05**: User can sort parks by "Nearest to Me" (requires location)
- [x] **DASH-06**: Dashboard updates in real-time (reflects current sessions)

### Locations

- [x] **LOCN-01**: System has 11 pre-loaded Singapore dog runs with coordinates
- [x] **LOCN-02**: Each location has: name, region, coordinates, notes
- [x] **LOCN-03**: Locations are: Bishan-AMK Park, West Coast Park, Jurong Lake Gardens, ECP Parkland Green, Katong Park, Sembawang Park, Yishun Park, Punggol Park, Tiong Bahru (Sit Wah), The Palawan (Sentosa), Mount Emily Park

### Bot Commands

- [x] **CMDS-01**: /start shows welcome message with "Create Dog Profile" button
- [x] **CMDS-02**: /profile shows/edits dog profiles
- [x] **CMDS-03**: /checkin initiates check-in flow
- [x] **CMDS-04**: /live shows occupancy dashboard
- [x] **CMDS-05**: /checkout ends current session

### UI Polish

- [ ] **UIPOL-01**: Bot has Telegram menu button showing all available commands
- [ ] **UIPOL-02**: Main screen shows reply keyboard with quick-access buttons (Check In, Live, Profile, Checkout)
- [ ] **UIPOL-03**: All messages use consistent emoji prefixes for headers and status indicators
- [ ] **UIPOL-04**: All inline buttons have emoji prefixes for visual clarity

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Profile Enhancements

- **PROF-08**: User can set dog temperament (Playful, Chill, Nervous)
- **PROF-09**: User can upload dog photo

### Social Features

- **SOCL-01**: User can add friends
- **SOCL-02**: User receives notification when friends check in
- **SOCL-03**: User can see friend activity in dashboard

### Location Enhancements

- **LOCN-04**: User can rate dog runs (1-5 stars)
- **LOCN-05**: User can leave reviews for dog runs
- **LOCN-06**: Dashboard shows historical busyness patterns

### Notifications

- **NOTF-01**: User can set alerts for specific parks ("Notify when 3+ large dogs at West Coast")
- **NOTF-02**: User can opt into daily digest of nearby activity

### Visual Features

- **VISL-01**: Telegram Mini-App with map view
- **VISL-02**: Photo sharing on check-in

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| In-app messaging | Telegram already does this — users can DM directly |
| Pet services marketplace | Different product vertical, massive scope |
| Full social feed | Keeps product utility-focused, not social media |
| Gamification (badges, streaks) | Distracting for utility app |
| Live location tracking | Battery drain, privacy concerns, over-engineered |
| Custom map implementation | Telegram bot UI constraints |
| User-submitted locations | Moderation burden, v1 has curated list |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CMDS-01 | Phase 1 | Complete |
| CMDS-02 | Phase 1 | Complete |
| CMDS-03 | Phase 1 | Complete |
| CMDS-04 | Phase 1 | Complete |
| CMDS-05 | Phase 1 | Complete |
| LOCN-01 | Phase 1 | Complete |
| LOCN-02 | Phase 1 | Complete |
| LOCN-03 | Phase 1 | Complete |
| PROF-01 | Phase 2 | Complete |
| PROF-02 | Phase 2 | Complete |
| PROF-03 | Phase 2 | Complete |
| PROF-04 | Phase 2 | Complete |
| PROF-05 | Phase 2 | Complete |
| PROF-06 | Phase 2 | Complete |
| PROF-07 | Phase 2 | Complete |
| CHKN-01 | Phase 3 | Complete |
| CHKN-02 | Phase 3 | Complete |
| CHKN-03 | Phase 3 | Complete |
| CHKN-04 | Phase 3 | Complete |
| CHKN-05 | Phase 3 | Complete |
| CHKN-06 | Phase 3 | Complete |
| CHKN-07 | Phase 3 | Complete |
| SESS-05 | Phase 3 | Complete |
| SESS-06 | Phase 3 | Complete |
| SESS-01 | Phase 4 | Complete |
| SESS-02 | Phase 4 | Complete |
| SESS-03 | Phase 4 | Complete |
| SESS-04 | Phase 4 | Complete |
| SESS-07 | Phase 4 | Complete |
| DASH-01 | Phase 5 | Complete |
| DASH-02 | Phase 5 | Complete |
| DASH-03 | Phase 5 | Complete |
| DASH-04 | Phase 5 | Complete |
| DASH-05 | Phase 5 | Complete |
| DASH-06 | Phase 5 | Complete |

| UIPOL-01 | Phase 7 | Not Started |
| UIPOL-02 | Phase 7 | Not Started |
| UIPOL-03 | Phase 7 | Not Started |
| UIPOL-04 | Phase 7 | Not Started |

**Coverage:**
- v1 requirements: 39 total
- Mapped to phases: 39
- Unmapped: 0

---
*Requirements defined: 2025-01-29*
*Last updated: 2025-01-29 after roadmap creation*
