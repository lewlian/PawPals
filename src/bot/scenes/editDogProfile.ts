import { Scenes, Markup, Composer } from 'telegraf';
import type { BotContext } from '../../types/session.js';
import { DOG_BREEDS, searchBreeds } from '../../data/breeds.js';
import { findDogById, updateDog } from '../../db/repositories/dogRepository.js';
import type { DogSize } from '../../types/dog.js';

const BREEDS_PER_PAGE = 6;

type EditField = 'name' | 'size' | 'breed' | 'age';

// Wizard state for edit flow
interface EditWizardState {
  dogId: number;
  field: EditField;
  dogName: string;
  currentValue: string;
}

function getEditState(ctx: BotContext): EditWizardState {
  return ctx.wizard.state as EditWizardState;
}

/**
 * Format size for display
 */
function formatSizeLabel(size: string): string {
  switch (size) {
    case 'Small':
      return 'Small (under 10kg)';
    case 'Medium':
      return 'Medium (10-25kg)';
    case 'Large':
      return 'Large (over 25kg)';
    default:
      return size;
  }
}

// Step 0: Entry - display prompt based on field being edited
// Use middleware that triggers on any update type (including scene.enter from callback)
const stepEntry = new Composer<BotContext>();
stepEntry.use(async (ctx) => {
  const state = getEditState(ctx);

  // Fetch current dog to get name and current value
  const dog = await findDogById(state.dogId);
  if (!dog) {
    await ctx.reply('Dog not found. It may have been deleted.');
    return ctx.scene.leave();
  }

  state.dogName = dog.name;

  switch (state.field) {
    case 'name':
      state.currentValue = dog.name;
      await ctx.reply(
        `Current name: ${dog.name}\n\nEnter new name:`
      );
      break;

    case 'size':
      state.currentValue = dog.size;
      await ctx.reply(
        `Current size: ${formatSizeLabel(dog.size)}\n\nSelect new size:`,
        Markup.inlineKeyboard([
          [Markup.button.callback('Small (under 10kg)', 'edit_size_Small')],
          [Markup.button.callback('Medium (10-25kg)', 'edit_size_Medium')],
          [Markup.button.callback('Large (over 25kg)', 'edit_size_Large')],
          [Markup.button.callback('Cancel', 'edit_cancel')],
        ])
      );
      break;

    case 'breed':
      state.currentValue = dog.breed;
      await ctx.reply(
        `Current breed: ${dog.breed}\n\nType to search or browse breeds:`,
        Markup.inlineKeyboard([
          [Markup.button.callback('Browse popular breeds', 'edit_breed_browse_0')],
          [Markup.button.callback('Cancel', 'edit_cancel')],
        ])
      );
      break;

    case 'age':
      state.currentValue = String(dog.age);
      await ctx.reply(
        `Current age: ${dog.age} year${dog.age === 1 ? '' : 's'}\n\nEnter new age (0-30):`
      );
      break;
  }

  return ctx.wizard.next();
});

// Step 1: Handle value input/selection
const stepValue = new Composer<BotContext>();

// Handle text input for name and age
stepValue.on('text', async (ctx) => {
  const text = ctx.message.text.trim();
  const state = getEditState(ctx);

  // Check if it's a command
  if (text.startsWith('/')) {
    if (text === '/cancel') {
      await ctx.reply('Edit cancelled.');
      return ctx.scene.leave();
    }
    return; // Let command handlers deal with it
  }

  if (state.field === 'name') {
    // Validate name length
    if (text.length < 1 || text.length > 50) {
      await ctx.reply('Please enter a name between 1 and 50 characters.');
      return;
    }

    // Update dog name
    const updated = await updateDog(state.dogId, { name: text });
    if (updated) {
      await ctx.reply(
        `Name updated! ${state.dogName} is now ${text}.\n\n` +
          'Use /profile to view your dogs.'
      );
    } else {
      await ctx.reply('Could not update name. Please try again.');
    }
    return ctx.scene.leave();
  }

  if (state.field === 'age') {
    const age = parseInt(text, 10);

    // Validate age
    if (isNaN(age) || age < 0 || age > 30) {
      await ctx.reply('Please enter a valid age between 0 and 30 years.');
      return;
    }

    // Update dog age
    const updated = await updateDog(state.dogId, { age });
    if (updated) {
      await ctx.reply(
        `Age updated! ${state.dogName} is now ${age} year${age === 1 ? '' : 's'} old.\n\n` +
          'Use /profile to view your dogs.'
      );
    } else {
      await ctx.reply('Could not update age. Please try again.');
    }
    return ctx.scene.leave();
  }

  if (state.field === 'breed') {
    // Text search for breeds
    const matches = searchBreeds(text);

    if (matches.length === 0) {
      await ctx.reply(
        'No breeds found matching your search. Try another term or use "Other / Mixed".',
        Markup.inlineKeyboard([
          [Markup.button.callback('Other / Mixed', 'edit_breed_select_Other / Mixed')],
          [Markup.button.callback('Browse popular breeds', 'edit_breed_browse_0')],
          [Markup.button.callback('Cancel', 'edit_cancel')],
        ])
      );
      return;
    }

    // Show up to 6 matching breeds
    const limitedMatches = matches.slice(0, BREEDS_PER_PAGE);
    const buttons = limitedMatches.map((breed) => [
      Markup.button.callback(breed, `edit_breed_select_${breed}`),
    ]);

    if (matches.length > BREEDS_PER_PAGE) {
      buttons.push([
        Markup.button.callback('Browse all breeds', 'edit_breed_browse_0'),
      ]);
    }
    buttons.push([Markup.button.callback('Cancel', 'edit_cancel')]);

    await ctx.reply(
      `Found ${matches.length} breed${matches.length === 1 ? '' : 's'} matching "${text}":`,
      Markup.inlineKeyboard(buttons)
    );
  }
});

// Handle size selection
stepValue.action(/^edit_size_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const match = ctx.match[1];
  if (!match || !['Small', 'Medium', 'Large'].includes(match)) {
    await ctx.reply('Invalid size selection. Please try again.');
    return;
  }

  const size = match as DogSize;
  const state = getEditState(ctx);

  // Update dog size
  const updated = await updateDog(state.dogId, { size });
  if (updated) {
    await ctx.editMessageText(
      `Size updated! ${state.dogName} is now ${formatSizeLabel(size)}.\n\n` +
        'Use /profile to view your dogs.'
    );
  } else {
    await ctx.editMessageText('Could not update size. Please try again.');
  }
  return ctx.scene.leave();
});

// Browse breeds with pagination
stepValue.action(/^edit_breed_browse_(\d+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const page = parseInt(ctx.match[1] ?? '0', 10);
  const start = page * BREEDS_PER_PAGE;
  const breeds = DOG_BREEDS.slice(start, start + BREEDS_PER_PAGE);

  const buttons = breeds.map((breed) => [
    Markup.button.callback(breed, `edit_breed_select_${breed}`),
  ]);

  // Navigation buttons
  const navRow: ReturnType<typeof Markup.button.callback>[] = [];
  if (page > 0) {
    navRow.push(Markup.button.callback('< Previous', `edit_breed_browse_${page - 1}`));
  }
  if (start + BREEDS_PER_PAGE < DOG_BREEDS.length) {
    navRow.push(Markup.button.callback('Next >', `edit_breed_browse_${page + 1}`));
  }
  if (navRow.length > 0) {
    buttons.push(navRow);
  }
  buttons.push([Markup.button.callback('Cancel', 'edit_cancel')]);

  await ctx.editMessageText(
    `Select breed (page ${page + 1}/${Math.ceil(DOG_BREEDS.length / BREEDS_PER_PAGE)}):`,
    Markup.inlineKeyboard(buttons)
  );
});

// Breed selection
stepValue.action(/^edit_breed_select_(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();

  const breed = ctx.match[1];
  if (!breed) {
    await ctx.reply('Invalid breed selection. Please try again.');
    return;
  }

  const state = getEditState(ctx);

  // Update dog breed
  const updated = await updateDog(state.dogId, { breed });
  if (updated) {
    await ctx.editMessageText(
      `Breed updated! ${state.dogName} is now a ${breed}.\n\n` +
        'Use /profile to view your dogs.'
    );
  } else {
    await ctx.editMessageText('Could not update breed. Please try again.');
  }
  return ctx.scene.leave();
});

// Cancel handler
stepValue.action('edit_cancel', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageText('Edit cancelled.');
  return ctx.scene.leave();
});

// Handle non-text messages
stepValue.on('message', async (ctx) => {
  const state = getEditState(ctx);

  if (state.field === 'name' || state.field === 'age') {
    await ctx.reply('Please send a text message.');
  } else {
    await ctx.reply(
      'Please type to search or use the buttons to browse.'
    );
  }
});

// Create the wizard scene
export const editDogProfileWizard = new Scenes.WizardScene<BotContext>(
  'edit-dog-profile',
  stepEntry,
  stepValue
);

// Global /cancel handler - exits wizard from any step
editDogProfileWizard.command('cancel', async (ctx) => {
  await ctx.reply('Edit cancelled.');
  return ctx.scene.leave();
});
