# PawPals SG

A Telegram bot that shows real-time dog run occupancy across Singapore. See how many dogs are at each park before you visit.

## The Problem

Dog owners in Singapore often arrive at dog runs only to find them empty (no playmates for their dog) or overcrowded with incompatible breeds. There's no way to know beforehand.

## The Solution

PawPals SG lets users check in when they arrive at a dog run. Anyone can see live occupancy - how many dogs are at each park right now, broken down by size (Small/Medium/Large).

## Features

### Dog Profiles
- Create profiles for your dogs with name, size, breed, and age
- Support for multiple dogs per account
- Easy editing and deletion

### Location-Based Check-In
- Share your location to check in (no continuous tracking)
- Geofence validation ensures you're actually at the park (200m radius)
- Select which dogs you're bringing
- Choose duration: 15, 30, or 60 minutes

### Session Management
- Automatic expiry after selected duration
- 5-minute reminder before session ends
- One-tap extend (15/30/60 min) or checkout
- Manual checkout anytime

### Live Dashboard
- Real-time occupancy for all 11 dog runs
- Size breakdown per park (e.g., "3 Small, 2 Medium, 1 Large")
- Sort by most dogs or nearest to you
- "You are here" marker when checked in

### Supported Dog Runs

| Park | Region |
|------|--------|
| Bishan-AMK Park | Central |
| West Coast Park | West |
| Jurong Lake Gardens | West |
| ECP Parkland Green | East |
| Katong Park | East |
| Sembawang Park | North |
| Yishun Park | North |
| Punggol Park | North-East |
| Tiong Bahru (Sit Wah Road) | Central |
| The Palawan (Sentosa) | South |
| Mount Emily Park | Central |

## Tech Stack

- **Runtime:** Node.js with TypeScript (ESM)
- **Bot Framework:** Telegraf 4.16
- **Database:** PostgreSQL (Supabase)
- **Hosting:** Railway (webhook mode)
- **Geofencing:** Haversine formula

## Architecture

```
src/
├── bot/
│   ├── handlers/       # Command handlers (start, profile, live, checkout)
│   ├── scenes/         # Multi-step wizards (check-in, dog profile)
│   ├── utils/          # Dashboard formatting, geofence validation
│   ├── constants/      # Emoji definitions
│   └── keyboards/      # Reply keyboard layouts
├── db/
│   ├── repositories/   # Data access (users, dogs, sessions)
│   ├── migrations/     # SQL schema files
│   └── client.ts       # PostgreSQL connection pool
├── jobs/
│   └── sessionExpiry.ts # Background job for auto-expiry
├── config/
│   └── env.ts          # Environment validation (Zod)
└── index.ts            # Express webhook server
```

## Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message + quick-access buttons |
| `/profile` | Manage your dog profiles |
| `/checkin` | Check in at a dog run |
| `/checkout` | End your current session |
| `/live` | View live occupancy dashboard |

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Telegram Bot Token (from [@BotFather](https://t.me/botfather))

### Local Development

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your credentials

# Run migrations
npm run db:migrate

# Seed locations
npm run db:seed

# Start development server (polling mode)
npm run dev
```

### Environment Variables

```env
# Required
BOT_TOKEN=your_telegram_bot_token

# Database (use DATABASE_URL for production)
DATABASE_URL=postgresql://user:pass@host:port/db
# OR individual vars for local dev:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=pawpals
DB_USER=postgres
DB_PASSWORD=postgres

# Production only
NODE_ENV=production
PORT=8080
WEBHOOK_DOMAIN=your-app.up.railway.app
WEBHOOK_SECRET=your_64_char_secret
ADMIN_CHAT_ID=your_telegram_id
```

### Production Deployment (Railway)

1. Connect your GitHub repo to Railway
2. Add environment variables in Railway dashboard
3. Deploy - Railway auto-builds and runs `npm start`

The bot uses webhook mode in production for instant message handling.

## Demo Mode

Populate the database with fake check-ins for demos:

```bash
# Add demo data (expires in 30 minutes)
DATABASE_URL="your_prod_connection_string" npm run demo:seed

# Clear demo data
DATABASE_URL="your_prod_connection_string" npm run demo:clear
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Compile TypeScript |
| `npm start` | Run production server |
| `npm run db:migrate` | Run database migrations |
| `npm run db:seed` | Seed location data |
| `npm run demo:seed` | Add demo check-ins |
| `npm run demo:clear` | Remove demo data |

## Privacy

- **One-time location:** We only request location during check-in, no tracking
- **No photos:** Profile is text-only (name, size, breed, age)
- **Auto-expiry:** Sessions automatically end, no manual cleanup needed
- **Telegram auth:** No passwords, Telegram handles identity

## Contributing

This is a side project for the Singapore dog owner community. Issues and PRs welcome.

## License

MIT

---

Built with Telegraf + TypeScript + PostgreSQL
