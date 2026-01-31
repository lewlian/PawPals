import { Markup } from 'telegraf';
import { BUTTON_TEXT } from '../constants/emoji.js';

/**
 * Persistent 2x2 reply keyboard for main bot actions
 * - Row 1: Check In, Checkout
 * - Row 2: Profile, Live
 *
 * Uses .resize() for compact display
 * Uses .persistent() to keep keyboard visible after button press
 */
export const mainMenuKeyboard = Markup.keyboard([
  [
    Markup.button.text(BUTTON_TEXT.checkIn),
    Markup.button.text(BUTTON_TEXT.checkout),
  ],
  [
    Markup.button.text(BUTTON_TEXT.profile),
    Markup.button.text(BUTTON_TEXT.live),
  ],
])
  .resize()
  .persistent();
