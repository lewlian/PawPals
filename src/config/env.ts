import { z } from 'zod';

const envSchema = z.object({
  // Bot configuration
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required'),

  // PostgreSQL configuration
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().default('pawpals'),
  DB_USER: z.string().default('postgres'),
  DB_PASSWORD: z.string().default('postgres'),

  // Redis configuration
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // Environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Environment validation failed:');
    console.error(result.error.format());
    process.exit(1);
  }

  return result.data;
}
