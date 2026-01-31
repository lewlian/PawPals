# Phase 7: UI Polish - Research

**Researched:** 2026-01-31
**Domain:** Telegram Bot UI (Menu Commands, Reply Keyboards, Message Formatting)
**Confidence:** HIGH

## Summary

Phase 7 focuses on three distinct UI improvements: (1) Telegram menu commands via `setMyCommands`, (2) a persistent reply keyboard for quick-access buttons, and (3) consistent emoji styling throughout messages and buttons. All three are well-supported by Telegraf 4.16.3 and the Telegram Bot API.

The codebase currently has no menu commands set, uses reply keyboards only temporarily during wizards (check-in, location sharing), and has minimal emoji usage. The existing `Markup` patterns in the code are consistent and can be extended cleanly.

**Primary recommendation:** Implement in order - (1) menu commands at bot startup, (2) persistent reply keyboard shown after `/start` and hidden during wizards, (3) centralize message formatting with emoji prefixes in utility functions.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Telegraf | 4.16.3 | Bot framework with Markup helpers | Already in use, provides `setMyCommands`, `Markup.keyboard`, `Markup.button.*` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (None needed) | - | - | All functionality built into Telegraf |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Telegraf Markup | telegram-keyboard npm | Adds dependency for minimal gain; Telegraf's built-in is sufficient |
| Unicode emojis | Custom emoji via file_id | Custom emojis require Telegram Premium; standard Unicode is universal |

**Installation:**
```bash
# No new packages required - Telegraf 4.16.3 provides everything needed
```

## Architecture Patterns

### Recommended Project Structure
```
src/bot/
├── index.ts              # Add setMyCommands() call at startup
├── keyboards/            # NEW: Centralized keyboard definitions
│   └── mainMenu.ts       # Reply keyboard with 4 quick-access buttons
├── utils/
│   ├── dashboard.ts      # UPDATE: Add emoji formatting
│   └── messageFormat.ts  # NEW: Centralized message formatting with emojis
└── handlers/
    └── *.ts              # UPDATE: Use new formatting utilities
```

### Pattern 1: Menu Commands at Startup

**What:** Register bot commands with Telegram's command menu using `bot.telegram.setMyCommands()` at application startup.

**When to use:** Once at bot launch, before `bot.launch()` or webhook setup.

**Example:**
```typescript
// Source: Telegram Bot API + Telegraf docs
import { Telegraf } from 'telegraf';
import type { BotCommand } from 'telegraf/types';

const commands: BotCommand[] = [
  { command: 'checkin', description: 'Check in at a dog run' },
  { command: 'checkout', description: 'End your current session' },
  { command: 'live', description: 'See which parks have dogs now' },
  { command: 'profile', description: 'Manage your dog profiles' },
];

// Call BEFORE bot.launch() or webhook setup
await bot.telegram.setMyCommands(commands);
```

### Pattern 2: Persistent Reply Keyboard

**What:** A 2x2 reply keyboard that stays visible after `/start` and returns after wizard completion.

**When to use:** Show after `/start`, hide when entering wizard scenes, restore when leaving scenes.

**Example:**
```typescript
// Source: Telegraf 4.16.3 Markup class
import { Markup } from 'telegraf';

export const mainMenuKeyboard = Markup.keyboard([
  ['🟢 Check In', '🔴 Checkout'],
  ['🐕 Profile', '📊 Live'],
])
  .resize()      // Fits content height
  .persistent(); // Always visible when system keyboard hidden

// Usage in /start handler
await ctx.reply(welcomeMessage, mainMenuKeyboard);

// Hide during wizard entry
await ctx.reply('Sharing location...', Markup.removeKeyboard());

// Restore after wizard exit
await ctx.reply('Done!', mainMenuKeyboard);
```

### Pattern 3: Centralized Message Formatting

**What:** Utility functions that apply consistent emoji prefixes to message components.

**When to use:** All user-facing messages - welcome, dashboard, confirmations, reminders.

**Example:**
```typescript
// src/bot/utils/messageFormat.ts

export const EMOJI = {
  // Headers
  welcome: '🐾',
  checkedIn: '✅',
  checkedOut: '✅',
  reminder: '⏰',

  // Content
  location: '📍',
  dogs: '🐕',
  timer: '⏱️',

  // Buttons
  checkIn: '🟢',
  checkout: '🔴',
  profile: '🐕',
  live: '📊',
  extend: '➕',
  refresh: '🔄',
  edit: '✏️',
  delete: '🗑️',
  back: '◀️',
} as const;

export function formatWelcome(): string {
  return `${EMOJI.welcome} Welcome to PawPals SG!

• Check dog park occupancy
• See size breakdowns
• Never arrive to empty parks`;
}

export function formatCheckInConfirmation(
  location: string,
  dogNames: string[],
  durationMinutes: number
): string {
  return `${EMOJI.checkedIn} Checked in!
${EMOJI.location} ${location}
${EMOJI.dogs} ${dogNames.join(', ')}
${EMOJI.timer} ${durationMinutes} minutes`;
}
```

### Pattern 4: Reply Keyboard Button Handling

**What:** Reply keyboards send text messages, not callbacks. Handle with `bot.hears()`.

**When to use:** For the 4 quick-access buttons in the main menu keyboard.

**Example:**
```typescript
// Reply keyboard buttons trigger text messages, NOT callbacks
// Must use bot.hears() or text matching

// Option A: Exact text match
bot.hears('🟢 Check In', async (ctx) => {
  // Skip if inside a scene (wizard handles its own input)
  if (ctx.scene.current) return;
  await ctx.scene.enter('check-in-wizard');
});

// Option B: Regex for flexibility
bot.hears(/^🟢\s*Check\s*In$/i, checkinHandler);
```

### Anti-Patterns to Avoid

- **Using bot.action() for reply keyboards:** Reply keyboard buttons send text, not callback_data. Use `bot.hears()` instead.
- **Setting commands inside handlers:** Call `setMyCommands()` once at startup, not on every `/start`.
- **Hardcoding emojis everywhere:** Centralize in a constants file for consistency and easy updates.
- **Forgetting to restore keyboard after wizards:** Wizards that use `Markup.removeKeyboard()` must restore the main menu keyboard on exit.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Keyboard visibility control | Manual reply_markup objects | `Markup.keyboard().persistent().resize()` | Handles all Telegram API fields correctly |
| Command menu registration | Direct API calls | `bot.telegram.setMyCommands()` | Typed, handles errors |
| Keyboard removal | `{ reply_markup: { remove_keyboard: true } }` | `Markup.removeKeyboard()` | Cleaner, type-safe |
| Cross-platform emoji | Unicode escape sequences | Direct emoji characters in UTF-8 | Telegram uses UTF-8 natively, modern Node.js handles this |

**Key insight:** Telegraf's Markup class provides a fluent builder API that handles all the low-level Telegram Bot API structures. The chainable methods (`resize()`, `persistent()`, `oneTime()`) map directly to `ReplyKeyboardMarkup` fields.

## Common Pitfalls

### Pitfall 1: Reply Keyboard Text Mismatch
**What goes wrong:** Button text must match `bot.hears()` pattern exactly, including emojis and whitespace.
**Why it happens:** Reply keyboards send the exact button text as a message.
**How to avoid:** Define button text as constants and use the same constants in `bot.hears()`.
**Warning signs:** Quick-access buttons appear to do nothing.

### Pitfall 2: Keyboard Not Persisting
**What goes wrong:** Keyboard disappears after user sends a message.
**Why it happens:** `oneTime()` is true by default, or `persistent()` not called.
**How to avoid:** Always call `.persistent()` and `.oneTime(false)` for main menu keyboard.
**Warning signs:** User has to repeatedly invoke commands to see keyboard.

### Pitfall 3: Keyboard Interference with Wizards
**What goes wrong:** Main menu keyboard appears during check-in wizard, confusing the flow.
**Why it happens:** Wizard doesn't properly remove keyboard on entry.
**How to avoid:** Call `Markup.removeKeyboard()` when entering wizard, restore main keyboard on exit.
**Warning signs:** Two keyboards visible, or wizard text buttons visible during main flow.

### Pitfall 4: Command Descriptions Too Long
**What goes wrong:** Command descriptions get truncated on mobile.
**Why it happens:** Telegram truncates descriptions > ~22 characters on mobile UI.
**How to avoid:** Keep descriptions under 25 characters, test on mobile.
**Warning signs:** Descriptions show "..." on mobile.

### Pitfall 5: Emoji Rendering Inconsistency
**What goes wrong:** Some emojis render as boxes or different glyphs.
**Why it happens:** Using Unicode 12+ emojis that older devices don't support, or platform-specific emoji.
**How to avoid:** Use common Unicode 10/11 emojis (2017-2018). The emojis in CONTEXT.md are all safe.
**Warning signs:** Users report seeing boxes or different icons.

### Pitfall 6: setMyCommands Called Too Late
**What goes wrong:** Commands don't appear in menu until bot restarts again.
**Why it happens:** `setMyCommands` called after `bot.launch()` or in wrong order.
**How to avoid:** Call `await bot.telegram.setMyCommands()` before starting bot/webhook.
**Warning signs:** Menu shows old/no commands until user restarts chat.

## Code Examples

Verified patterns from official sources:

### Setting Bot Commands
```typescript
// Source: Telegram Bot API docs + Telegraf typings
import type { BotCommand } from 'telegraf/types';

const commands: BotCommand[] = [
  { command: 'checkin', description: 'Check in at a dog run' },
  { command: 'checkout', description: 'End your session' },
  { command: 'live', description: 'See parks with dogs now' },
  { command: 'profile', description: 'Manage dog profiles' },
];

// In startup, before bot.launch() or webhook setup
await bot.telegram.setMyCommands(commands);
```

### Creating Persistent Reply Keyboard
```typescript
// Source: Telegraf 4.16.3 Markup class documentation
import { Markup } from 'telegraf';

export const mainMenuKeyboard = Markup.keyboard([
  [
    Markup.button.text('🟢 Check In'),
    Markup.button.text('🔴 Checkout'),
  ],
  [
    Markup.button.text('🐕 Profile'),
    Markup.button.text('📊 Live'),
  ],
])
  .resize()
  .persistent();
```

### Handling Reply Keyboard Button Presses
```typescript
// Source: Telegraf bot.hears() pattern
// Reply keyboards send text messages, not callbacks

const BUTTON_CHECK_IN = '🟢 Check In';
const BUTTON_CHECKOUT = '🔴 Checkout';
const BUTTON_PROFILE = '🐕 Profile';
const BUTTON_LIVE = '📊 Live';

bot.hears(BUTTON_CHECK_IN, async (ctx) => {
  if (ctx.scene.current) return; // Skip if in wizard
  await ctx.scene.enter('check-in-wizard');
});

bot.hears(BUTTON_CHECKOUT, async (ctx) => {
  if (ctx.scene.current) return;
  await checkoutHandler(ctx);
});

bot.hears(BUTTON_PROFILE, async (ctx) => {
  if (ctx.scene.current) return;
  await profileHandler(ctx);
});

bot.hears(BUTTON_LIVE, async (ctx) => {
  if (ctx.scene.current) return;
  await liveHandler(ctx);
});
```

### Adding Emojis to Inline Buttons
```typescript
// Source: Existing codebase pattern extended
import { Markup } from 'telegraf';

// Current (no emojis):
Markup.button.callback('Refresh', 'refresh_dashboard')

// Updated (with emojis):
Markup.button.callback('🔄 Refresh', 'refresh_dashboard')
Markup.button.callback('✏️ Edit Name', `edit_dog_name_${dogId}`)
Markup.button.callback('🗑️ Delete', `delete_dog_${dogId}`)
Markup.button.callback('◀️ Back', 'profile_list')
```

### Scene Exit with Keyboard Restoration
```typescript
// Source: Telegraf scene pattern
import { mainMenuKeyboard } from '../keyboards/mainMenu.js';

// At end of wizard (successful completion)
await ctx.reply(
  `${EMOJI.checkedIn} Checked in!
${EMOJI.location} ${locationName}
${EMOJI.dogs} ${dogNames.join(', ')}`,
  mainMenuKeyboard  // Restore keyboard
);
return ctx.scene.leave();

// On cancel
await ctx.reply('Check-in cancelled.', mainMenuKeyboard);
return ctx.scene.leave();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual keyboard JSON | `Markup.keyboard().persistent().resize()` | Telegraf 4.x | Cleaner API, type-safe |
| `keyboard.extra()` | Direct `Markup.keyboard()` return | Telegraf 4.0 | No more `.extra()` call needed |
| `is_persistent` in API | `.persistent()` method | Telegraf 4.x | Fluent builder support |

**Deprecated/outdated:**
- `.extra()` method: No longer needed in Telegraf 4.x, `Markup.keyboard()` returns usable object directly
- `Telegraf.Markup.keyboard()`: Use `Markup` import directly: `import { Markup } from 'telegraf'`

## Open Questions

Things that couldn't be fully resolved:

1. **Whether to include /start in command menu**
   - What we know: /start is available by default in Telegram's menu
   - What's unclear: Whether explicitly adding it improves discoverability
   - Recommendation: Omit /start (it's always available via Telegram's built-in button)

2. **Exact wording for command descriptions**
   - What we know: Must be under ~25 chars, benefit-focused per CONTEXT.md
   - What's unclear: User testing for clarity
   - Recommendation: Draft in plan, can be iterated post-implementation

3. **Keyboard behavior during dashboard location request**
   - What we know: `/live` -> "Nearest" sort currently shows location request keyboard
   - What's unclear: Should this also use main menu keyboard pattern?
   - Recommendation: Keep existing behavior (temporary location keyboard), restore main menu after

## Sources

### Primary (HIGH confidence)
- Telegraf.js v4.16.3 official docs - Markup class methods (persistent, resize, oneTime)
- Telegram Bot API - setMyCommands, ReplyKeyboardMarkup specification
- Existing codebase - Markup patterns in handlers and scenes

### Secondary (MEDIUM confidence)
- GitHub telegraf/telegraf discussions - Keyboard persistence patterns
- grammY docs - Keyboard best practices (similar API patterns)

### Tertiary (LOW confidence)
- Community blog posts - Emoji best practices (verified against Telegram's UTF-8 support)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing Telegraf 4.16.3, no new dependencies
- Architecture: HIGH - Patterns verified in Telegraf docs and existing codebase
- Pitfalls: HIGH - Common issues documented in GitHub issues/discussions

**Research date:** 2026-01-31
**Valid until:** 2026-03-31 (Telegraf stable, Telegram Bot API rarely changes keyboards)
