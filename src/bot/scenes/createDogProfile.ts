import { Scenes, Markup, Composer } from 'telegraf';
import type { BotContext } from '../../types/session.js';
import { DOG_BREEDS, searchBreeds } from '../../data/breeds.js';
import { findOrCreateUser } from '../../db/repositories/userRepository.js';
import { createDog } from '../../db/repositories/dogRepository.js';
import type { DogSize, CreateDogInput } from '../../types/dog.js';

const BREEDS_PER_PAGE = 6;

// Type guard for wizard state
interface WizardState {
  dogData: {
    name?: string;
    size?: DogSize;
    breed?: string;
    age?: number;
  };
}

function getWizardState(ctx: BotContext): WizardState {
  const state = ctx.wizard.state as WizardState;
  if (!state.dogData) {
    state.dogData = {};
  }
  return state;
}

// Step 0: Entry - ask for dog name
// Use middleware that triggers on any update type (including scene.enter from callback)
const stepEntry = new Composer<BotContext>();
stepEntry.use(async (ctx) => {
  const state = getWizardState(ctx);
  state.dogData = {};

  await ctx.reply(
    "Let's create a profile for your dog!\n\nWhat is your dog's name?"
  );
  return ctx.wizard.next();
});

// Step 1: Receive name, show size selection
const stepName = new Composer<BotContext>();
stepName.on('text', async (ctx) => {
  const name = ctx.message.text.trim();

  // Validate name length
  if (name.length < 1 || name.length > 50) {
    await ctx.reply(
      'Please enter a name between 1 and 50 characters.'
    );
    return; // Stay on this step
  }

  const state = getWizardState(ctx);
  state.dogData.name = name;

  await ctx.reply(
    `Great! ${name} is a lovely name.\n\nWhat size is ${name}?`,
    Markup.inlineKeyboard([
      [Markup.button.callback('Small (under 10kg)', 'size_Small')],
      [Markup.button.callback('Medium (10-25kg)', 'size_Medium')],
      [Markup.button.callback('Large (over 25kg)', 'size_Large')],
    ])
  );
  return ctx.wizard.next();
});

// Handle non-text messages in name step
stepName.on('message', async (ctx) => {
  await ctx.reply("Please send your dog's name as a text message.");
});

// Step 2: Handle size selection and breed search/browse
const stepBreed = new Composer<BotContext>();

// Size selection callback
stepBreed.action(/^size_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const match = ctx.match[1];
  if (!match || !['Small', 'Medium', 'Large'].includes(match)) {
    await ctx.reply('Invalid size selection. Please try again.');
    return;
  }

  const size = match as DogSize;
  const state = getWizardState(ctx);
  state.dogData.size = size;

  await ctx.editMessageText(
    `Size: ${size}\n\nNow, type your dog's breed to search, or browse popular breeds:`,
    Markup.inlineKeyboard([
      [Markup.button.callback('Browse popular breeds', 'breed_browse_0')],
    ])
  );
});

// Browse breeds with pagination
stepBreed.action(/^breed_browse_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const page = parseInt(ctx.match[1] ?? '0', 10);
  const start = page * BREEDS_PER_PAGE;
  const breeds = DOG_BREEDS.slice(start, start + BREEDS_PER_PAGE);

  const buttons = breeds.map((breed) => [
    Markup.button.callback(breed, `breed_select_${breed}`),
  ]);

  // Navigation buttons
  const navRow: ReturnType<typeof Markup.button.callback>[] = [];
  if (page > 0) {
    navRow.push(Markup.button.callback('< Previous', `breed_browse_${page - 1}`));
  }
  if (start + BREEDS_PER_PAGE < DOG_BREEDS.length) {
    navRow.push(Markup.button.callback('Next >', `breed_browse_${page + 1}`));
  }
  if (navRow.length > 0) {
    buttons.push(navRow);
  }

  await ctx.editMessageText(
    `Select your dog's breed (page ${page + 1}/${Math.ceil(DOG_BREEDS.length / BREEDS_PER_PAGE)}):`,
    Markup.inlineKeyboard(buttons)
  );
});

// Text search for breeds
stepBreed.on('text', async (ctx) => {
  const query = ctx.message.text.trim();

  // Check if it's a command
  if (query.startsWith('/')) {
    return; // Let command handlers deal with it
  }

  const matches = searchBreeds(query);

  if (matches.length === 0) {
    await ctx.reply(
      'No breeds found matching your search. Try another term or use "Other / Mixed".',
      Markup.inlineKeyboard([
        [Markup.button.callback('Other / Mixed', 'breed_select_Other / Mixed')],
        [Markup.button.callback('Browse popular breeds', 'breed_browse_0')],
      ])
    );
    return;
  }

  // Show up to 6 matching breeds
  const limitedMatches = matches.slice(0, BREEDS_PER_PAGE);
  const buttons = limitedMatches.map((breed) => [
    Markup.button.callback(breed, `breed_select_${breed}`),
  ]);

  if (matches.length > BREEDS_PER_PAGE) {
    buttons.push([
      Markup.button.callback('Browse all breeds', 'breed_browse_0'),
    ]);
  }

  await ctx.reply(
    `Found ${matches.length} breed${matches.length === 1 ? '' : 's'} matching "${query}":`,
    Markup.inlineKeyboard(buttons)
  );
});

// Breed selection - move to age step
stepBreed.action(/^breed_select_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const breed = ctx.match[1];
  if (!breed) {
    await ctx.reply('Invalid breed selection. Please try again.');
    return;
  }

  const state = getWizardState(ctx);
  state.dogData.breed = breed;

  await ctx.editMessageText(
    `Breed: ${breed}\n\nHow old is ${state.dogData.name}? (Enter age in years, 0-30)`
  );
  return ctx.wizard.next();
});

// Handle non-text messages in breed step
stepBreed.on('message', async (ctx) => {
  await ctx.reply(
    'Please type a breed name to search, or use the buttons to browse.'
  );
});

// Step 3: Receive age, show confirmation
const stepAge = new Composer<BotContext>();
stepAge.on('text', async (ctx) => {
  const text = ctx.message.text.trim();

  // Check if it's a command
  if (text.startsWith('/')) {
    return; // Let command handlers deal with it
  }

  const age = parseInt(text, 10);

  // Validate age
  if (isNaN(age) || age < 0 || age > 30) {
    await ctx.reply(
      'Please enter a valid age between 0 and 30 years.'
    );
    return; // Stay on this step
  }

  const state = getWizardState(ctx);
  state.dogData.age = age;

  await ctx.reply(
    `Please confirm your dog's profile:\n\n` +
    `Name: ${state.dogData.name}\n` +
    `Size: ${state.dogData.size}\n` +
    `Breed: ${state.dogData.breed}\n` +
    `Age: ${age} year${age === 1 ? '' : 's'}\n\n` +
    `Is this correct?`,
    Markup.inlineKeyboard([
      [Markup.button.callback('Yes, save profile', 'confirm_save')],
      [Markup.button.callback('No, start over', 'confirm_restart')],
    ])
  );
  return ctx.wizard.next();
});

// Handle non-text messages in age step
stepAge.on('message', async (ctx) => {
  await ctx.reply('Please enter your dog\'s age as a number (0-30).');
});

// Step 4: Confirmation handlers
const stepConfirm = new Composer<BotContext>();

stepConfirm.action('confirm_save', async (ctx) => {
  await ctx.answerCbQuery();

  const state = getWizardState(ctx);
  const { dogData } = state;

  // Validate all required fields are present
  if (!dogData.name || !dogData.size || !dogData.breed || dogData.age === undefined) {
    await ctx.reply('Something went wrong. Please start over with /profile.');
    return ctx.scene.leave();
  }

  try {
    // Get user info from context
    const telegramId = ctx.from?.id;
    const firstName = ctx.from?.first_name;
    const username = ctx.from?.username;

    if (!telegramId) {
      await ctx.reply('Could not identify user. Please try again.');
      return ctx.scene.leave();
    }

    // Find or create user
    const user = await findOrCreateUser(telegramId, firstName, username);

    // Create dog profile
    const dogInput: CreateDogInput = {
      name: dogData.name,
      size: dogData.size,
      breed: dogData.breed,
      age: dogData.age,
    };

    await createDog(user.id, dogInput);

    await ctx.editMessageText(
      `${dogData.name}'s profile has been created!\n\n` +
      `Use /profile to view and manage your dog profiles.`
    );
  } catch (error) {
    console.error('Error creating dog profile:', error);
    await ctx.reply(
      'Sorry, there was an error saving the profile. Please try again.'
    );
  }

  return ctx.scene.leave();
});

stepConfirm.action('confirm_restart', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText('Starting over...');
  return ctx.scene.reenter();
});

// Handle unexpected messages in confirmation step
stepConfirm.on('message', async (ctx) => {
  await ctx.reply(
    'Please use the buttons above to confirm or restart.',
    Markup.inlineKeyboard([
      [Markup.button.callback('Yes, save profile', 'confirm_save')],
      [Markup.button.callback('No, start over', 'confirm_restart')],
    ])
  );
});

// Create the wizard scene
export const createDogProfileWizard = new Scenes.WizardScene<BotContext>(
  'create-dog-profile',
  stepEntry,
  stepName,
  stepBreed,
  stepAge,
  stepConfirm
);

// Global /cancel handler - exits wizard from any step
createDogProfileWizard.command('cancel', async (ctx) => {
  await ctx.reply('Profile creation cancelled.');
  return ctx.scene.leave();
});
