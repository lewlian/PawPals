import { Scenes, Markup, Composer } from 'telegraf';
import type { BotContext, CheckInWizardState } from '../../types/session.js';
import { validateGeofence } from '../utils/geofence.js';
import { findDogsByUserId, findDogById } from '../../db/repositories/dogRepository.js';
import { findOrCreateUser } from '../../db/repositories/userRepository.js';
import { createSession, addDogsToSession } from '../../db/repositories/sessionRepository.js';

// Type guard for wizard state
function getWizardState(ctx: BotContext): CheckInWizardState {
  const state = ctx.wizard.state as CheckInWizardState;
  return state;
}

// Step 0: Entry point - request location
// Use middleware that triggers on any update type (including scene.enter from callback or command)
const stepEntry = new Composer<BotContext>();
stepEntry.use(async (ctx) => {
  // Initialize wizard state properties
  const state = ctx.wizard.state as CheckInWizardState;
  state.locationId = undefined;
  state.locationName = undefined;
  state.selectedDogIds = undefined;
  state.durationMinutes = undefined;
  state.userId = undefined;
  state.allDogIds = undefined;

  await ctx.reply(
    'To check in, I need to verify you\'re at a dog run.\n\nPlease share your location:',
    Markup.keyboard([
      [Markup.button.locationRequest('Share Location')],
      [Markup.button.text('Cancel')]
    ]).oneTime().resize()
  );

  return ctx.wizard.next();
});

// Step 1: Handle location message
const stepLocation = new Composer<BotContext>();

stepLocation.on('location', async (ctx) => {
  const location = ctx.message.location;
  const latitude = location.latitude;
  const longitude = location.longitude;

  await ctx.reply(
    'Checking nearby dog runs...',
    Markup.removeKeyboard()
  );

  const result = await validateGeofence(latitude, longitude);

  if (!result.isWithinGeofence) {
    const distanceKm = result.distance ? (result.distance / 1000).toFixed(1) : '?';
    const nearestName = result.nearestLocation?.name ?? 'a dog run';

    await ctx.reply(
      `You're too far from any dog run to check in.\n\n` +
      `Nearest: ${nearestName} (${distanceKm}km away)\n` +
      `Required: Within 200 meters\n\n` +
      `Try again when you arrive at a dog run, or use:\n` +
      `- /live to see which parks have dogs right now\n` +
      `- /profile to manage your dog profiles`,
      Markup.removeKeyboard()
    );
    return ctx.scene.leave();
  }

  // Within geofence - store location info
  const state = getWizardState(ctx);
  state.locationId = result.nearestLocation!.id;
  state.locationName = result.nearestLocation!.name;

  await ctx.reply(`Location confirmed: ${state.locationName}\n\nLoading your dogs...`);
  return ctx.wizard.next();
});

stepLocation.on('text', async (ctx) => {
  const text = ctx.message.text.trim();

  if (text === 'Cancel') {
    await ctx.reply('Check-in cancelled.', Markup.removeKeyboard());
    return ctx.scene.leave();
  }

  await ctx.reply('Please share your location using the button, or tap Cancel.');
});

// Step 2: Fetch and display dog selection
// Use middleware that triggers immediately when entering this step (after location validation)
const stepDogs = new Composer<BotContext>();

stepDogs.use(async (ctx) => {
  const telegramId = ctx.from?.id;
  const firstName = ctx.from?.first_name;
  const username = ctx.from?.username;

  if (!telegramId) {
    await ctx.reply('Could not identify user. Please try again.');
    return ctx.scene.leave();
  }

  // Find or create user
  const user = await findOrCreateUser(telegramId, firstName, username);

  // Get user's dogs
  const dogs = await findDogsByUserId(user.id);

  if (dogs.length === 0) {
    await ctx.reply('You need to create a dog profile first! Use /profile to create one.');
    return ctx.scene.leave();
  }

  // Store in wizard state
  const state = getWizardState(ctx);
  state.userId = user.id;
  state.allDogIds = dogs.map(d => d.id);

  // Build dog selection keyboard
  const buttons = dogs.map(dog => [
    Markup.button.callback(`${dog.name} (${dog.breed})`, `dog_${dog.id}`)
  ]);

  // Add "All Dogs" option if multiple dogs
  if (dogs.length > 1) {
    buttons.unshift([
      Markup.button.callback('All Dogs', 'dog_all')
    ]);
  }

  await ctx.reply(
    'Which dog(s) are you checking in?',
    Markup.inlineKeyboard(buttons)
  );

  return ctx.wizard.next();
});

// Step 3: Handle dog selection
const stepDogCallback = new Composer<BotContext>();

stepDogCallback.action(/^dog_(\d+|all)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const selection = ctx.match[1];
  if (!selection) {
    await ctx.reply('Invalid selection. Please try again.');
    return;
  }

  const state = getWizardState(ctx);

  if (selection === 'all') {
    state.selectedDogIds = state.allDogIds ?? [];
  } else {
    const dogId = parseInt(selection, 10);
    state.selectedDogIds = [dogId];
  }

  // Build duration selection keyboard
  await ctx.editMessageText(
    'How long will you stay?',
    Markup.inlineKeyboard([
      [Markup.button.callback('15 minutes', 'dur_15')],
      [Markup.button.callback('30 minutes ⭐', 'dur_30')],
      [Markup.button.callback('60 minutes', 'dur_60')]
    ])
  );

  return ctx.wizard.next();
});

// Step 4: Handle duration and create session
const stepDuration = new Composer<BotContext>();

stepDuration.action(/^dur_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const durationMatch = ctx.match[1];
  if (!durationMatch) {
    await ctx.reply('Invalid duration. Please try again.');
    return;
  }

  const durationMinutes = parseInt(durationMatch, 10);
  const state = getWizardState(ctx);

  // Validate state
  if (!state.userId || !state.locationId || !state.selectedDogIds || state.selectedDogIds.length === 0) {
    await ctx.reply('Something went wrong. Please start over with /checkin.');
    return ctx.scene.leave();
  }

  try {
    // Create session
    const session = await createSession(state.userId, state.locationId, durationMinutes);

    // Add dogs to session
    await addDogsToSession(session.id, state.selectedDogIds);

    // Get dog names for confirmation
    const dogNames = await Promise.all(
      state.selectedDogIds.map(async id => {
        const dog = await findDogById(id);
        return dog?.name ?? 'Unknown';
      })
    );

    // Format expiry time
    const expiryTime = session.expiresAt.toLocaleTimeString('en-SG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    await ctx.editMessageText(
      `✅ Check-in successful!\n\n` +
      `Location: ${state.locationName}\n` +
      `Dog(s): ${dogNames.join(', ')}\n` +
      `Duration: ${durationMinutes} minutes\n` +
      `Auto check-out at: ${expiryTime}\n\n` +
      `Use /checkout to end your session early.`
    );
  } catch (error) {
    console.error('Error creating check-in session:', error);
    await ctx.reply('Sorry, there was an error creating your check-in. Please try again.');
  }

  return ctx.scene.leave();
});

// Create the wizard scene
export const checkInWizard = new Scenes.WizardScene<BotContext>(
  'check-in-wizard',
  stepEntry,
  stepLocation,
  stepDogs,
  stepDogCallback,
  stepDuration
);

// Global /cancel handler
checkInWizard.command('cancel', async (ctx) => {
  await ctx.reply('Check-in cancelled.', Markup.removeKeyboard());
  return ctx.scene.leave();
});
