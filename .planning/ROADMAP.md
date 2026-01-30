# Roadmap: PawPals SG

**Created:** 2025-01-29
**Milestone:** v1.0
**Phases:** 6
**Requirements:** 35 mapped

## Overview

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Foundation & Setup | Bot is responsive with seeded location data | 8 | 3 |
| 2 | Dog Profiles | Users can create and manage their dog profiles | 7 | 4 |
| 3 | Core Check-In/Out | Users can check in and out at dog runs with geofencing | 9 | 5 |
| 4 | Session Automation | Sessions expire automatically with user notifications | 5 | 4 |
| 5 | Live Dashboard | Users can see real-time occupancy before visiting | 6 | 4 |
| 6 | Production Deployment | Bot is running reliably in production with webhooks | 0 | 3 |

## Phases

### Phase 1: Foundation & Setup

**Goal:** Bot is responsive with seeded location data and basic command structure

**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md - Project setup with TypeScript and environment configuration
- [x] 01-02-PLAN.md - Database layer with PostgreSQL and location seeding
- [x] 01-03-PLAN.md - Telegram bot with all command handlers

**Status:** Complete (2026-01-30)

**Requirements:**
- **CMDS-01**: /start shows welcome message with "Create Dog Profile" button
- **CMDS-02**: /profile shows/edits dog profiles
- **CMDS-03**: /checkin initiates check-in flow
- **CMDS-04**: /live shows occupancy dashboard
- **CMDS-05**: /checkout ends current session
- **LOCN-01**: System has 11 pre-loaded Singapore dog runs with coordinates
- **LOCN-02**: Each location has: name, region, coordinates, notes
- **LOCN-03**: Locations are: Bishan-AMK Park, West Coast Park, Jurong Lake Gardens, ECP Parkland Green, Katong Park, Sembawang Park, Yishun Park, Punggol Park, Tiong Bahru (Sit Wah), The Palawan (Sentosa), Mount Emily Park

**Success Criteria:**
1. User can send /start and receive welcome message with interactive button
2. User can send any bot command (/profile, /checkin, /live, /checkout) and receive acknowledgment
3. Database contains all 11 Singapore dog runs with accurate coordinates and metadata

**Dependencies:** None (foundation phase)

---

### Phase 2: Dog Profiles

**Goal:** Users can create and manage their dog profiles with complete metadata

**Plans:** 3 plans

Plans:
- [x] 02-01-PLAN.md - Database schema, types, and repositories for users/dogs
- [x] 02-02-PLAN.md - Profile creation wizard with WizardScene
- [x] 02-03-PLAN.md - Profile viewing, editing, and deletion

**Status:** Complete (2026-01-30)

**Requirements:**
- **PROF-01**: User can create a dog profile with name
- **PROF-02**: User can set dog size (Small/Medium/Large)
- **PROF-03**: User can set dog breed from searchable list (with "Other" option)
- **PROF-04**: User can set dog age
- **PROF-05**: User can add multiple dogs to their account
- **PROF-06**: User can view and edit their dog profiles
- **PROF-07**: User can delete a dog profile

**Success Criteria:**
1. User can create a complete dog profile (name, size, breed, age) via conversational flow
2. User with multiple dogs can view a list of all their profiles
3. User can edit any field of an existing dog profile
4. User can delete a dog and confirm it no longer appears in their profile list

**Dependencies:** Phase 1 (bot infrastructure, /profile command)

---

### Phase 3: Core Check-In/Out

**Goal:** Users can check in and out at dog runs with accurate geofence validation

**Plans:** 3 plans

Plans:
- [x] 03-01-PLAN.md - Data layer (sessions table, session repository, geofence utility)
- [x] 03-02-PLAN.md - Check-in wizard (location, geofence, dog selection, duration)
- [x] 03-03-PLAN.md - Checkout handler and bot integration

**Status:** Complete (2026-01-30)

**Requirements:**
- **CHKN-01**: User can initiate check-in via /checkin command
- **CHKN-02**: Bot requests one-time location share from user
- **CHKN-03**: System validates user is within 200m of a dog run (Haversine formula)
- **CHKN-04**: User receives clear error if too far from any dog run
- **CHKN-05**: User can select which dog(s) to check in (if multiple)
- **CHKN-06**: User can select stay duration (15m, 30m, 60m) with 30m default
- **CHKN-07**: User receives confirmation with check-in details
- **SESS-05**: User can manually check out anytime via /checkout command
- **SESS-06**: Session ends immediately on manual checkout

**Success Criteria:**
1. User standing 50m from a dog run can share location and complete check-in successfully
2. User 300m away from nearest dog run receives rejection message explaining they're too far
3. User with 3 dogs can select which dogs to check in (single or multiple selection)
4. User receives confirmation showing park name, dog names, and selected duration
5. User can manually checkout and receive confirmation that session has ended

**Dependencies:** Phase 2 (dog profiles must exist to check in)

---

### Phase 4: Session Automation

**Goal:** Sessions expire automatically with timely user notifications and extension options

**Plans:** 2 plans

Plans:
- [x] 04-01-PLAN.md - Expiry queries and callback handlers for extend/checkout buttons
- [x] 04-02-PLAN.md - Background job for auto-expiry with proactive notifications

**Status:** Complete (2026-01-30)

**Requirements:**
- **SESS-01**: Sessions auto-expire after selected duration
- **SESS-02**: User receives reminder 5 minutes before session expires
- **SESS-03**: Expiry reminder includes "Extend 15min" and "Checkout" buttons
- **SESS-04**: User can extend session by 15 minutes from reminder
- **SESS-07**: Occupancy count decreases when session ends (expiry or checkout)

**Success Criteria:**
1. User checked in for 15 minutes is automatically checked out after exactly 15 minutes without any action
2. User receives notification 5 minutes before their session expires with interactive buttons
3. User can tap "Extend 15min" button and session duration increases by 15 minutes
4. When session expires or user checks out, occupancy count updates immediately

**Dependencies:** Phase 3 (active sessions must exist to expire)

---

### Phase 5: Live Dashboard

**Goal:** Users can see real-time occupancy of all dog runs with size breakdowns before visiting

**Plans:** 2 plans

Plans:
- [x] 05-01-PLAN.md - Core dashboard with occupancy query and display formatting
- [x] 05-02-PLAN.md - Dashboard interactivity (sort, refresh, nearest location)

**Status:** Complete (2026-01-30)

**Requirements:**
- **DASH-01**: User can view live occupancy via /live command
- **DASH-02**: Dashboard shows all 11 dog runs with current dog count
- **DASH-03**: Each park shows size breakdown (e.g., "3 Small, 2 Med, 1 Large")
- **DASH-04**: User can sort parks by "Most Dogs" (default)
- **DASH-05**: User can sort parks by "Nearest to Me" (requires location)
- **DASH-06**: Dashboard updates in real-time (reflects current sessions)

**Success Criteria:**
1. User sends /live and receives list of all 11 dog runs with current occupancy counts
2. Each park entry shows breakdown by size categories (e.g., "West Coast: 5 dogs - 2 Small, 1 Med, 2 Large")
3. Parks are sorted with most occupied at top by default
4. User can request location-based sorting and see parks ordered by proximity
5. When another user checks in or out, dashboard reflects changes within 60 seconds

**Dependencies:** Phase 4 (active sessions needed for meaningful occupancy data)

---

### Phase 6: Production Deployment

**Goal:** Bot is running reliably in production with webhook-based updates and monitoring

**Requirements:**
- (No new feature requirements - deployment phase)

**Success Criteria:**
1. Bot responds to messages via webhook (not polling) with <2 second latency
2. Bot maintains uptime >99% over 7-day period
3. Webhook health monitoring shows zero certificate or configuration errors

**Dependencies:** Phase 5 (all features complete and tested)

---

## Coverage Validation

All v1 requirements mapped: Yes

| Category | Requirements | Mapped | Coverage |
|----------|--------------|--------|----------|
| PROF (Dog Profiles) | 7 | 7 | 100% |
| CHKN (Check-In) | 7 | 7 | 100% |
| SESS (Session Management) | 7 | 7 | 100% |
| DASH (Live Dashboard) | 6 | 6 | 100% |
| LOCN (Locations) | 3 | 3 | 100% |
| CMDS (Bot Commands) | 5 | 5 | 100% |
| **Total** | **35** | **35** | **100%** |

### Requirement Distribution

**Phase 1:** CMDS-01, CMDS-02, CMDS-03, CMDS-04, CMDS-05, LOCN-01, LOCN-02, LOCN-03 (8 requirements)
**Phase 2:** PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, PROF-06, PROF-07 (7 requirements)
**Phase 3:** CHKN-01, CHKN-02, CHKN-03, CHKN-04, CHKN-05, CHKN-06, CHKN-07, SESS-05, SESS-06 (9 requirements)
**Phase 4:** SESS-01, SESS-02, SESS-03, SESS-04, SESS-07 (5 requirements)
**Phase 5:** DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06 (6 requirements)
**Phase 6:** (0 requirements - deployment only)

---
*Roadmap created: 2025-01-29*
