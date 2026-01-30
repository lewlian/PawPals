import type { BotContext } from '../../types/session.js';

/**
 * /checkin command handler
 * Initiates check-in flow
 * Requirement: CMDS-03
 */
export async function checkinHandler(ctx: BotContext): Promise<void> {
  await ctx.scene.enter('check-in-wizard');
}
