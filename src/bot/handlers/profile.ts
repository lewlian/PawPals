import { Markup } from 'telegraf';
import type { BotContext } from '../../types/session.js';
import { findUserByTelegramId } from '../../db/repositories/userRepository.js';
import { findDogsByUserId } from '../../db/repositories/dogRepository.js';
import type { Dog } from '../../types/dog.js';
import { EMOJI } from '../constants/emoji.js';

/**
 * Format dog size with weight range for display
 */
function formatSize(size: string): string {
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

/**
 * Format age with proper pluralization
 */
function formatAge(age: number): string {
  return age === 1 ? '1 year old' : `${age} years old`;
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return date.toLocaleDateString('en-SG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Build dog list display message
 */
function formatDogList(dogs: Dog[]): string {
  let message = 'Your Dogs:\n\n';

  dogs.forEach((dog, index) => {
    message += `${index + 1}. ${dog.name} - ${dog.breed}\n`;
    message += `   ${dog.size} | ${formatAge(dog.age)}\n\n`;
  });

  return message.trim();
}

/**
 * Build full dog profile display message
 */
export function formatDogProfile(dog: Dog): string {
  return (
    `${dog.name}'s Profile\n\n` +
    `Name: ${dog.name}\n` +
    `Size: ${formatSize(dog.size)}\n` +
    `Breed: ${dog.breed}\n` +
    `Age: ${formatAge(dog.age)}\n\n` +
    `Added: ${formatDate(dog.createdAt)}`
  );
}

/**
 * Build inline keyboard for dog list
 */
function buildDogListKeyboard(dogs: Dog[]) {
  const buttons = dogs.map((dog) => [
    Markup.button.callback(`${EMOJI.dogs} ${dog.name}`, `view_dog_${dog.id}`),
  ]);

  buttons.push([Markup.button.callback(`${EMOJI.add} Add Another Dog`, 'create_profile')]);

  return Markup.inlineKeyboard(buttons);
}

/**
 * Build inline keyboard for dog detail view
 */
export function buildDogDetailKeyboard(dogId: number) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(`${EMOJI.edit} Edit Name`, `edit_dog_name_${dogId}`),
      Markup.button.callback(`${EMOJI.edit} Edit Size`, `edit_dog_size_${dogId}`),
    ],
    [
      Markup.button.callback(`${EMOJI.edit} Edit Breed`, `edit_dog_breed_${dogId}`),
      Markup.button.callback(`${EMOJI.edit} Edit Age`, `edit_dog_age_${dogId}`),
    ],
    [Markup.button.callback(`${EMOJI.delete} Delete`, `delete_dog_${dogId}`)],
    [Markup.button.callback(`${EMOJI.back} Back`, 'profile_list')],
  ]);
}

/**
 * /profile command handler
 * Shows user's dogs or prompts to create first profile
 * Requirements: CMDS-02, PROF-05, PROF-06
 */
export async function profileHandler(ctx: BotContext): Promise<void> {
  const telegramId = ctx.from?.id;

  if (!telegramId) {
    await ctx.reply('Could not identify user. Please try again.');
    return;
  }

  // Find user in database
  const user = await findUserByTelegramId(telegramId);

  if (!user) {
    // User hasn't created any profiles yet
    await ctx.reply(
      "You haven't set up a profile yet.\n\n" +
        'Create your first dog profile to get started!',
      Markup.inlineKeyboard([
        [Markup.button.callback('Create Dog Profile', 'create_profile')],
      ])
    );
    return;
  }

  // Get user's dogs
  const dogs = await findDogsByUserId(user.id);

  if (dogs.length === 0) {
    // User exists but has no dogs (edge case - dogs may have been deleted)
    await ctx.reply(
      "You haven't added any dogs yet.\n\n" +
        'Add your first dog to check in at dog runs!',
      Markup.inlineKeyboard([
        [Markup.button.callback('Add Your First Dog', 'create_profile')],
      ])
    );
    return;
  }

  // Show list of all dogs
  const message = formatDogList(dogs);
  const keyboard = buildDogListKeyboard(dogs);

  // If called from callback (editMessageText), we need to handle differently
  if (ctx.callbackQuery) {
    await ctx.editMessageText(message, keyboard);
  } else {
    await ctx.reply(message, keyboard);
  }
}
