import {
  startSessionExpiryJob,
  stopSessionExpiryJob,
} from './sessionExpiry.js';

/**
 * Initialize all background jobs
 * Called during bot startup after database connection is verified
 */
export function startAllJobs(): void {
  console.log('Initializing background jobs...');

  startSessionExpiryJob();

  console.log('Background jobs started');
}

/**
 * Stop all background jobs
 * Called during graceful shutdown before bot stops
 */
export function stopAllJobs(): void {
  console.log('Stopping background jobs...');

  stopSessionExpiryJob();

  console.log('Background jobs stopped');
}
