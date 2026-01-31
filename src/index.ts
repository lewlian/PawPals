import express from 'express';
import type { BotCommand } from 'telegraf/types';
import { bot } from './bot/index.js';
import { closePool, checkConnection } from './db/client.js';
import { startAllJobs, stopAllJobs } from './jobs/index.js';
import { validateEnv } from './config/env.js';

const env = validateEnv();

async function main(): Promise<void> {
  console.log('Starting PawPals SG bot...');

  // Verify database connection
  const dbConnected = await checkConnection();
  if (!dbConnected) {
    console.error('Failed to connect to database. Exiting.');
    process.exit(1);
  }
  console.log('Database connected');

  // Register menu commands with Telegram
  const commands: BotCommand[] = [
    { command: 'checkin', description: 'Check in at a dog run' },
    { command: 'checkout', description: 'End your session' },
    { command: 'live', description: 'See parks with dogs now' },
    { command: 'profile', description: 'Manage dog profiles' },
  ];
  await bot.telegram.setMyCommands(commands);
  console.log('Menu commands registered');

  // Start background jobs
  startAllJobs();

  // Launch bot based on environment
  if (env.NODE_ENV === 'production') {
    // Production: webhook mode with Express
    if (!env.WEBHOOK_DOMAIN) {
      console.error('WEBHOOK_DOMAIN is required in production');
      process.exit(1);
    }

    const app = express();

    // Health check endpoint
    app.get('/', (_req, res) => {
      res.send('PawPals SG Bot is running');
    });

    // Webhook endpoint - use Telegraf's webhook callback
    const webhookPath = '/webhook';
    app.use(webhookPath, express.json(), (req, res) => {
      bot.handleUpdate(req.body, res);
    });

    // Set webhook URL with Telegram
    const webhookUrl = `https://${env.WEBHOOK_DOMAIN}${webhookPath}`;
    await bot.telegram.setWebhook(webhookUrl, {
      secret_token: env.WEBHOOK_SECRET,
    });

    // Start Express server
    const server = app.listen(env.PORT, '0.0.0.0', () => {
      console.log('Bot running in webhook mode');
      console.log(`Webhook: ${webhookUrl}`);
      console.log(`Port: ${env.PORT}`);
      console.log(`Secret token: ${env.WEBHOOK_SECRET ? 'configured' : 'not set'}`);
    });

    // Store server for graceful shutdown
    (global as unknown as { server: typeof server }).server = server;

    // Send deployment notification to admin
    if (env.ADMIN_CHAT_ID) {
      try {
        await bot.telegram.sendMessage(
          env.ADMIN_CHAT_ID,
          `PawPals SG Bot Deployed\n\nMode: Webhook\nTime: ${new Date().toISOString()}\nStatus: Running`
        );
        console.log('Deployment notification sent to admin');
      } catch (notifyErr) {
        console.error('Failed to send deployment notification:', notifyErr);
      }
    }
  } else {
    // Development: polling mode
    await bot.launch();
    console.log('Bot running in polling mode (development)');
  }

  console.log('Press Ctrl+C to stop');
}

// Graceful shutdown handlers
async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received. Shutting down gracefully...`);

  try {
    // Stop background jobs first
    stopAllJobs();

    // Close Express server if in production
    const server = (global as unknown as { server?: { close: (cb: () => void) => void } }).server;
    if (server) {
      server.close(() => console.log('HTTP server closed'));
    } else {
      bot.stop(signal);
    }
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
