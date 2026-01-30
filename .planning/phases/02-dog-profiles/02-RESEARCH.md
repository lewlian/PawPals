# Phase 2: Dog Profiles - Research

**Researched:** 2026-01-30
**Domain:** Telegraf conversation flows, PostgreSQL user/dog data, inline keyboards
**Confidence:** HIGH

## Summary

This phase implements dog profile management for the PawPals SG Telegram bot. Users need to create profiles with name, size, breed, and age through a conversational flow. The existing codebase uses Telegraf 4.16.3 with PostgreSQL, and the project already has a `create_profile` callback action wired as a placeholder.

The recommended approach uses Telegraf's built-in **WizardScene** for multi-step conversation flows, **@telegraf/session** with PostgreSQL for session persistence (race-condition safe), and inline keyboards for size/breed selection. Dog breeds should be bundled as static data (no external API dependency) with a focus on breeds popular in Singapore.

**Primary recommendation:** Use WizardScene with PostgreSQL-backed sessions for the profile creation flow, store user/dog data in PostgreSQL with proper foreign key relationships, and implement inline keyboard selection for size and paginated breed search.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| telegraf | 4.16.3 | Bot framework | Already installed, provides Scenes/WizardScene |
| @telegraf/session | latest | Session persistence | Official adapter, race-condition safe since v4.12 |
| kysely | latest | SQL query builder | Required by @telegraf/session for PostgreSQL |
| pg | 8.17.2 | PostgreSQL driver | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | 4.3.6 | Validation | Already installed, use for input validation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| WizardScene | telegraf-wizard (npm) | More features but extra dependency, WizardScene is sufficient |
| @telegraf/session | telegraf-session-postgresql | Race conditions, not maintained by core team |
| Static breed list | Dog API (external) | Adds network dependency, latency, potential failures |

**Installation:**
```bash
npm install @telegraf/session kysely
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── bot/
│   ├── index.ts                 # Bot setup, session middleware, stage registration
│   ├── handlers/
│   │   └── profile.ts           # /profile command (show/manage existing profiles)
│   └── scenes/
│       └── createDogProfile.ts  # WizardScene for profile creation flow
├── db/
│   ├── client.ts                # Existing pool connection
│   ├── migrations/
│   │   ├── 0001-initial-schema.sql
│   │   └── 0002-users-dogs.sql  # New migration for users/dogs tables
│   └── repositories/
│       ├── userRepository.ts    # User CRUD operations
│       └── dogRepository.ts     # Dog CRUD operations
├── data/
│   └── breeds.ts                # Static dog breed list
└── types/
    └── session.ts               # Session type definitions
```

### Pattern 1: WizardScene for Multi-Step Profile Creation
**What:** Use Telegraf's built-in WizardScene for step-by-step data collection
**When to use:** Any multi-step conversational flow (profile creation, check-in, etc.)

**Example:**
```typescript
// Source: Telegraf official documentation & type definitions
import { Scenes, Markup } from 'telegraf';

// Define session data shape
interface ProfileWizardSession extends Scenes.WizardSessionData {
  dogData: {
    name?: string;
    size?: 'Small' | 'Medium' | 'Large';
    breed?: string;
    age?: number;
  };
}

// Create context type with session
interface BotContext extends Scenes.WizardContext<ProfileWizardSession> {}

// Create the wizard scene
const createDogProfileWizard = new Scenes.WizardScene<BotContext>(
  'create-dog-profile',
  // Step 1: Ask for name
  async (ctx) => {
    ctx.wizard.state.dogData = {};
    await ctx.reply('What is your dog\'s name?');
    return ctx.wizard.next();
  },
  // Step 2: Receive name, ask for size
  async (ctx) => {
    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('Please enter a name.');
      return;
    }
    ctx.wizard.state.dogData.name = ctx.message.text;
    await ctx.reply(
      'What size is your dog?',
      Markup.inlineKeyboard([
        [Markup.button.callback('Small (under 10kg)', 'size_Small')],
        [Markup.button.callback('Medium (10-25kg)', 'size_Medium')],
        [Markup.button.callback('Large (over 25kg)', 'size_Large')],
      ])
    );
    return ctx.wizard.next();
  },
  // ... more steps
);

// Handle size selection callback within the scene
createDogProfileWizard.action(/size_(.+)/, async (ctx) => {
  const size = ctx.match[1] as 'Small' | 'Medium' | 'Large';
  ctx.wizard.state.dogData.size = size;
  await ctx.answerCbQuery();
  // Continue to breed selection...
  return ctx.wizard.next();
});
```

### Pattern 2: Session Middleware with PostgreSQL Store
**What:** Configure session to persist across bot restarts using PostgreSQL
**When to use:** All bot setups that need conversation state

**Example:**
```typescript
// Source: @telegraf/session official docs
import { Telegraf, session } from 'telegraf';
import { Postgres } from '@telegraf/session/pg';
import { pool } from './db/client.js';

// Reuse existing pg pool
const store = Postgres({ pool });

const bot = new Telegraf<BotContext>(env.BOT_TOKEN);

// Session must come before stage middleware
bot.use(session({ store }));

const stage = new Scenes.Stage<BotContext>([createDogProfileWizard]);
bot.use(stage.middleware());
```

### Pattern 3: Inline Keyboard with Callback Data Encoding
**What:** Encode action + data in callback_data string, parse with regex
**When to use:** Any button that needs to pass parameters

**Example:**
```typescript
// Source: Telegraf tips (hanki.dev)
// Creating buttons with encoded data
const breedButtons = breeds.slice(offset, offset + 5).map(breed => [
  Markup.button.callback(breed, `breed_${breed}`)
]);

// Add pagination buttons
breedButtons.push([
  Markup.button.callback('< Prev', `breed_page_${page - 1}`),
  Markup.button.callback('Next >', `breed_page_${page + 1}`)
]);

await ctx.reply('Select breed:', Markup.inlineKeyboard(breedButtons));

// Handle with regex pattern
wizard.action(/breed_page_(\d+)/, async (ctx) => {
  const page = parseInt(ctx.match[1]);
  await showBreedPage(ctx, page);
});

wizard.action(/breed_(?!page)(.+)/, async (ctx) => {
  const breed = ctx.match[1];
  ctx.wizard.state.dogData.breed = breed;
  // Continue to next step
});
```

### Pattern 4: Breed Search with Filtering
**What:** Allow users to type breed name, filter and show matching options
**When to use:** Large lists where scrolling is impractical

**Example:**
```typescript
// In wizard step for breed selection
wizard.on('text', async (ctx) => {
  const searchTerm = ctx.message.text.toLowerCase();
  const matches = breeds.filter(b =>
    b.toLowerCase().includes(searchTerm)
  ).slice(0, 8); // Telegram max 8 buttons per row

  if (matches.length === 0) {
    await ctx.reply('No breeds found. Try "Golden", "Poodle", or type "Other".');
    return;
  }

  const buttons = matches.map(breed => [
    Markup.button.callback(breed, `breed_${breed}`)
  ]);
  buttons.push([Markup.button.callback('Other / Mixed', 'breed_Other')]);

  await ctx.reply('Select your dog\'s breed:', Markup.inlineKeyboard(buttons));
});
```

### Anti-Patterns to Avoid
- **Storing session in memory only:** Data lost on restart, use PostgreSQL store
- **Not calling ctx.answerCbQuery():** Leaves loading spinner on button, call immediately
- **Using ctx.session in WizardScene steps:** Use ctx.wizard.state for step data, ctx.session for global data
- **Hardcoding breed list in handler:** Extract to data module for maintainability
- **Not validating user input:** Always validate before storing (name length, age bounds)

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-step conversation | Custom state machine with ctx.session flags | WizardScene | Handles step navigation, back/forward, state isolation |
| Session persistence | Custom DB read/write on each message | @telegraf/session with Postgres store | Race-condition safe, handles serialization |
| Inline keyboard building | Manual JSON construction | Markup.inlineKeyboard + Markup.button.callback | Type-safe, handles hiding, cleaner code |
| Pagination | Custom offset tracking | Callback data encoding + regex handlers | Standard pattern, easy to maintain |

**Key insight:** Telegraf's built-in Scenes and official session package solve the complex state management problems. Custom solutions reintroduce race conditions and edge cases the framework handles.

## Common Pitfalls

### Pitfall 1: Session Middleware Order
**What goes wrong:** Scenes don't work, ctx.session is undefined
**Why it happens:** Session middleware must be registered before Stage middleware
**How to avoid:** Always `bot.use(session({ store }))` before `bot.use(stage.middleware())`
**Warning signs:** "Cannot read property 'session' of undefined" errors

### Pitfall 2: Not Answering Callback Queries
**What goes wrong:** Button shows loading spinner indefinitely
**Why it happens:** Telegram expects acknowledgment of button press
**How to avoid:** Always call `await ctx.answerCbQuery()` in action handlers
**Warning signs:** Spinning clock icon on buttons after clicking

### Pitfall 3: Telegram User ID Type
**What goes wrong:** ID comparison fails, or database errors
**Why it happens:** Telegram user IDs can exceed JavaScript's safe integer range and definitely exceed PostgreSQL INTEGER (2^31)
**How to avoid:** Use BIGINT in PostgreSQL, store as string or BigInt in JavaScript if needed
**Warning signs:** Incorrect user lookups, "integer out of range" errors

### Pitfall 4: WizardScene State vs Session
**What goes wrong:** Data persists unexpectedly or disappears
**Why it happens:** ctx.wizard.state is cleared on scene exit, ctx.session persists
**How to avoid:** Use wizard.state for in-progress form data, save to database before leaving scene
**Warning signs:** Old wizard data appearing in new flows

### Pitfall 5: Callback Data Length Limit
**What goes wrong:** Buttons don't work or throw errors
**Why it happens:** Telegram limits callback_data to 64 bytes
**How to avoid:** Use short codes, not full breed names if very long
**Warning signs:** Callback queries not received for buttons with long data

### Pitfall 6: Entering Scene Without Session Initialized
**What goes wrong:** Scene enter fails
**Why it happens:** Scene.enter() called before session middleware ran
**How to avoid:** Ensure session middleware is applied globally before any scene.enter() calls
**Warning signs:** Errors on scene entry, undefined session

## Code Examples

Verified patterns from official sources:

### Database Schema for Users and Dogs
```sql
-- Source: PostgreSQL best practices for Telegram bots
-- Migration: 0002-users-dogs.sql

-- Users table (create on first interaction)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  telegram_id BIGINT NOT NULL UNIQUE,
  first_name VARCHAR(255),
  username VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dogs table (belongs to user)
CREATE TABLE IF NOT EXISTS dogs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  size VARCHAR(10) NOT NULL CHECK (size IN ('Small', 'Medium', 'Large')),
  breed VARCHAR(100) NOT NULL,
  age INTEGER CHECK (age >= 0 AND age <= 30),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for user's dogs lookup
CREATE INDEX IF NOT EXISTS idx_dogs_user_id ON dogs(user_id);

-- Index for telegram user lookup
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
```

### TypeScript Session Type Definitions
```typescript
// Source: Telegraf type definitions (node_modules/telegraf/typings/scenes)
// File: src/types/session.ts

import { Scenes } from 'telegraf';

// Wizard-specific session data (cleared when scene exits)
export interface ProfileWizardState {
  dogData: {
    name?: string;
    size?: 'Small' | 'Medium' | 'Large';
    breed?: string;
    age?: number;
  };
}

// Extend WizardSessionData for our wizard
export interface ProfileWizardSession extends Scenes.WizardSessionData {
  // WizardSessionData already includes 'cursor'
}

// Global session data (persists across scenes)
export interface SessionData extends Scenes.SceneSession<ProfileWizardSession> {
  // Add any global session fields here
  userId?: number; // Database user ID once resolved
}

// Full bot context type
export interface BotContext extends Scenes.WizardContext<ProfileWizardSession> {
  session: SessionData;
}
```

### Static Dog Breed List (Singapore-focused)
```typescript
// Source: Popular breeds in Singapore research
// File: src/data/breeds.ts

export const DOG_SIZES = ['Small', 'Medium', 'Large'] as const;
export type DogSize = typeof DOG_SIZES[number];

// Curated list: Singapore popular breeds + common international breeds
// Sorted alphabetically for easier search
export const DOG_BREEDS = [
  'Beagle',
  'Bichon Frise',
  'Border Collie',
  'Cavalier King Charles Spaniel',
  'Chihuahua',
  'Cocker Spaniel',
  'Corgi',
  'Dachshund',
  'Dalmatian',
  'French Bulldog',
  'German Shepherd',
  'Golden Retriever',
  'Husky',
  'Jack Russell Terrier',
  'Japanese Spitz',
  'Labrador Retriever',
  'Maltese',
  'Miniature Pinscher',
  'Miniature Schnauzer',
  'Papillon',
  'Pekingese',
  'Pomeranian',
  'Poodle (Miniature)',
  'Poodle (Standard)',
  'Poodle (Toy)',
  'Pug',
  'Rottweiler',
  'Samoyed',
  'Schnauzer',
  'Shetland Sheepdog',
  'Shiba Inu',
  'Shih Tzu',
  'Siberian Husky',
  'Silky Terrier',
  'Singapore Special',  // Local mixed breed
  'Yorkshire Terrier',
  'Other / Mixed',
] as const;

export type DogBreed = typeof DOG_BREEDS[number];

// Search function for breed filtering
export function searchBreeds(query: string): string[] {
  const normalizedQuery = query.toLowerCase().trim();
  if (!normalizedQuery) return [];

  return DOG_BREEDS.filter(breed =>
    breed.toLowerCase().includes(normalizedQuery)
  );
}
```

### Complete WizardScene Setup
```typescript
// Source: Telegraf documentation + type definitions
// File: src/bot/scenes/createDogProfile.ts

import { Scenes, Markup, Composer } from 'telegraf';
import { message } from 'telegraf/filters';
import { BotContext } from '../../types/session.js';
import { DOG_BREEDS, DOG_SIZES, searchBreeds } from '../../data/breeds.js';

const BREEDS_PER_PAGE = 6;

// Step handlers as Composer for better organization
const nameStep = new Composer<BotContext>();
nameStep.on(message('text'), async (ctx) => {
  const name = ctx.message.text.trim();

  if (name.length < 1 || name.length > 50) {
    await ctx.reply('Please enter a valid name (1-50 characters).');
    return;
  }

  ctx.wizard.state.dogData = { name };

  const sizeButtons = DOG_SIZES.map(size => [
    Markup.button.callback(
      size === 'Small' ? 'Small (under 10kg)' :
      size === 'Medium' ? 'Medium (10-25kg)' : 'Large (over 25kg)',
      `size_${size}`
    )
  ]);

  await ctx.reply(
    `Great! ${name} is a lovely name.\n\nWhat size is ${name}?`,
    Markup.inlineKeyboard(sizeButtons)
  );
  return ctx.wizard.next();
});

// Create the wizard
export const createDogProfileWizard = new Scenes.WizardScene<BotContext>(
  'create-dog-profile',
  // Step 0: Ask for name
  async (ctx) => {
    // Initialize wizard state
    (ctx.wizard.state as any).dogData = {};
    await ctx.reply(
      'Let\'s create a profile for your dog!\n\n' +
      'What is your dog\'s name?'
    );
    return ctx.wizard.next();
  },
  // Step 1: Receive name (handled by Composer)
  nameStep,
  // Step 2: Breed selection (waiting for size callback first)
  async (ctx) => {
    // This step waits for breed selection
    // The action handlers below handle the actual interaction
  },
  // Step 3: Age input
  async (ctx) => {
    // Waiting for age input
  },
  // Step 4: Confirmation
  async (ctx) => {
    const { name, size, breed, age } = ctx.wizard.state.dogData;
    await ctx.reply(
      `Please confirm your dog's profile:\n\n` +
      `Name: ${name}\n` +
      `Size: ${size}\n` +
      `Breed: ${breed}\n` +
      `Age: ${age} years\n\n` +
      `Is this correct?`,
      Markup.inlineKeyboard([
        [Markup.button.callback('Yes, save profile', 'confirm_save')],
        [Markup.button.callback('No, start over', 'confirm_restart')],
      ])
    );
  }
);

// Size selection handler
createDogProfileWizard.action(/size_(.+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const size = ctx.match[1] as 'Small' | 'Medium' | 'Large';
  ctx.wizard.state.dogData.size = size;

  await ctx.editMessageText(
    `Size: ${size}\n\n` +
    'Now, type your dog\'s breed to search, or browse popular breeds:',
    Markup.inlineKeyboard([
      [Markup.button.callback('Browse popular breeds', 'breed_browse_0')],
    ])
  );
  return ctx.wizard.next();
});

// Breed browsing handler
createDogProfileWizard.action(/breed_browse_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery();
  const page = parseInt(ctx.match[1]);
  const start = page * BREEDS_PER_PAGE;
  const pageBreeds = DOG_BREEDS.slice(start, start + BREEDS_PER_PAGE);

  const buttons = pageBreeds.map(breed => [
    Markup.button.callback(breed, `breed_select_${breed}`)
  ]);

  // Pagination
  const navButtons = [];
  if (page > 0) {
    navButtons.push(Markup.button.callback('< Back', `breed_browse_${page - 1}`));
  }
  if (start + BREEDS_PER_PAGE < DOG_BREEDS.length) {
    navButtons.push(Markup.button.callback('More >', `breed_browse_${page + 1}`));
  }
  if (navButtons.length) buttons.push(navButtons);

  await ctx.editMessageText(
    'Select your dog\'s breed:\n(Or type to search)',
    Markup.inlineKeyboard(buttons)
  );
});

// Breed search (text input during breed step)
createDogProfileWizard.on(message('text'), async (ctx, next) => {
  // Only handle if we're on the breed step
  if (ctx.wizard.cursor !== 2) return next();

  const matches = searchBreeds(ctx.message.text);

  if (matches.length === 0) {
    await ctx.reply(
      'No matching breeds found. Try again or select "Other / Mixed".',
      Markup.inlineKeyboard([
        [Markup.button.callback('Other / Mixed', 'breed_select_Other / Mixed')],
        [Markup.button.callback('Browse all breeds', 'breed_browse_0')],
      ])
    );
    return;
  }

  const buttons = matches.slice(0, 6).map(breed => [
    Markup.button.callback(breed, `breed_select_${breed}`)
  ]);

  await ctx.reply('Matching breeds:', Markup.inlineKeyboard(buttons));
});

// Breed selection handler
createDogProfileWizard.action(/breed_select_(.+)/, async (ctx) => {
  await ctx.answerCbQuery();
  // Decode breed name (handle special chars)
  const breed = ctx.match[1];
  ctx.wizard.state.dogData.breed = breed;

  await ctx.editMessageText(`Breed: ${breed}`);
  await ctx.reply(
    `How old is ${ctx.wizard.state.dogData.name}?\n\n` +
    'Please enter age in years (0-30):'
  );
  return ctx.wizard.next();
});

// Age input handler (on step 3)
createDogProfileWizard.on(message('text'), async (ctx, next) => {
  if (ctx.wizard.cursor !== 3) return next();

  const age = parseInt(ctx.message.text);
  if (isNaN(age) || age < 0 || age > 30) {
    await ctx.reply('Please enter a valid age (0-30 years):');
    return;
  }

  ctx.wizard.state.dogData.age = age;
  return ctx.wizard.steps[4](ctx); // Go to confirmation step
});

// Confirmation handlers
createDogProfileWizard.action('confirm_save', async (ctx) => {
  await ctx.answerCbQuery('Saving profile...');

  const { name, size, breed, age } = ctx.wizard.state.dogData;
  const telegramId = ctx.from!.id;

  // TODO: Save to database
  // await dogRepository.createDog(telegramId, { name, size, breed, age });

  await ctx.editMessageText('Profile saved!');
  await ctx.reply(
    `${name}'s profile has been created!\n\n` +
    'Use /profile to view and manage your dog profiles.'
  );
  return ctx.scene.leave();
});

createDogProfileWizard.action('confirm_restart', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText('Let\'s start over.');
  return ctx.scene.reenter();
});

// Cancel command available at any step
createDogProfileWizard.command('cancel', async (ctx) => {
  await ctx.reply('Profile creation cancelled.');
  return ctx.scene.leave();
});
```

### Bot Index with Session and Stage Setup
```typescript
// Source: @telegraf/session + Telegraf docs
// File: src/bot/index.ts (updated)

import { Telegraf, Scenes, session } from 'telegraf';
import { Postgres } from '@telegraf/session/pg';
import { pool } from '../db/client.js';
import { validateEnv } from '../config/env.js';
import { BotContext } from '../types/session.js';
import { createDogProfileWizard } from './scenes/createDogProfile.js';
import { startHandler } from './handlers/start.js';
import { profileHandler } from './handlers/profile.js';

const env = validateEnv();

// Create session store using existing pool
const store = Postgres({ pool });

export const bot = new Telegraf<BotContext>(env.BOT_TOKEN);

// Global error handler
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
  ctx.reply('Sorry, something went wrong. Please try again.').catch(() => {});
});

// Session middleware MUST come before stage
bot.use(session({ store }));

// Create and register stage with all scenes
const stage = new Scenes.Stage<BotContext>([createDogProfileWizard]);
bot.use(stage.middleware());

// Register command handlers
bot.command('start', startHandler);
bot.command('profile', profileHandler);

// Handle "Create Dog Profile" button - enter the wizard scene
bot.action('create_profile', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('create-dog-profile');
});

// ... rest of handlers
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| telegraf-session-redis | @telegraf/session | v4.12 (2022) | Race-condition safety built-in |
| Manual state flags | Scenes.WizardScene | Telegraf 4.x | Cleaner conversation flow |
| ctx.wizard.state untyped | Generic WizardContext<T> | Telegraf 4.x | Type-safe wizard state |
| telegraf-flow | Built-in Scenes | Deprecated | Use Scenes module instead |

**Deprecated/outdated:**
- telegraf-flow: Deprecated, use built-in Scenes module
- telegraf-session-redis: Archived, use @telegraf/session with Redis store
- ctx.wizard.state.data pattern: Use direct properties on state object

## Open Questions

Things that couldn't be fully resolved:

1. **Kysely version compatibility**
   - What we know: @telegraf/session requires kysely for PostgreSQL
   - What's unclear: Exact version compatibility with pg 8.17.2
   - Recommendation: Install @telegraf/session, let npm resolve versions

2. **Session table auto-creation**
   - What we know: @telegraf/session stores in database
   - What's unclear: Whether it auto-creates the sessions table or needs migration
   - Recommendation: Check on first run, add migration if needed

3. **Breed list completeness**
   - What we know: ~35 popular breeds curated
   - What's unclear: Whether users will frequently need breeds not listed
   - Recommendation: Include "Other / Mixed" option, monitor feedback

## Sources

### Primary (HIGH confidence)
- Telegraf node_modules type definitions (node_modules/telegraf/typings/scenes/) - TypeScript interfaces verified
- [@telegraf/session GitHub](https://github.com/telegraf/session) - PostgreSQL store setup, race-condition handling
- [Telegraf WizardScene docs](https://telegraf.js.org/classes/scenes.wizardscene.html) - Official API reference

### Secondary (MEDIUM confidence)
- [Medium: Telegraf State Handling](https://medium.com/@habib23me/handling-state-in-telegraf-explained-easily-d8d53a336c4c) - WizardScene patterns
- [Telegraf tips (hanki.dev)](https://hanki.dev/telegraf-tips/) - Inline keyboard patterns, callback data
- [Singapore dog breeds research](https://www.knineculture.com/blogs/news/10-popular-dog-breeds-in-singapore-2023-which-is-right-for-you) - Local breed popularity

### Tertiary (LOW confidence)
- [Dog API (dog.ceo)](https://dog.ceo/dog-api/documentation/) - Breed list reference (not used, static preferred)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official packages, type definitions verified
- Architecture: HIGH - Patterns from official docs and installed type definitions
- Pitfalls: HIGH - Known issues documented in GitHub issues, verified in code
- Breed list: MEDIUM - Research-based, may need expansion based on user feedback

**Research date:** 2026-01-30
**Valid until:** 2026-03-01 (60 days - Telegraf ecosystem is stable)
