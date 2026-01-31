/**
 * Centralized emoji constants for consistent UI
 * Organized by category for easy reference
 */

export const EMOJI = {
  // Headers
  welcome: '\u{1F43E}', // paw prints
  checkedIn: '\u2705', // check mark
  checkedOut: '\u2705', // check mark
  reminder: '\u23F0', // alarm clock

  // Content
  location: '\u{1F4CD}', // pin
  dogs: '\u{1F415}', // dog
  timer: '\u23F1\uFE0F', // stopwatch

  // Buttons
  checkIn: '\u{1F7E2}', // green circle
  checkout: '\u{1F534}', // red circle
  profile: '\u{1F415}', // dog
  live: '\u{1F4CA}', // chart
  extend: '\u2795', // plus
  refresh: '\u{1F504}', // refresh
  edit: '\u270F\uFE0F', // pencil
  delete: '\u{1F5D1}\uFE0F', // trash
  back: '\u25C0\uFE0F', // back arrow
  add: '\u2795', // plus
} as const;

/**
 * Reply keyboard button text labels
 * These exact strings are used for bot.hears() matching
 */
export const BUTTON_TEXT = {
  checkIn: '\u{1F7E2} Check In',
  checkout: '\u{1F534} Checkout',
  profile: '\u{1F415} Profile',
  live: '\u{1F4CA} Live',
} as const;
