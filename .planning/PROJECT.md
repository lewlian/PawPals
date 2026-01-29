# PawPals SG

## What This Is

A Telegram bot that lets Singapore dog owners check the real-time occupancy of local dog runs before making the trip. Users check in when they arrive, and anyone can see how many dogs (and what sizes) are currently at each park.

## Core Value

Dog owners can see exactly how many dogs are at a park right now, so they never arrive to find it empty or overcrowded with incompatible breeds.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] User can create a dog profile (name, size, breed, temperament)
- [ ] User can manage multiple dogs
- [ ] User can check in to a dog run via location share (geofenced, 200m threshold)
- [ ] User can select check-in duration (15m, 30m, 60m)
- [ ] Sessions auto-expire after selected duration
- [ ] User receives reminder before session expires with extend/checkout options
- [ ] User can manually check out at any time
- [ ] User can view live occupancy of all dog runs (count + size breakdown)
- [ ] Dog runs sorted by "most dogs" in live view
- [ ] Pre-loaded list of 11 Singapore dog runs with coordinates

### Out of Scope

- Telegram Mini-App with visual map — Phase 2, adds complexity
- Photo sharing on check-in — Phase 2, nice-to-have
- Custom alerts ("notify me when X dogs at Y park") — Phase 2 feature
- OAuth/social login — Telegram handles identity
- Web interface — Telegram-native only for MVP

## Context

**Target users:** Singapore dog owners, starting with the developer and friends

**Why Telegram:** Fast MVP path, no app store approval, familiar to Singapore users

**Chicken-and-egg problem acknowledged:** Will address growth/incentives after v1 works

**Singapore dog run ecosystem:** 11 popular locations pre-identified with approximate coordinates for geofencing (Bishan-AMK Park, West Coast Park, Jurong Lake Gardens, ECP Parkland Green, Katong Park, Sembawang Park, Yishun Park, Punggol Park, Tiong Bahru, The Palawan Sentosa, Mount Emily Park)

## Constraints

- **Platform**: Telegram Bot API — deliberate choice for fast MVP
- **Data storage**: PostgreSQL for users/dogs (permanent), Redis for sessions (TTL-based auto-expiry)
- **Geofencing**: Haversine formula, 200m threshold from park center
- **Location**: One-time share only (no tracking) — privacy-conscious design

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Telegram bot over native app | Faster MVP, no app store friction | — Pending |
| Redis for sessions | TTL handles auto-expiry automatically | — Pending |
| 200m geofence threshold | Close enough to verify presence, forgiving enough for GPS drift | — Pending |
| Size categories (Small/Medium/Large) | Matches Singapore HDB-approved classification, simple for users | — Pending |

---
*Last updated: 2025-01-29 after initialization*
