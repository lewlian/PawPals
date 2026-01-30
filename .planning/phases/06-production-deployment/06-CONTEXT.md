---
phase: 06-production-deployment
discussed: 2026-01-30
areas: [hosting-platform, webhook-configuration, environment-secrets, monitoring-recovery]
---

# Phase 6: Production Deployment - Context

**Gathered:** 2026-01-30
**Status:** Ready for planning

## Phase Boundary

Take the working bot from development (polling mode) to production with webhooks, hosting, and reliability monitoring. No new features — deployment infrastructure only.

## User Decisions

### Hosting Platform

| Decision | Choice | Notes |
|----------|--------|-------|
| App hosting | Railway | Simple deploy from GitHub, auto-scaling |
| Database hosting | Supabase | Generous free tier, dashboard UI, external connection |
| Deploy trigger | Auto-deploy on push | Every push to main triggers deployment |
| Environments | Production only | Single environment, simpler setup |

### Webhook Configuration

| Decision | Choice | Notes |
|----------|--------|-------|
| Domain | Railway auto-generated | Use *.railway.app domain (free, instant SSL) |
| Webhook secret | Yes, use secret | Generate token for request verification |
| Webhook path | /webhook | Simple, standard path |
| Mode switching | Auto-switch | NODE_ENV: polling in dev, webhook in prod |

### Environment & Secrets

| Decision | Choice | Notes |
|----------|--------|-------|
| Secrets management | Claude's discretion | Railway env variables is the obvious choice |
| Dev vs Prod config | Separate | .env.local for dev, Railway variables for prod |
| Bot token | Same token | Use current bot in production |
| Migrations | Auto-migrate on start | Run migrations before bot starts |

### Monitoring & Recovery

| Decision | Choice | Notes |
|----------|--------|-------|
| Health check | No endpoint | Rely on Railway's default process monitoring |
| Restart policy | Auto-restart | Railway automatically restarts on crash |
| Error alerts | Console + Telegram | Log to console AND send to admin via Telegram |
| Deploy alerts | Yes | Send Telegram message on successful deployment |

## Implementation Notes

- Railway connects to external Supabase database via DATABASE_URL
- Webhook secret stored in WEBHOOK_SECRET env variable
- Admin Telegram chat ID needed for error/deploy notifications (ADMIN_CHAT_ID)
- Bot already has bot.catch() error handler — extend to send Telegram notifications
- Current code uses polling (bot.launch()) — need webhook setup (bot.launch({ webhook: {...} }))

## Requirements Covered

- (No feature requirements — deployment phase)

**Success Criteria from Roadmap:**
1. Bot responds to messages via webhook (not polling) with <2 second latency
2. Bot maintains uptime >99% over 7-day period
3. Webhook health monitoring shows zero certificate or configuration errors

---
*Context gathered: 2026-01-30*
