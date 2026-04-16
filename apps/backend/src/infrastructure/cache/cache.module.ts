// src/infrastructure/cache/cache.module.ts
import { Module, Global } from '@nestjs/common';
import { CacheService } from './cache.service';
import { WebhookIdempotencyService } from '../../common/resilience/webhook-idempotency.service';

/**
 * Cache Module
 *
 * Global module - disponível em toda aplicação
 * Usa Upstash REST API
 *
 * Includes WebhookIdempotencyService (Redis-based webhook deduplication)
 */
@Global()
@Module({
  providers: [CacheService, WebhookIdempotencyService],
  exports: [CacheService, WebhookIdempotencyService],
})
export class CacheModule {}
