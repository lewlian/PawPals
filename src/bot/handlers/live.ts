import { Context } from 'telegraf';

/**
 * /live command handler
 * Shows occupancy dashboard (placeholder for Phase 5)
 * Requirement: CMDS-04
 */
export async function liveHandler(ctx: Context): Promise<void> {
  await ctx.reply(
    'Live dashboard coming soon!\n\n' +
    'When available, you will see:\n' +
    '- All 11 Singapore dog runs\n' +
    '- Current dog count at each park\n' +
    '- Size breakdown (Small/Medium/Large)\n' +
    '- Sort by most dogs or nearest to you'
  );
}
