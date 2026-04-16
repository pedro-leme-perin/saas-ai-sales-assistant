// =============================================
// Environment Validation (Fail Fast — Release It!)
// =============================================
// Validates ALL required env vars at startup.
// Missing/invalid vars cause immediate crash with clear error message.
// Prevents runtime failures from missing configuration.
// Refs: Release It! — Fail Fast; SRE — Configuration Management
// =============================================

import { z } from 'zod';
import { Logger } from '@nestjs/common';

const logger = new Logger('EnvValidation');

// Schema: required vars throw on missing, optional vars have defaults
const envSchema = z.object({
  // ── Application ──
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  APP_NAME: z.string().default('TheIAdvisor'),
  API_VERSION: z.string().default('v1'),

  // ── Database (REQUIRED) ──
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // ── Redis ──
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_TTL: z.coerce.number().int().positive().default(3600),

  // ── Auth (Clerk) — required in production ──
  CLERK_SECRET_KEY: z.string().min(1).optional(),
  CLERK_PUBLISHABLE_KEY: z.string().min(1).optional(),
  CLERK_WEBHOOK_SECRET: z.string().min(1).optional(),

  // ── AI Providers — at least OpenAI required ──
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_MAX_TOKENS: z.coerce.number().int().positive().default(1000),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),

  // ── Twilio ──
  TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
  TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
  TWILIO_PHONE_NUMBER: z.string().min(1).optional(),
  TWILIO_WEBHOOK_URL: z.string().url().optional(),

  // ── Deepgram ──
  DEEPGRAM_API_KEY: z.string().min(1).optional(),

  // ── Stripe — required in production ──
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PRICE_STARTER: z.string().min(1).optional(),
  STRIPE_PRICE_PROFESSIONAL: z.string().min(1).optional(),
  STRIPE_PRICE_ENTERPRISE: z.string().min(1).optional(),

  // ── WhatsApp ──
  WHATSAPP_API_URL: z.string().url().default('https://graph.facebook.com/v18.0'),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().min(1).optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1).optional(),
  WHATSAPP_WEBHOOK_SECRET: z.string().min(1).optional(),

  // ── Upload (R2) ──
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET_NAME: z.string().default('theiadvisor-uploads'),
  R2_PUBLIC_URL: z.string().url().optional(),

  // ── Email (Resend) ──
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().email().default('team@theiadvisor.com'),

  // ── Rate Limiting ──
  THROTTLE_TTL: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),

  // ── CORS ──
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),

  // ── Security ──
  JWT_SECRET: z.string().min(1).optional(),
  ENCRYPTION_KEY: z.string().min(1).optional(),

  // ── Telemetry ──
  OTEL_ENABLED: z.string().default('true'),
  OTEL_SERVICE_NAME: z.string().default('theiadvisor-backend'),
  AXIOM_API_TOKEN: z.string().min(1).optional(),
  AXIOM_DATASET: z.string().default('theiadvisor-traces'),
});

// Production-specific requirements
const productionRequirements = [
  'CLERK_SECRET_KEY',
  'CLERK_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'OPENAI_API_KEY',
  'JWT_SECRET',
  'ENCRYPTION_KEY',
] as const;

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validate environment variables at startup.
 * Throws with clear error listing ALL missing/invalid vars.
 */
export function validateEnv(): EnvConfig {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues.map(
      (issue) => `  ${issue.path.join('.')}: ${issue.message}`,
    );
    logger.error(`Environment validation failed:\n${errors.join('\n')}`);
    throw new Error(`Invalid environment configuration:\n${errors.join('\n')}`);
  }

  // Production-specific: warn about missing critical vars
  if (result.data.NODE_ENV === 'production') {
    const missing = productionRequirements.filter(
      (key) => !process.env[key],
    );
    if (missing.length > 0) {
      logger.error(
        `Production requires these env vars: ${missing.join(', ')}`,
      );
      throw new Error(
        `Missing production env vars: ${missing.join(', ')}`,
      );
    }
  }

  logger.log(
    `Environment validated (${result.data.NODE_ENV}, ${Object.keys(result.data).length} vars)`,
  );
  return result.data;
}
