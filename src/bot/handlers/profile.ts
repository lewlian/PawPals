import { Context } from 'telegraf';

/**
 * /profile command handler
 * Shows/edits dog profiles (placeholder for Phase 2)
 * Requirement: CMDS-02
 */
export async function profileHandler(ctx: Context): Promise<void> {
  await ctx.reply(
    'Dog profile management will be available in the next update.\n\n' +
    'You will be able to:\n' +
    '- Add your dogs (name, size, breed, age)\n' +
    '- Manage multiple dog profiles\n' +
    '- Edit or delete profiles'
  );
}
