import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  API_PORT: z.coerce.number().default(4000),
  PUBLIC_API_URL: z.string().default('http://localhost:4000'),
  PUBLIC_WEB_URL: z.string().default('http://localhost:5173'),
  SESSION_SECRET: z.string().min(32),
  COOKIE_DOMAIN: z.string().optional(),
  PLAYWRIGHT_HEADLESS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  TEVEL_FORM_URL: z.string().url(),
  WORKER_LIVE_VIEW_PORT: z.coerce.number().default(7900),
  UPLOAD_DIR: z.string().default('./data/uploads'),
  SNAPSHOT_DIR: z.string().default('./data/snapshots'),
  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
  SEED_ADMIN_NAME: z.string().optional(),
});

export const env = envSchema.parse(process.env);
