import { bot } from './bot/index.js';
import { closePool, checkConnection } from './db/client.js';

async function main(): Promise<void> {
  console.log('Starting PawPals SG bot...');

  // Verify database connection
  const dbConnected = await checkConnection();
  if (!dbConnected) {
    console.error('Failed to connect to database. Exiting.');
    process.exit(1);
  }
  console.log('Database connected');

  // Launch bot in polling mode (development)
  await bot.launch();
  console.log('Bot is running!');
  console.log('Press Ctrl+C to stop');
}

// Graceful shutdown handlers
async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  try {
    bot.stop(signal);
    console.log('Bot stopped');

    await closePool();
    console.log('Database pool closed');

    console.log('Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

// Start the application
main().catch((err) => {
  console.error('Failed to start bot:', err);
  process.exit(1);
});
