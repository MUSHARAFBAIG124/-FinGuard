import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { z } from 'zod';

const repositoryEnvPath = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../.env');
dotenv.config({ path: repositoryEnvPath });

const nodeEnvSchema = z.enum(['development', 'test', 'production']).default('development');

const envSchema = z
  .object({
    NODE_ENV: nodeEnvSchema,
    APP_NAME: z.string().min(1).default('FinGuard AI'),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    API_HOST: z.string().min(1).default('127.0.0.1'),
    API_BASE_URL: z.string().url().default('http://localhost:4000'),
    WEB_BASE_URL: z.string().url().default('http://localhost:5173'),
    MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/finguard_ai'),
    JWT_ACCESS_SECRET: z.string().min(16).default('local-access-secret-for-development-only'),
    JWT_REFRESH_SECRET: z.string().min(16).default('local-refresh-secret-for-development-only'),
    JWT_ACCESS_TTL: z.string().min(1).default('15m'),
    JWT_REFRESH_TTL: z.string().min(1).default('7d'),
    REFRESH_TOKEN_COOKIE_NAME: z.string().min(1).default('finguard_refresh_token'),
    BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
    AUTH_LOGIN_MAX_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
    AUTH_LOCKOUT_MINUTES: z.coerce.number().int().min(1).max(1440).default(15),
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(15),
    EMAIL_VERIFICATION_TTL_HOURS: z.coerce.number().int().positive().default(24),
    CSRF_COOKIE_NAME: z.string().min(1).default('finguard_csrf'),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    AI_SERVICE_BASE_URL: z.string().url().default('http://localhost:8000'),
    AI_HEALTH_TIMEOUT_MS: z.coerce.number().int().positive().default(1500),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV !== 'production') {
      return;
    }

    const secretFields = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const;
    const developmentSecretDefaults = {
      JWT_ACCESS_SECRET: 'local-access-secret-for-development-only',
      JWT_REFRESH_SECRET: 'local-refresh-secret-for-development-only',
    };

    for (const field of secretFields) {
      const secret = value[field];

      if (
        secret.length < 32 ||
        secret.toLowerCase().includes('replace-with') ||
        secret === developmentSecretDefaults[field]
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} must be at least 32 characters and non-placeholder in production`,
        });
      }
    }

    let databaseUrl: URL | undefined;
    try {
      databaseUrl = new URL(value.MONGODB_URI);
    } catch {
      // The generic message below avoids including connection-string contents.
    }

    if (!databaseUrl || !['mongodb:', 'mongodb+srv:'].includes(databaseUrl.protocol)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MONGODB_URI'],
        message: 'MONGODB_URI must be a valid MongoDB connection string in production',
      });
    } else {
      const hostname = databaseUrl.hostname.toLowerCase().replace(/^\[|\]$/g, '');
      if (hostname === 'localhost' || hostname === '::1' || hostname.startsWith('127.')) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['MONGODB_URI'],
          message: 'MONGODB_URI must point to a non-local database in production',
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Railway and Render supply PORT for web services. Preserve API_PORT for local
 * and existing deployment compatibility, but let the platform value win.
 */
export const parseEnv = (source: NodeJS.ProcessEnv): Env =>
  envSchema.parse({
    ...source,
    API_PORT: source.PORT ?? source.API_PORT,
  });

export const env = parseEnv(process.env);
