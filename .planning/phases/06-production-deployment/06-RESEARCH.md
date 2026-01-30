# Phase 6: Production Deployment - Research

**Researched:** 2026-01-31
**Domain:** Telegram bot production deployment with Railway + webhooks
**Confidence:** HIGH

## Summary

Production deployment for Telegram bots requires three core changes: (1) switching from polling to webhook-based updates, (2) configuring Railway hosting with proper environment variables and PORT handling, and (3) implementing error monitoring with admin notifications. The standard approach uses Telegraf's `bot.launch({ webhook: {...} })` with environment-based mode switching, Railway's auto-generated SSL domains, and webhook secret tokens for security.

Railway provides zero-configuration deployment via GitHub integration with automatic SSL, dynamic port assignment, and instant deployments. Telegraf webhooks require HTTPS on specific ports (443, 80, 88, 8443) and support secret token validation. The user has decided to use Railway for hosting, Supabase for database, auto-deploy from GitHub, and admin notifications via Telegram.

**Primary recommendation:** Use environment-based launch configuration with `NODE_ENV` to auto-switch between polling (dev) and webhook (production), generate webhook secret with `crypto.randomBytes(32).toString('hex')`, and extend existing `bot.catch()` handler to send admin notifications via Telegram API.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Telegraf | 4.16.3 | Telegram bot framework | Already in use, native webhook support with `bot.launch()` |
| Railway CLI | Latest | Deployment platform | User decision - GitHub auto-deploy, free SSL, zero config |
| Supabase | Latest | PostgreSQL hosting | User decision - external database with dashboard |
| crypto (Node.js) | Built-in | Secret generation | Standard Node.js module for secure random tokens |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| dotenv | 17.2.3 | Local env loading | Already in use - dev environment only |
| zod | 4.3.6 | Env validation | Already in use - validate new env vars (WEBHOOK_SECRET, ADMIN_CHAT_ID) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Railway | Heroku, Render, Fly.io | User chose Railway for simplicity and auto-SSL |
| Webhook secret | URL secret path only | Secret token provides additional header-based validation |
| Railway domains | Custom domain | User chose Railway domain (*.railway.app) to avoid DNS setup |

**Installation:**
```bash
# No new dependencies needed - all tools already installed or built-in
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── config/
│   └── env.ts              # Add WEBHOOK_SECRET, ADMIN_CHAT_ID, PORT
├── bot/
│   └── index.ts            # Add admin notification to bot.catch()
├── index.ts                # Add environment-based launch logic
└── utils/
    └── notifications.ts    # (Optional) Helper for admin Telegram notifications
```

### Pattern 1: Environment-Based Launch Mode
**What:** Automatically switch between polling (dev) and webhook (production) based on NODE_ENV
**When to use:** When the same codebase runs locally and in production
**Example:**
```typescript
// Source: Telegraf.js docs + community patterns
import { bot } from './bot/index.js';
import { validateEnv } from './config/env.js';

const env = validateEnv();

async function main(): Promise<void> {
  console.log('Starting PawPals SG bot...');

  // Database connection check (already exists)
  const dbConnected = await checkConnection();
  if (!dbConnected) {
    console.error('Failed to connect to database. Exiting.');
    process.exit(1);
  }

  // Start background jobs (already exists)
  startAllJobs();

  // Environment-based launch
  if (env.NODE_ENV === 'production') {
    // Production: webhook mode
    const port = parseInt(env.PORT || '3000', 10);
    await bot.launch({
      webhook: {
        domain: env.WEBHOOK_DOMAIN,
        port: port,
        path: '/webhook',
        secretToken: env.WEBHOOK_SECRET,
      },
    });
    console.log(`Bot running in webhook mode on port ${port}`);
  } else {
    // Development: polling mode (current behavior)
    await bot.launch();
    console.log('Bot running in polling mode (development)');
  }

  console.log('Press Ctrl+C to stop');
}
```

### Pattern 2: Admin Error Notifications
**What:** Extend existing bot.catch() handler to send error details to admin via Telegram
**When to use:** Production error monitoring without external services
**Example:**
```typescript
// Source: Telegraf docs + community patterns
import { Telegraf } from 'telegraf';

const env = validateEnv();
export const bot = new Telegraf<BotContext>(env.BOT_TOKEN);

// Enhanced error handler with admin notifications
bot.catch(async (err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);

  // Try to reply to user (existing behavior)
  ctx.reply('Sorry, something went wrong. Please try again.').catch(() => {
    // Silent fail if we can't send error message
  });

  // Send error details to admin (production only)
  if (env.NODE_ENV === 'production' && env.ADMIN_CHAT_ID) {
    try {
      const errorMessage = `🚨 Bot Error\n\nType: ${ctx.updateType}\nError: ${err.message}\nStack: ${err.stack?.substring(0, 500) || 'N/A'}`;
      await bot.telegram.sendMessage(env.ADMIN_CHAT_ID, errorMessage);
    } catch (notifyErr) {
      console.error('Failed to send admin notification:', notifyErr);
    }
  }
});
```

### Pattern 3: Deployment Notifications
**What:** Send Telegram notification to admin when bot successfully starts in production
**When to use:** To confirm deployments succeeded and webhook is active
**Example:**
```typescript
// Source: Community pattern for production monitoring
async function main(): Promise<void> {
  console.log('Starting PawPals SG bot...');

  // ... database check, jobs start ...

  if (env.NODE_ENV === 'production') {
    await bot.launch({ webhook: { /* ... */ } });
    console.log(`Bot running in webhook mode on port ${port}`);

    // Notify admin of successful deployment
    if (env.ADMIN_CHAT_ID) {
      try {
        const deployMessage = `✅ PawPals SG Bot Deployed\n\nMode: Webhook\nTime: ${new Date().toISOString()}\nStatus: Running`;
        await bot.telegram.sendMessage(env.ADMIN_CHAT_ID, deployMessage);
      } catch (err) {
        console.error('Failed to send deployment notification:', err);
      }
    }
  } else {
    await bot.launch();
    console.log('Bot running in polling mode (development)');
  }
}
```

### Pattern 4: Railway PORT Configuration
**What:** Use process.env.PORT for dynamic port assignment with fallback
**When to use:** All Railway deployments (required)
**Example:**
```typescript
// Source: Railway docs - dynamic port assignment
// In env.ts validation schema
const envSchema = z.object({
  BOT_TOKEN: z.string().min(1),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Railway assigns PORT dynamically
  PORT: z.coerce.number().int().positive().default(3000),

  // Webhook configuration (production only)
  WEBHOOK_DOMAIN: z.string().optional(),
  WEBHOOK_SECRET: z.string().min(32).optional(),

  // Admin notifications
  ADMIN_CHAT_ID: z.string().optional(),

  // ... existing DB vars ...
});
```

### Anti-Patterns to Avoid
- **Mixing polling and webhooks:** Calling `bot.launch()` without parameters in production will use polling, which conflicts with webhook setup. Always check NODE_ENV.
- **Hardcoding ports:** Railway assigns ports dynamically. Never hardcode `port: 3000` in production webhook config.
- **Forgetting to clear webhook:** When switching back to dev, call `setWebhook` with empty URL to clear webhook: `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=`
- **Exposing secrets in logs:** Don't log WEBHOOK_SECRET or ADMIN_CHAT_ID values. Log "Webhook secret configured: true" instead.
- **Using http:// URLs:** Telegram only accepts HTTPS webhooks. Railway provides SSL automatically.
- **Registering commands after launch:** Bot commands must be registered before `bot.launch()`. Current code already does this correctly.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook secret generation | Custom random string generator | `crypto.randomBytes(32).toString('hex')` | Cryptographically secure, standard Node.js API, 256-bit entropy |
| Webhook signature verification | Custom HMAC validation | Telegraf's built-in `secretToken` parameter | Automatic validation via X-Telegram-Bot-Api-Secret-Token header |
| Environment variable parsing | Manual process.env checks | Existing zod validation in `env.ts` | Type-safe, validates at startup, already implemented |
| Database migrations | Run manually on deploy | Existing auto-migrate logic in `src/db/migrate.ts` | Already runs on startup, ensures schema is current |
| Process restart on crash | Custom crash detection | Railway's automatic restart policy | Built-in platform feature, no code needed |
| SSL certificate management | Self-signed certs, Let's Encrypt setup | Railway auto-generated domains | Free SSL included, zero configuration |

**Key insight:** Railway handles infrastructure concerns (SSL, restarts, port assignment) automatically. Telegraf handles webhook security (secret token validation) automatically. Focus implementation on business logic: environment switching, admin notifications, and configuration validation.

## Common Pitfalls

### Pitfall 1: Webhook Not Cleared from Previous Setup
**What goes wrong:** Bot doesn't respond to messages locally. Telegram sends updates to old webhook URL instead of getUpdates API.
**Why it happens:** Setting webhook persists until explicitly cleared. Starting bot with polling doesn't automatically clear webhook.
**How to avoid:** Clear webhook before local development: `curl https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=`
**Warning signs:** Bot launches successfully but never receives updates. No errors in logs. `/start` command gets no response.

### Pitfall 2: Port Mismatch in Railway
**What goes wrong:** Railway shows "Application failed to respond" error. Bot starts but Railway can't reach it.
**Why it happens:** Bot listens on hardcoded port (e.g., 3000) but Railway assigns different port dynamically.
**How to avoid:** Always use `process.env.PORT` in webhook configuration. Add PORT to env schema with coercion.
**Warning signs:** Logs show "Bot running on port 3000" but Railway deployment fails health check.

### Pitfall 3: Missing WEBHOOK_DOMAIN in Production
**What goes wrong:** Bot crashes on startup with "domain is required" error.
**Why it happens:** Webhook config requires domain but Railway domain isn't set as environment variable.
**How to avoid:** Set WEBHOOK_DOMAIN in Railway dashboard after first deploy. Use Railway-provided domain (e.g., `pawpals-sg-production.up.railway.app`).
**Warning signs:** Deployment logs show error immediately after "Starting bot..." message.

### Pitfall 4: Telegram Rejects Webhook (Unsupported Port)
**What goes wrong:** setWebhook returns "Bad Request: wrong port specified". Telegram won't accept webhook.
**Why it happens:** Telegram only supports ports 443, 80, 88, 8443. Railway might assign different port internally.
**How to avoid:** Railway proxies to your app - your app listens on any PORT, but Railway exposes HTTPS on 443 externally. Use Railway's PORT for your app, not for webhook config.
**Warning signs:** Bot launches but webhook setup fails. Manual setWebhook test returns error.

### Pitfall 5: bot.catch() Not Catching Polling Errors
**What goes wrong:** Bot crashes on startup despite having bot.catch() handler.
**Why it happens:** bot.catch() only catches errors in handleUpdate (message handlers), not polling connection errors.
**How to avoid:** Wrap `bot.launch()` in try-catch. Let Railway restart on crash. In production, webhook mode avoids polling connection errors.
**Warning signs:** Bot works fine locally but crashes immediately in production during startup.

### Pitfall 6: Admin Notifications Create Infinite Loop
**What goes wrong:** Single error triggers dozens of admin messages. Bot becomes unresponsive.
**Why it happens:** Error in notification code triggers bot.catch(), which tries to notify again, causing another error.
**How to avoid:** Wrap admin notification in try-catch. Never throw from notification code. Log notification failures to console only.
**Warning signs:** Admin receives multiple identical error messages within seconds. Bot stops responding to users.

### Pitfall 7: Secrets Committed to Git
**What goes wrong:** WEBHOOK_SECRET or bot token exposed in public repository.
**Why it happens:** Adding secrets directly to .env file, then accidentally committing it.
**How to avoid:** Verify .env is in .gitignore (already done). Set production secrets only in Railway dashboard Variables tab.
**Warning signs:** GitHub security alert. Unexpected bot behavior from unauthorized requests.

### Pitfall 8: Wrong Webhook Path
**What goes wrong:** Telegram sends updates to /webhook but Railway routes show 404. Bot never receives messages.
**Why it happens:** Telegraf creates webhook handler at specified path, but Railway doesn't know about it. Telegram sees 404 as failure.
**How to avoid:** Telegraf's `bot.launch({ webhook: { path: '/webhook' }})` automatically creates HTTP server listening at that path. No Express/routing needed.
**Warning signs:** Railway logs show no incoming requests. Telegram webhook info shows errors.

## Code Examples

Verified patterns from official sources:

### Generating Webhook Secret (One-Time Setup)
```typescript
// Source: Node.js crypto module + Telegram Bot API docs
// Run this locally ONCE to generate secret, then add to Railway env vars
import crypto from 'crypto';

const secret = crypto.randomBytes(32).toString('hex');
console.log('WEBHOOK_SECRET:', secret);
// Copy output to Railway dashboard Variables tab
// Length: 64 characters (32 bytes hex-encoded)
```

### Environment Variable Schema Extension
```typescript
// Source: Zod docs + existing pattern in src/config/env.ts
import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  // Existing vars
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().default('pawpals'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // New production vars
  PORT: z.coerce.number().int().positive().default(3000),
  WEBHOOK_DOMAIN: z.string().optional(), // e.g., pawpals-sg.up.railway.app
  WEBHOOK_SECRET: z.string().min(32).optional(), // Generated token
  ADMIN_CHAT_ID: z.string().optional(), // Telegram chat ID for notifications
});
```

### Complete Production Launch Configuration
```typescript
// Source: Telegraf LaunchOptions docs + Railway best practices
// In src/index.ts main() function
async function main(): Promise<void> {
  console.log('Starting PawPals SG bot...');

  // Verify database connection (existing)
  const dbConnected = await checkConnection();
  if (!dbConnected) {
    console.error('Failed to connect to database. Exiting.');
    process.exit(1);
  }
  console.log('Database connected');

  // Start background jobs (existing)
  startAllJobs();

  // Environment-based launch configuration
  if (env.NODE_ENV === 'production') {
    // Production: webhook mode
    if (!env.WEBHOOK_DOMAIN) {
      console.error('WEBHOOK_DOMAIN is required in production');
      process.exit(1);
    }

    const port = parseInt(env.PORT || '3000', 10);

    await bot.launch({
      webhook: {
        domain: env.WEBHOOK_DOMAIN,
        port: port,
        path: '/webhook',
        secretToken: env.WEBHOOK_SECRET,
      },
    });

    console.log(`Bot running in webhook mode`);
    console.log(`Webhook: https://${env.WEBHOOK_DOMAIN}/webhook`);
    console.log(`Port: ${port}`);
    console.log(`Secret token: ${env.WEBHOOK_SECRET ? 'configured' : 'not set (optional)'}`);

    // Send deployment notification to admin
    if (env.ADMIN_CHAT_ID) {
      try {
        const deployMessage =
          '✅ PawPals SG Bot Deployed\n\n' +
          `Mode: Webhook\n` +
          `Time: ${new Date().toISOString()}\n` +
          `Status: Running`;
        await bot.telegram.sendMessage(env.ADMIN_CHAT_ID, deployMessage);
        console.log('Deployment notification sent to admin');
      } catch (err) {
        console.error('Failed to send deployment notification:', err);
        // Don't exit - notification failure shouldn't stop bot
      }
    }
  } else {
    // Development: polling mode (existing behavior)
    await bot.launch();
    console.log('Bot running in polling mode (development)');
  }

  console.log('Press Ctrl+C to stop');
}
```

### Enhanced Error Handler with Admin Notifications
```typescript
// Source: Telegraf docs + production monitoring patterns
// In src/bot/index.ts
import { Telegraf } from 'telegraf';
import { validateEnv } from '../config/env.js';

const env = validateEnv();
export const bot = new Telegraf<BotContext>(env.BOT_TOKEN);

// Enhanced global error handler
bot.catch(async (err, ctx) => {
  const errorType = ctx.updateType;
  console.error(`Error for ${errorType}:`, err);

  // Try to reply to user (existing behavior - graceful degradation)
  ctx.reply('Sorry, something went wrong. Please try again.').catch(() => {
    // Silent fail if we can't send error message to user
  });

  // Send error details to admin (production only)
  if (env.NODE_ENV === 'production' && env.ADMIN_CHAT_ID) {
    try {
      const errorMessage =
        '🚨 Bot Error\n\n' +
        `Type: ${errorType}\n` +
        `Error: ${err.message}\n` +
        `User: ${ctx.from?.id || 'unknown'}\n` +
        `Time: ${new Date().toISOString()}\n\n` +
        `Stack: ${err.stack?.substring(0, 500) || 'N/A'}`;

      await bot.telegram.sendMessage(env.ADMIN_CHAT_ID, errorMessage);
    } catch (notifyErr) {
      // CRITICAL: Never throw from error handler
      // Log to console only - Railway will capture in deployment logs
      console.error('Failed to send admin notification:', notifyErr);
    }
  }
});
```

### Graceful Shutdown Enhancement
```typescript
// Source: Existing code in src/index.ts + Telegraf best practices
// No changes needed - existing shutdown handlers work for both modes

// Current code (keep as-is):
async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  try {
    stopAllJobs();
    bot.stop(signal); // Works for both polling and webhook
    console.log('Bot stopped');

    await closePool();
    console.log('Database pool closed');

    console.log('Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Self-signed SSL certs | Railway auto-SSL | 2020+ | Zero certificate management, instant HTTPS |
| Manual webhook setup via API | Telegraf `bot.launch({ webhook })` | Telegraf 4.0+ (2021) | Automatic webhook registration and server creation |
| External monitoring services (Sentry, etc.) | Direct admin Telegram notifications | Ongoing | Free, instant mobile alerts, no external dependencies |
| Hardcoded config files | Environment variables + validation | Modern standard | 12-factor app compliance, secure secrets management |
| PM2/systemd for restarts | Railway auto-restart | Platform feature | Zero configuration, automatic recovery |
| getWebhookInfo polling | Telegram X-Telegram-Bot-Api-Secret-Token header | Bot API 6.0+ (2022) | Stronger security via secret token validation |

**Deprecated/outdated:**
- **Manual setWebhook API calls:** Telegraf's `bot.launch({ webhook })` automatically registers webhook with Telegram and creates HTTP server. No need to call API directly.
- **Self-signed certificates:** Railway provides Let's Encrypt SSL. No need to generate, upload, or renew certificates manually.
- **Health check endpoints:** User decided against `/health` endpoint. Railway monitors process status directly. Bot stays alive via webhook listener.
- **Separate web server (Express):** Telegraf creates built-in HTTP server for webhooks. No need for Express unless serving other endpoints.

## Open Questions

Things that couldn't be fully resolved:

1. **ADMIN_CHAT_ID Retrieval**
   - What we know: User needs their Telegram chat ID for notifications. Can get it by messaging bot and logging ctx.from.id
   - What's unclear: Best UX for capturing this during setup vs. manual configuration
   - Recommendation: Add ADMIN_CHAT_ID as optional env var. Document how to get chat ID (send /start to bot, check logs for ctx.from.id, then add to Railway env vars). Bot works without it but admin doesn't receive notifications.

2. **Railway Deployment Timing for Webhook Setup**
   - What we know: Need Railway domain before setting WEBHOOK_DOMAIN env var. Domain generated after first deploy.
   - What's unclear: Whether bot will crash on first deploy without WEBHOOK_DOMAIN or gracefully fall back
   - Recommendation: Deploy once without webhook config (bot will use polling briefly), then add WEBHOOK_DOMAIN + redeploy to switch to webhook mode. Or add logic to fall back to polling if WEBHOOK_DOMAIN missing in production (warn but don't crash).

3. **Supabase Connection Pooling in Webhook Mode**
   - What we know: Current code uses pg pool (already configured). Webhook mode processes requests as they arrive.
   - What's unclear: Whether current pool settings (default) are optimal for webhook traffic pattern vs. polling
   - Recommendation: Keep existing pool configuration. Webhook mode has similar connection pattern to polling (sequential message handling). Monitor Railway metrics after deployment. Adjust pool size if needed.

4. **Database Migration Race Condition on Deploy**
   - What we know: Migrations run on startup (src/db/migrate.ts). Railway might run multiple instances.
   - What's unclear: Whether concurrent migrations from multiple instances could conflict
   - Recommendation: Railway defaults to single instance deployment unless horizontal scaling enabled. User chose single production environment. No scaling configured. Race condition unlikely. If scaling added later, use Railway's database migration job feature or add migration lock.

## Sources

### Primary (HIGH confidence)
- [Telegraf.js v4.16.3 Official Documentation](https://telegraf.js.org/) - Webhook setup, LaunchOptions interface
- [Telegraf LaunchOptions Interface](https://telegraf.js.org/interfaces/Telegraf.LaunchOptions.html) - Webhook parameters, secretToken
- [Telegram Bot API - setWebhook](https://core.telegram.org/bots/api#setwebhook) - Webhook requirements, supported ports, secret_token
- [Railway Express Deployment Guide](https://docs.railway.com/guides/express) - PORT configuration, auto-SSL
- [Railway Public Networking](https://docs.railway.com/guides/public-networking) - Domain generation, SSL certificates
- [Railway Zero-Downtime Deployment](https://docs.railway.com/guides/deploy-node-express-api-with-auto-scaling-secrets-and-zero-downtime) - Environment variables, auto-scaling
- [Railway Webhooks Documentation](https://docs.railway.com/guides/webhooks) - Deployment notifications
- [Telegram Webhook Requirements (Marvin's Guide)](https://core.telegram.org/bots/webhooks) - TLS 1.2+, certificate requirements
- [Telegram Self-Signed Certificates](https://core.telegram.org/bots/self-signed) - Certificate setup (not needed for Railway)
- Node.js crypto.randomBytes() - Built-in secure random generation

### Secondary (MEDIUM confidence)
- [Railway Environment Variables Guide](https://docs.railway.com/guides/variables) - Sealed variables, shared variables, best practices
- [GitHub Telegraf Discussions #1672](https://github.com/telegraf/telegraf/discussions/1672) - Webhook setup examples, community patterns
- [grammY - Long Polling vs. Webhooks](https://grammy.dev/guide/deployment-types) - When to use each mode
- [Hostman - Polling vs Webhook Guide](https://hostman.com/tutorials/difference-between-polling-and-webhook-in-telegram-bots/) - Decision criteria, tradeoffs
- [DEV Community - Node.js Railway Deployment](https://dev.to/arunangshu_das/how-to-deploy-a-nodejs-app-on-railway-in-under-10-minutes-1fem) - PORT configuration patterns
- [Webflow - Webhook Security Best Practices](https://webflow.com/blog/webhook-security) - Secret token patterns
- [GitHub - secure random values gist](https://gist.github.com/joepie91/7105003c3b26e65efcea63f3db82dfba) - crypto.randomBytes best practices

### Tertiary (LOW confidence)
- Community blog posts on Telegram bot deployment - Environment switching patterns, notification implementations

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in use (Telegraf 4.16.3) or platform choices already made (Railway, Supabase). Node crypto is standard built-in.
- Architecture: HIGH - Telegraf LaunchOptions documented in official docs. Railway PORT handling verified in official docs. Environment switching is common community pattern.
- Pitfalls: MEDIUM-HIGH - Webhook clearing, PORT mismatch, and error handler limitations verified in Telegraf issues and Railway docs. Other pitfalls based on common deployment mistakes.
- Don't hand-roll: HIGH - crypto.randomBytes documented as standard approach. Telegraf secretToken handles validation automatically per docs. Railway features documented officially.
- Code examples: HIGH - All examples based on official Telegraf LaunchOptions interface, Railway docs, and existing codebase patterns.

**Research date:** 2026-01-31
**Valid until:** 2026-02-28 (30 days) - Telegraf and Railway are stable platforms with infrequent breaking changes
